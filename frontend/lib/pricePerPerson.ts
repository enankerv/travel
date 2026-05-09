/**
 * Total listing price divided by party size, rounded **up** to the next cent.
 */
export function pricePerPersonCentsUp(
  totalPrice: number,
  partySize: number,
): number | null {
  if (!Number.isFinite(totalPrice) || partySize < 1) return null;
  return Math.ceil((totalPrice / partySize) * 100) / 100;
}

export function formatMoney(amount: number, currency?: string | null): string {
  const sym = currency === "EUR" ? "€" : "$";
  return `${sym}${amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** One-line suffix for tables, e.g. "$33.34 / person" or null if N/A. */
export function formatPerPersonLine(
  totalPrice: number | null | undefined,
  currency: string | null | undefined,
  partySize: number | null | undefined,
): string | null {
  if (totalPrice == null || partySize == null || partySize < 1) return null;
  const per = pricePerPersonCentsUp(Number(totalPrice), partySize);
  if (per == null) return null;
  return `${formatMoney(per, currency)} / person`;
}
