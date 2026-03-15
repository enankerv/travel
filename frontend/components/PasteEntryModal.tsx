"use client";

import { useState, useEffect } from "react";
import { scoutPaste } from "@/lib/api";
import { getLastListId, setLastListId } from "@/lib/lastListStorage";
import Modal from "./Modal";
import PasteFormContent from "./PasteFormContent";
import type { ListItem } from "./ListsView";

interface PasteEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  lists: ListItem[];
  defaultListId?: string | null;
  onSuccess: (listId: string) => void;
}

export default function PasteEntryModal({
  isOpen,
  onClose,
  lists,
  defaultListId,
  onSuccess,
}: PasteEntryModalProps) {
  const [selectedListId, setSelectedListId] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen && lists.length > 0) {
      const defaultId =
        defaultListId && lists.some((l) => l.id === defaultListId)
          ? defaultListId
          : getLastListId();
      const fallback =
        defaultId && lists.some((l) => l.id === defaultId) ? defaultId : lists[0].id;
      setSelectedListId(fallback);
      setError("");
    } else if (isOpen && lists.length === 0) {
      setSelectedListId("");
    }
  }, [isOpen, lists, defaultListId]);

  async function handleSubmit(text: string) {
    if (!selectedListId || !text.trim()) return;
    setIsSubmitting(true);
    setError("");
    try {
      const result = await scoutPaste(text.trim(), selectedListId, undefined, undefined);
      if (result.ok) {
        setLastListId(selectedListId);
        onClose();
        onSuccess(selectedListId);
      } else {
        setError(result.error || "Failed to process paste");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to process paste");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!isOpen) return null;

  return (
    <Modal open={isOpen} onClose={onClose}>
      <h2 style={{ color: "var(--light)" }}>Add Listing from Clipboard</h2>
      <p style={{ margin: "0 0 1rem", fontSize: "0.9rem", color: "var(--light)" }}>
        Choose a list, then paste the page content below.
      </p>

      {lists.length > 0 ? (
        <div style={{ marginBottom: "1rem" }}>
          <label
            htmlFor="paste-list-select"
            style={{
              display: "block",
              marginBottom: "0.35rem",
              fontSize: "0.85rem",
              color: "var(--muted)",
            }}
          >
            Add to list
          </label>
          <select
            id="paste-list-select"
            value={selectedListId}
            onChange={(e) => setSelectedListId(e.target.value)}
            style={{
              width: "100%",
              padding: "0.5rem 0.75rem",
              background: "var(--surface)",
              border: "1px solid var(--border-strong)",
              borderRadius: "6px",
              color: "var(--light)",
              fontSize: "0.9rem",
            }}
          >
            {lists.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <p style={{ marginBottom: "1rem", fontSize: "0.9rem", color: "var(--muted)" }}>
          Create a list first to add getaways.
        </p>
      )}

      {lists.length === 0 ? (
        <div className="modal-actions">
          <button className="btn-cancel" onClick={onClose}>
            Close
          </button>
        </div>
      ) : (
        <>
      {error && (
        <div
          role="alert"
          style={{
            marginBottom: "1rem",
            padding: "0.75rem",
            background: "var(--red-soft)",
            border: "1px solid var(--red)",
            borderRadius: "6px",
            color: "var(--light)",
            fontSize: "0.9rem",
          }}
        >
          {error}
        </div>
      )}

      <PasteFormContent
        onSubmit={handleSubmit}
        onClose={onClose}
        isLoading={isSubmitting}
        fromBookmarklet={true}
      />
        </>
      )}
    </Modal>
  );
}
