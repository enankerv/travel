"use client";

import { useListDetailContext } from "@/lib/ListDetailContext";

/** List-level local state: number of people for price-per-person (table + mobile). */
export default function PartySizeControls({ className = "" }: { className?: string }) {
  const { partySize, setPartySize } = useListDetailContext();

  return (
    <div
      className={`sheet-toolbar-party ${className}`.trim()}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <span className="sheet-toolbar-party__label">People</span>
      <button
        type="button"
        className="sheet-toolbar-party__step"
        aria-label="Fewer people"
        disabled={partySize <= 1}
        onClick={() => setPartySize(partySize - 1)}
      >
        −
      </button>
      <input
        className="sheet-toolbar-party__input"
        type="number"
        min={1}
        max={999}
        value={partySize}
        aria-label="Number of people for price per person"
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === "") return;
          const n = parseInt(raw, 10);
          if (Number.isNaN(n)) return;
          setPartySize(n);
        }}
        onBlur={(e) => {
          const n = parseInt(e.target.value, 10);
          if (Number.isNaN(n) || n < 1) setPartySize(1);
        }}
      />
      <button
        type="button"
        className="sheet-toolbar-party__step"
        aria-label="More people"
        disabled={partySize >= 999}
        onClick={() => setPartySize(partySize + 1)}
      >
        +
      </button>
    </div>
  );
}
