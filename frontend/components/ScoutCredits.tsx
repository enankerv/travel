"use client";

import { useEffect, useState } from "react";
import { getScoutQuota } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import { SCOUT_OPTIMISTIC_DECREMENT, SCOUT_OPTIMISTIC_REFUND } from "@/lib/realtime";

export function dispatchScoutOptimisticDecrement() {
  window.dispatchEvent(new CustomEvent(SCOUT_OPTIMISTIC_DECREMENT));
}

export function dispatchScoutOptimisticRefund() {
  window.dispatchEvent(new CustomEvent(SCOUT_OPTIMISTIC_REFUND));
}

export default function ScoutCredits() {
  const { user } = useAuth();
  const [credits, setCredits] = useState<number | null>(null);

  useEffect(() => {
    getScoutQuota()
      .then((q) => setCredits(q.credits))
      .catch(() => setCredits(null));
  }, [user?.id]);

  useEffect(() => {
    const dec = () => setCredits((c) => (c !== null && c > 0 ? c - 1 : c));
    const refund = () => setCredits((c) => (c !== null ? c + 1 : c));
    window.addEventListener(SCOUT_OPTIMISTIC_DECREMENT, dec);
    window.addEventListener(SCOUT_OPTIMISTIC_REFUND, refund);
    return () => {
      window.removeEventListener(SCOUT_OPTIMISTIC_DECREMENT, dec);
      window.removeEventListener(SCOUT_OPTIMISTIC_REFUND, refund);
    };
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
      {credits} scout{credits !== 1 ? "s" : ""} remaining
    </span>
  );
}
