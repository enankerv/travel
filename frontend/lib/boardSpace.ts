/** Nested board coordinate spaces — local 0–1 coords compose to root board norm. */
import { screenToBoardNorm, type BoardCamera } from '@/lib/boardCoords'
import type { BoardNorm } from '@/lib/boardMath'
import type { BoardSubgroup } from '@/lib/subgroup'

/** Normalized rect on a parent space (root board or subgroup interior). */
export type BoardSpace = {
  /** Root-normalized origin X (0–1 of full board world). */
  offsetWx: number
  offsetWy: number
  /** Root-normalized span (product of ancestor frame sizes). */
  scaleW: number
  scaleH: number
}

/** Precomputed spaces + parent→children tree for hit tests and coord transforms. */
export type BoardSpaceIndex = {
  spaceBySubgroupId: Map<string | null, BoardSpace>
  childrenByParentId: Map<string | null, BoardSubgroup[]>
}

export function rootBoundsContains(space: BoardSpace, root: BoardNorm): boolean {
  return (
    root.wx >= space.offsetWx &&
    root.wx <= space.offsetWx + space.scaleW &&
    root.wy >= space.offsetWy &&
    root.wy <= space.offsetWy + space.scaleH
  )
}

export const BOARD_ROOT_SPACE: BoardSpace = {
  offsetWx: 0,
  offsetWy: 0,
  scaleW: 1,
  scaleH: 1,
}

export function spaceForSubgroup(parent: BoardSpace, sg: BoardSubgroup): BoardSpace {
  return {
    offsetWx: parent.offsetWx + sg.board_x * parent.scaleW,
    offsetWy: parent.offsetWy + sg.board_y * parent.scaleH,
    scaleW: parent.scaleW * sg.board_w,
    scaleH: parent.scaleH * sg.board_h,
  }
}

/** Map subgroup id → composed root space + parent→children tree. */
export function buildBoardSpaceIndex(subgroups: BoardSubgroup[]): BoardSpaceIndex {
  const childrenByParentId = subgroupsByParentId(subgroups)
  const spaceBySubgroupId = new Map<string | null, BoardSpace>()
  spaceBySubgroupId.set(null, BOARD_ROOT_SPACE)

  function assign(parentId: string | null, parentSpace: BoardSpace) {
    const children = childrenByParentId.get(parentId) ?? []
    for (const sg of children) {
      const space = spaceForSubgroup(parentSpace, sg)
      spaceBySubgroupId.set(sg.id, space)
      assign(sg.id, space)
    }
  }

  assign(null, BOARD_ROOT_SPACE)
  return { spaceBySubgroupId, childrenByParentId }
}

/** Map subgroup id → composed root space (`null` = board root). */
export function buildBoardSpaceBySubgroupId(
  subgroups: BoardSubgroup[],
): Map<string | null, BoardSpace> {
  return buildBoardSpaceIndex(subgroups).spaceBySubgroupId
}

export function subgroupsByParentId(
  subgroups: BoardSubgroup[],
): Map<string | null, BoardSubgroup[]> {
  const map = new Map<string | null, BoardSubgroup[]>()
  for (const sg of subgroups) {
    const parent = sg.parent_subgroup_id ?? null
    const list = map.get(parent) ?? []
    list.push(sg)
    map.set(parent, list)
  }
  for (const list of map.values()) {
    list.sort(
      (a, b) =>
        (a.board_z - b.board_z) ||
        a.created_at.localeCompare(b.created_at),
    )
  }
  return map
}

export function poisBySubgroupId<T extends { subgroup_id?: string | null }>(
  pois: T[],
): Map<string | null, T[]> {
  const map = new Map<string | null, T[]>()
  for (const poi of pois) {
    const key = poi.subgroup_id ?? null
    const list = map.get(key) ?? []
    list.push(poi)
    map.set(key, list)
  }
  return map
}

export function localNormToRootNorm(space: BoardSpace, local: BoardNorm): BoardNorm {
  return {
    wx: space.offsetWx + local.wx * space.scaleW,
    wy: space.offsetWy + local.wy * space.scaleH,
  }
}

export function rootNormToLocalNorm(
  space: BoardSpace,
  root: BoardNorm,
  opts?: { clamp?: boolean },
): BoardNorm {
  const lx = space.scaleW > 0 ? (root.wx - space.offsetWx) / space.scaleW : 0
  const ly = space.scaleH > 0 ? (root.wy - space.offsetWy) / space.scaleH : 0
  if (opts?.clamp) {
    return {
      wx: Math.min(1, Math.max(0, lx)),
      wy: Math.min(1, Math.max(0, ly)),
    }
  }
  return { wx: lx, wy: ly }
}

export function screenToRootNorm(
  viewport: HTMLElement,
  camera: BoardCamera,
  clientX: number,
  clientY: number,
): BoardNorm | null {
  return screenToBoardNorm(viewport, camera, clientX, clientY)
}

export function screenToLocalNorm(
  viewport: HTMLElement,
  camera: BoardCamera,
  space: BoardSpace,
  clientX: number,
  clientY: number,
  opts?: { clamp?: boolean },
): BoardNorm | null {
  const root = screenToRootNorm(viewport, camera, clientX, clientY)
  if (!root) return null
  return rootNormToLocalNorm(space, root, opts)
}

/** World-pixel size of a space (for layout math that still uses BOARD_WORLD_*). */
export function poiRootNorm(
  poi: { subgroup_id?: string | null; board_x?: number; board_y?: number },
  spaceBySubgroupId: Map<string | null, BoardSpace>,
  localOverride?: BoardNorm,
): BoardNorm {
  const local = localOverride ?? {
    wx: poi.board_x ?? 0.5,
    wy: poi.board_y ?? 0.5,
  }
  const space = spaceBySubgroupId.get(poi.subgroup_id ?? null) ?? BOARD_ROOT_SPACE
  return localNormToRootNorm(space, local)
}

const MIN_SUBGROUP_SPAN = 0.08

/** Clamp a subgroup rect to stay inside its parent (local 0–1). */
export function clampSubgroupRect(rect: {
  board_x: number
  board_y: number
  board_w: number
  board_h: number
}): { board_x: number; board_y: number; board_w: number; board_h: number } {
  let { board_x, board_y, board_w, board_h } = rect
  board_w = Math.max(MIN_SUBGROUP_SPAN, Math.min(1, board_w))
  board_h = Math.max(MIN_SUBGROUP_SPAN, Math.min(1, board_h))
  board_x = Math.min(Math.max(0, board_x), 1 - board_w)
  board_y = Math.min(Math.max(0, board_y), 1 - board_h)
  return { board_x, board_y, board_w, board_h }
}

/**
 * Deepest subgroup whose root-space bounds contain ``root`` (for pin drop).
 * Walks the tree from the board root — O(depth × siblings) per level, not O(n).
 */
export function subgroupContainingRootPoint(
  root: BoardNorm,
  index: BoardSpaceIndex,
): string | null {
  let parentId: string | null = null
  let bestId: string | null = null

  while (true) {
    const children: BoardSubgroup[] =
      index.childrenByParentId.get(parentId) ?? []
    let hit: BoardSubgroup | null = null

    // Siblings are sorted low→high z; last match is the topmost frame.
    for (let i = children.length - 1; i >= 0; i--) {
      const sg = children[i]
      const space = index.spaceBySubgroupId.get(sg.id)
      if (space && rootBoundsContains(space, root)) {
        hit = sg
        break
      }
    }

    if (!hit) break
    bestId = hit.id
    parentId = hit.id
  }

  return bestId
}

export function parentSpaceForSubgroup(
  sg: BoardSubgroup,
  spaceBySubgroupId: Map<string | null, BoardSpace>,
): BoardSpace {
  return spaceBySubgroupId.get(sg.parent_subgroup_id ?? null) ?? BOARD_ROOT_SPACE
}
