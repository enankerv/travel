"use client";

import type { GetawaySortOption } from "@/lib/sortGetaways";

export default function GetawaySortSelect({
  value,
  onChange,
  id = "getaway-sort",
  className = "",
}: {
  value: GetawaySortOption;
  onChange: (v: GetawaySortOption) => void;
  id?: string;
  className?: string;
}) {
  return (
    <label className={`sheet-toolbar-sort ${className}`.trim()}>
      <span className="sheet-toolbar-sort__label">Sort</span>
      <select
        id={id}
        className="sheet-toolbar-sort__select"
        value={value}
        aria-label="Sort getaways"
        onChange={(e) => onChange(e.target.value as GetawaySortOption)}
      >
        <option value="votes-desc">Votes · most first</option>
        <option value="votes-asc">Votes · fewest first</option>
        <option value="price-asc">Price · low to high</option>
        <option value="price-desc">Price · high to low</option>
        <option value="default">List order</option>
      </select>
    </label>
  );
}
