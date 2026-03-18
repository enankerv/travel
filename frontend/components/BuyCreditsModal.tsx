"use client";

import { useState, useEffect } from "react";
import Modal from "./Modal";
import { getScoutPacks, createScoutCheckout, type ScoutPack } from "@/lib/api";

interface BuyCreditsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function BuyCreditsModal({
  isOpen,
  onClose,
}: BuyCreditsModalProps) {
  const [packs, setPacks] = useState<ScoutPack[]>([]);
  const [error, setError] = useState("");
  const [purchasingPackId, setPurchasingPackId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setError("");
      getScoutPacks()
        .then((r) => setPacks(r.packs))
        .catch((e) => setError(e.message || "Failed to load packs"));
    }
  }, [isOpen]);

  async function handleBuy(pack: ScoutPack) {
    setError("");
    setPurchasingPackId(pack.id);
    try {
      const base = typeof window !== "undefined" ? window.location.origin : "";
      const { checkout_url } = await createScoutCheckout(
        pack.id,
        `${base}/?credits=success`,
        `${base}/`
      );
      if (checkout_url) {
        window.location.href = checkout_url;
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Checkout failed");
      setPurchasingPackId(null);
    }
  }

  return (
    <Modal open={isOpen} onClose={onClose} width="420px">
      <h2 style={{ color: "var(--light)", marginBottom: "0.5rem" }}>
        Buy Scout Credits
      </h2>
      <p
        style={{
          color: "var(--muted)",
          fontSize: "0.9rem",
          marginBottom: "1.25rem",
        }}
      >
        Add credits to scout villa listings from URLs or pasted content.
      </p>

      {error && (
        <div
          style={{
            padding: "0.75rem 1rem",
            background: "var(--red-soft)",
            border: "1px solid var(--red)",
            borderRadius: "8px",
            color: "var(--red)",
            fontSize: "0.9rem",
            marginBottom: "1rem",
          }}
        >
          {error}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        {packs.map((pack) => (
          <div
            key={pack.id}
            style={{
              padding: "1rem 1.25rem",
              background: "var(--surface)",
              border: "1px solid var(--border-strong)",
              borderRadius: "8px",
              display: "flex",
              flexDirection: "column",
              gap: "0.5rem",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
              }}
            >
              <div>
                <div style={{ fontWeight: 600, color: "var(--light)" }}>
                  {pack.name}
                </div>
                <div
                  style={{
                    fontSize: "0.85rem",
                    color: "var(--muted)",
                    marginTop: "0.25rem",
                  }}
                >
                  {pack.description}
                </div>
              </div>
              <div style={{ fontWeight: 600, color: "var(--accent)" }}>
                ${pack.price_usd}
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleBuy(pack)}
              disabled={purchasingPackId !== null}
              style={{
                background: "var(--accent)",
                color: "#fff",
                border: "none",
                borderRadius: "6px",
                padding: "0.5rem 1rem",
                cursor: purchasingPackId ? "not-allowed" : "pointer",
                fontWeight: 600,
                fontSize: "0.9rem",
              }}
            >
              {purchasingPackId === pack.id ? "Redirecting…" : "Buy"}
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={onClose}
        style={{
          marginTop: "1.25rem",
          background: "transparent",
          border: "1px solid var(--border-strong)",
          color: "var(--muted)",
          padding: "0.5rem 1rem",
          borderRadius: "6px",
          cursor: "pointer",
          fontSize: "0.9rem",
        }}
      >
        Cancel
      </button>
    </Modal>
  );
}
