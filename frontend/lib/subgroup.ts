/** Board subgroup — nested frame on the cork board. */
export type BoardSubgroup = {
  id: string
  list_id: string
  parent_subgroup_id?: string | null
  name: string
  board_x: number
  board_y: number
  board_w: number
  board_h: number
  board_z: number
  created_at: string
  updated_at: string
}

export type BoardSubgroupCreate = {
  name: string
  parent_subgroup_id?: string | null
  board_x?: number
  board_y?: number
  board_w?: number
  board_h?: number
  board_z?: number
}

export type BoardSubgroupUpdate = Partial<
  Pick<
    BoardSubgroup,
    | 'name'
    | 'parent_subgroup_id'
    | 'board_x'
    | 'board_y'
    | 'board_w'
    | 'board_h'
    | 'board_z'
  >
>

export type BoardSubgroupDeleteResponse = {
  ok: boolean
}

/** Max nesting depth enforced by the API (top-level subgroup = depth 1). */
export const MAX_SUBGROUP_DEPTH = 5

/** All subgroup ids in the subtree rooted at ``subgroupId`` (inclusive). */
export function subgroupSubtreeIds(
  subgroupId: string,
  subgroups: BoardSubgroup[],
): Set<string> {
  const childrenOf = new Map<string, string[]>()
  for (const sg of subgroups) {
    const parent = sg.parent_subgroup_id
    if (!parent) continue
    const siblings = childrenOf.get(parent) ?? []
    siblings.push(sg.id)
    childrenOf.set(parent, siblings)
  }

  const result = new Set<string>()
  const stack = [subgroupId]
  while (stack.length > 0) {
    const id = stack.pop()!
    if (result.has(id)) continue
    result.add(id)
    stack.push(...(childrenOf.get(id) ?? []))
  }
  return result
}

/** POIs that would be deleted when removing a subgroup (CASCADE on subgroup_id). */
export function countPoisInSubgroupSubtree(
  subgroupId: string,
  subgroups: BoardSubgroup[],
  pois: Array<{ subgroup_id?: string | null }>,
): number {
  const ids = subgroupSubtreeIds(subgroupId, subgroups)
  return pois.filter((p) => p.subgroup_id != null && ids.has(p.subgroup_id)).length
}

/** Message for the delete-group confirm dialog. */
export function subgroupDeleteConfirmMessage(
  subgroupName: string,
  poiCount: number,
): string {
  if (poiCount === 0) {
    return `Delete “${subgroupName}”?`
  }
  const noun = poiCount === 1 ? 'pin' : 'pins'
  return `Delete “${subgroupName}”? This will permanently delete ${poiCount} ${noun}.`
}
