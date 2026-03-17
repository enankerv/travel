"use client";

import { useEffect, useState } from "react";
import { getScoutQuota } from "@/lib/api";

const SCOUT_COMPLETE_EVENT = "scout-credits-refresh";

export function dispatchScoutComplete() {
  window.dispatchEvent(new CustomEvent(SCOUT_COMPLETE_EVENT));
}

export default function ScoutCredits() {
  const [credits, setCredits] = useState<number | null>(null);

  const fetchCredits = () => {
    getScoutQuota()
      .then((q) => setCredits(q.credits))
      .catch(() => setCredits(null));
  };

  useEffect(() => {
    fetchCredits();
    const handler = () => fetchCredits();
    window.addEventListener(SCOUT_COMPLETE_EVENT, handler);
    return () => window.removeEventListener(SCOUT_COMPLETE_EVENT, handler);
  }, []);

  if (credits === null) return null;

  return (
    <span
      className="scout-credits"
      title="Scout credits remaining"
      style={{
        color: "var(--muted)",
        fontSize: "0.9rem",
        display: "flex",
        alignItems: "center",
        gap: "0.25rem",
      }}
    >
      <span aria-hidden>⚡</span>
      {credits} scout{credits !== 1 ? "s" : ""}
    </span>
  );
}
