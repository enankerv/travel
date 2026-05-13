export type GetawaySortOption =
  | "default"
  | "price-asc"
  | "price-desc"
  | "votes-asc"
  | "votes-desc";

type VotesByGetaway = Record<
  string,
  { user_id: string }[] | undefined
>;

export type SortGetawaysOptions = {
  /** Row IDs to surface above the rest of the sort, in the given order.
   *  Used by the table to keep recently-added rows visible at the top until
   *  the user re-sorts. The relative order of these IDs is preserved exactly
   *  as given; the rest of the rows fall through to `option`'s ordering. */
  pinFirstIds?: readonly string[];
};

type IndexedRow = { g: any; i: number };

function compareByPrice(a: IndexedRow, b: IndexedRow, mult: 1 | -1): number {
  const pa = a.g.price;
  const pb = b.g.price;
  const nullA = pa == null || Number.isNaN(Number(pa));
  const nullB = pb == null || Number.isNaN(Number(pb));
  if (nullA && nullB) return a.i - b.i;
  if (nullA) return 1;
  if (nullB) return -1;
  const cmp = (Number(pa) - Number(pb)) * mult;
  return cmp !== 0 ? cmp : a.i - b.i;
}

function compareByVotes(
  a: IndexedRow,
  b: IndexedRow,
  votesByGetaway: VotesByGetaway,
  mult: 1 | -1,
): number {
  const va = votesByGetaway[a.g.id]?.length ?? 0;
  const vb = votesByGetaway[b.g.id]?.length ?? 0;
  const cmp = (va - vb) * mult;
  return cmp !== 0 ? cmp : a.i - b.i;
}

/** Stable sort by price or votes; nulls-last for prices.
 *
 *  `'default'` keeps the source order. `opts.pinFirstIds`, if provided, is
 *  treated as the highest-priority sort key: matching rows appear at the top
 *  in the given order, then the remaining rows fall through to `option`. */
export function sortGetaways(
  rows: any[],
  votesByGetaway: VotesByGetaway,
  option: GetawaySortOption,
  opts?: SortGetawaysOptions,
): any[] {
  const pinFirstIds = opts?.pinFirstIds ?? [];
  const pinOrder = new Map<string, number>();
  for (let i = 0; i < pinFirstIds.length; i++) {
    pinOrder.set(pinFirstIds[i]!, i);
  }
  const hasPins = pinOrder.size > 0;

  // Fast path: nothing to pin AND default order requested → return as-is.
  if (!hasPins && option === "default") return rows;

  const withIndex = rows.map((g, i) => ({ g, i }));
  withIndex.sort((a, b) => {
    if (hasPins) {
      const aPin = pinOrder.get(a.g.id);
      const bPin = pinOrder.get(b.g.id);
      if (aPin !== undefined && bPin !== undefined) return aPin - bPin;
      if (aPin !== undefined) return -1;
      if (bPin !== undefined) return 1;
    }
    switch (option) {
      case "price-asc":
        return compareByPrice(a, b, 1);
      case "price-desc":
        return compareByPrice(a, b, -1);
      case "votes-asc":
        return compareByVotes(a, b, votesByGetaway, 1);
      case "votes-desc":
        return compareByVotes(a, b, votesByGetaway, -1);
      default:
        return a.i - b.i;
    }
  });
  return withIndex.map(({ g }) => g);
}
