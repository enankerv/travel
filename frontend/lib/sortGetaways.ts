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

/** Stable sort by price or votes; nulls-last for prices. `'default'` returns the original array reference. */
export function sortGetaways(
  rows: any[],
  votesByGetaway: VotesByGetaway,
  option: GetawaySortOption,
): any[] {
  if (option === "default") return rows;
  const withIndex = rows.map((g, i) => ({ g, i }));
  withIndex.sort((a, b) => {
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
