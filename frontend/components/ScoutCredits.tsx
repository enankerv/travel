"use client";

import { useEffect, useState, useCallback } from "react";
import { getScoutQuota } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import { SCOUT_OPTIMISTIC_DECREMENT, SCOUT_OPTIMISTIC_REFUND } from "@/lib/realtime";
import BuyCreditsModal from "./BuyCreditsModal";

export function dispatchScoutOptimisticDecrement() {
  window.dispatchEvent(new CustomEvent(SCOUT_OPTIMISTIC_DECREMENT));
}

export function dispatchScoutOptimisticRefund() {
  window.dispatchEvent(new CustomEvent(SCOUT_OPTIMISTIC_REFUND));
}

export default function ScoutCredits() {
  const { user } = useAuth();
  const [credits, setCredits] = useState<number | null>(null);
  const [showBuyModal, setShowBuyModal] = useState(false);

  const refetch = useCallback(() => {
    getScoutQuota()
      .then((q) => setCredits(q.credits))
      .catch(() => setCredits(null));
  }, []);

  useEffect(() => {
    refetch();
  }, [user?.id, refetch]);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.search.includes('credits=success')) {
      const t = setTimeout(refetch, 800);
      return () => clearTimeout(t);
    }
  }, [user?.id, refetch]);

  useEffect(() => {
    const onVisible = () => refetch();
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [refetch]);

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

  const isLow = credits <= 5;

  return (
    <>
      <button
        type="button"
        className="scout-credits"
        onClick={() => setShowBuyModal(true)}
        title="Scout credits remaining — click to buy more"
        style={{
          background: "none",
          border: "none",
          color: isLow ? "var(--accent)" : "var(--muted)",
          fontSize: "0.9rem",
          display: "flex",
          alignItems: "center",
          gap: "0.25rem",
          cursor: "pointer",
          padding: 0,
          textDecoration: "none",
          flexShrink: 0,
        }}
      >
        <span aria-hidden>⚡</span>
        <span className="scout-credits__text--low">
          {credits} scout{credits !== 1 ? "s" : ""} remaining
        </span>
      </button>
      <BuyCreditsModal
        isOpen={showBuyModal}
        onClose={() => setShowBuyModal(false)}
      />
    </>
  );
}
