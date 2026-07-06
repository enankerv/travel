/** Board coords — frames are parent-local rects; POI positions are offsets from frame origin. */
import { screenToBoardNorm, type BoardCamera } from '@/lib/boardCoords'
import { clamp, type BoardNorm } from '@/lib/boardMath'
import type { BoardSubgroup } from '@/lib/subgroup'

export type SubgroupRootRect = { x: number; y: number; w: number; h: number }

export type BoardSubgroupTree = {
  byId: Map<string, BoardSubgroup>
  childrenByParentId: Map<string | null, BoardSubgroup[]>
  rootRectById: Map<string, SubgroupRootRect>
}

export function subgroupsById(
  subgroups: BoardSubgroup[],
): Map<string, BoardSubgroup> {
  return new Map(subgroups.map((sg) => [sg.id, sg]))
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

function subgroupRootRect(
  sg: BoardSubgroup,
  byId: Map<string, BoardSubgroup>,
): SubgroupRootRect {
  const parentId = sg.parent_subgroup_id ?? null
  if (!parentId) {
    return {
      x: sg.board_x,
      y: sg.board_y,
      w: sg.board_w,
      h: sg.board_h,
    }
  }
  const parent = byId.get(parentId)
  if (!parent) {
    return { x: sg.board_x, y: sg.board_y, w: sg.board_w, h: sg.board_h }
  }
  const pr = subgroupRootRect(parent, byId)
  return {
    x: pr.x + sg.board_x * pr.w,
    y: pr.y + sg.board_y * pr.h,
    w: sg.board_w * pr.w,
    h: sg.board_h * pr.h,
  }
}

export function buildBoardSubgroupTree(
  subgroups: BoardSubgroup[],
): BoardSubgroupTree {
  const byId = subgroupsById(subgroups)
  const rootRectById = new Map<string, SubgroupRootRect>()
  for (const sg of subgroups) {
    rootRectById.set(sg.id, subgroupRootRect(sg, byId))
  }
  return {
    byId,
    childrenByParentId: subgroupsByParentId(subgroups),
    rootRectById,
  }
}

function rootContainsRect(rect: SubgroupRootRect, root: BoardNorm): boolean {
  return (
    root.wx >= rect.x &&
    root.wx <= rect.x + rect.w &&
    root.wy >= rect.y &&
    root.wy <= rect.y + rect.h
  )
}

function parentLocalToRoot(
  parentSubgroupId: string | null,
  local: BoardNorm,
  byId: Map<string, BoardSubgroup>,
): BoardNorm {
  if (parentSubgroupId === null) return local
  const parent = byId.get(parentSubgroupId)
  if (!parent) return local
  const gp = parent.parent_subgroup_id ?? null
  if (gp === null) {
    return { wx: parent.board_x + local.wx, wy: parent.board_y + local.wy }
  }
  return parentLocalToRoot(
    gp,
    {
      wx: parent.board_x + local.wx * parent.board_w,
      wy: parent.board_y + local.wy * parent.board_h,
    },
    byId,
  )
}

export function rootToParentLocal(
  root: BoardNorm,
  parentSubgroupId: string | null,
  subgroups: BoardSubgroup[],
): BoardNorm {
  const byId = subgroupsById(subgroups)
  if (parentSubgroupId === null) return root
  const parent = byId.get(parentSubgroupId)
  if (!parent) return root
  const gp = parent.parent_subgroup_id ?? null
  if (gp === null) {
    return { wx: root.wx - parent.board_x, wy: root.wy - parent.board_y }
  }
  const gpLocal = rootToParentLocal(root, gp, subgroups)
  return {
    wx: parent.board_w > 0 ? (gpLocal.wx - parent.board_x) / parent.board_w : 0,
    wy: parent.board_h > 0 ? (gpLocal.wy - parent.board_y) / parent.board_h : 0,
  }
}

export function poiToRoot(
  poi: { subgroup_id?: string | null; board_x?: number; board_y?: number },
  subgroups: BoardSubgroup[],
  offset?: BoardNorm,
): BoardNorm {
  const ox = offset?.wx ?? poi.board_x ?? 0.5
  const oy = offset?.wy ?? poi.board_y ?? 0.5
  const sgId = poi.subgroup_id ?? null
  if (!sgId) return { wx: ox, wy: oy }
  const byId = subgroupsById(subgroups)
  const sg = byId.get(sgId)
  if (!sg) return { wx: ox, wy: oy }
  return parentLocalToRoot(
    sg.parent_subgroup_id ?? null,
    { wx: sg.board_x + ox, wy: sg.board_y + oy },
    byId,
  )
}

export function poiFromRoot(
  root: BoardNorm,
  subgroupId: string | null,
  subgroups: BoardSubgroup[],
  opts?: { clamp?: boolean },
): BoardNorm {
  if (!subgroupId) {
    let wx = root.wx
    let wy = root.wy
    if (opts?.clamp) {
      wx = clamp(wx, 0, 1)
      wy = clamp(wy, 0, 1)
    }
    return { wx, wy }
  }
  const sg = subgroupsById(subgroups).get(subgroupId)
  if (!sg) return root
  const parentLocal = rootToParentLocal(
    root,
    sg.parent_subgroup_id ?? null,
    subgroups,
  )
  let wx = parentLocal.wx - sg.board_x
  let wy = parentLocal.wy - sg.board_y
  if (opts?.clamp) {
    wx = clamp(wx, 0, sg.board_w)
    wy = clamp(wy, 0, sg.board_h)
  }
  return { wx, wy }
}

export function poiOffsetBounds(
  subgroupId: string | null,
  subgroups: BoardSubgroup[],
): { maxWx: number; maxWy: number } {
  if (!subgroupId) return { maxWx: 1, maxWy: 1 }
  const sg = subgroupsById(subgroups).get(subgroupId)
  if (!sg) return { maxWx: 1, maxWy: 1 }
  return { maxWx: sg.board_w, maxWy: sg.board_h }
}

export function screenToRootNorm(
  viewport: HTMLElement,
  camera: BoardCamera,
  clientX: number,
  clientY: number,
): BoardNorm | null {
  return screenToBoardNorm(viewport, camera, clientX, clientY)
}

export function screenToParentLocal(
  viewport: HTMLElement,
  camera: BoardCamera,
  parentSubgroupId: string | null,
  subgroups: BoardSubgroup[],
  clientX: number,
  clientY: number,
  opts?: { clamp?: boolean },
): BoardNorm | null {
  const root = screenToRootNorm(viewport, camera, clientX, clientY)
  if (!root) return null
  const local = rootToParentLocal(root, parentSubgroupId, subgroups)
  if (!opts?.clamp) return local
  return {
    wx: clamp(local.wx, 0, 1),
    wy: clamp(local.wy, 0, 1),
  }
}

export function screenToPoiOffset(
  viewport: HTMLElement,
  camera: BoardCamera,
  clientX: number,
  clientY: number,
  subgroups: BoardSubgroup[],
  subgroupId: string | null,
  opts?: { clamp?: boolean },
): BoardNorm | null {
  const root = screenToRootNorm(viewport, camera, clientX, clientY)
  if (!root) return null
  return poiFromRoot(root, subgroupId, subgroups, opts)
}

export function poiDisplayNorm(
  poi: { subgroup_id?: string | null; board_x?: number; board_y?: number },
  subgroups: BoardSubgroup[],
  offset?: BoardNorm,
): BoardNorm {
  const ox = offset?.wx ?? poi.board_x ?? 0.5
  const oy = offset?.wy ?? poi.board_y ?? 0.5
  const sgId = poi.subgroup_id ?? null
  if (!sgId) return { wx: ox, wy: oy }
  const sg = subgroupsById(subgroups).get(sgId)
  if (!sg || sg.board_w <= 0 || sg.board_h <= 0) return { wx: ox, wy: oy }
  return { wx: ox / sg.board_w, wy: oy / sg.board_h }
}

const MIN_SUBGROUP_SPAN = 0.08

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

export function subgroupContainingRootPoint(
  root: BoardNorm,
  tree: BoardSubgroupTree,
): string | null {
  let parentId: string | null = null
  let bestId: string | null = null

  while (true) {
    const children: BoardSubgroup[] =
      tree.childrenByParentId.get(parentId) ?? []
    let hit: BoardSubgroup | null = null

    for (let i = children.length - 1; i >= 0; i--) {
      const sg = children[i]
      const rect = tree.rootRectById.get(sg.id)
      if (rect && rootContainsRect(rect, root)) {
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
