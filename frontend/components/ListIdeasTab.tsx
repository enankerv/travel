"use client";

import { useState } from "react";
import { createPoi, deletePoi } from "@/lib/api";
import CreatePoiModal, { type PoiFormData } from "./CreatePoiModal";

export type PoiRecord = {
  id: string;
  list_id: string;
  slug: string;
  poi_type: string;
  name: string;
  description?: string | null;
  location?: string | null;
  region?: string | null;
  source_url?: string | null;
  notes?: string | null;
  lat?: number | null;
  lng?: number | null;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

const POI_TYPE_LABELS: Record<string, string> = {
  restaurant: "Restaurant",
  activity: "Activity",
  business: "Business",
  place: "Place",
  other: "Other",
};

function formatLocation(poi: PoiRecord): string {
  const parts = [poi.location, poi.region].filter(Boolean);
  return parts.join(", ");
}

export default function ListIdeasTab({
  listId,
  pois,
  setPois,
  isLoading,
}: {
  listId: string;
  pois: PoiRecord[];
  setPois: React.Dispatch<React.SetStateAction<PoiRecord[]>>;
  isLoading: boolean;
}) {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [error, setError] = useState("");
  const [deletingSlug, setDeletingSlug] = useState<string | null>(null);

  async function handleCreate(data: PoiFormData) {
    const payload: Record<string, string> = {
      name: data.name,
      poi_type: data.poi_type,
    };
    if (data.description) payload.description = data.description;
    if (data.location) payload.location = data.location;
    if (data.region) payload.region = data.region;
    if (data.source_url) payload.source_url = data.source_url;
    if (data.notes) payload.notes = data.notes;

    const created = await createPoi(listId, payload);
    setPois((prev) => [created, ...prev]);
  }

  async function handleDelete(slug: string) {
    if (!confirm("Remove this idea from the list?")) return;
    setDeletingSlug(slug);
    setError("");
    try {
      await deletePoi(listId, slug);
      setPois((prev) => prev.filter((p) => p.slug !== slug));
    } catch (err: any) {
      setError(err.message || "Failed to delete idea");
    } finally {
      setDeletingSlug(null);
    }
  }

  return (
    <div className="list-ideas-tab" style={{ padding: "1rem 2rem 2rem" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "1rem",
          gap: "1rem",
          flexWrap: "wrap",
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: "1.1rem", color: "var(--light)" }}>
            Trip Ideas
          </h2>
          <p style={{ margin: "0.35rem 0 0", color: "var(--muted)", fontSize: "0.9rem" }}>
            Restaurants, activities, places, and more — the building blocks for your cork board.
          </p>
        </div>
        <button
          type="button"
          className="btn-primary"
          onClick={() => setShowCreateModal(true)}
        >
          + Add Idea
        </button>
      </div>

      {error && (
        <div
          className="list-villas-tab__error"
          style={{ marginBottom: "1rem" }}
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError("")}
            className="list-villas-tab__error-dismiss"
            title="Dismiss"
          >
            ×
          </button>
        </div>
      )}

      {isLoading ? (
        <p style={{ color: "var(--muted)" }}>Loading ideas...</p>
      ) : pois.length === 0 ? (
        <div
          style={{
            border: "1px dashed var(--border-strong)",
            borderRadius: "12px",
            padding: "2rem",
            textAlign: "center",
            color: "var(--muted)",
          }}
        >
          <p style={{ margin: "0 0 0.75rem" }}>No ideas yet.</p>
          <button
            type="button"
            className="btn-primary"
            onClick={() => setShowCreateModal(true)}
          >
            Add your first idea
          </button>
        </div>
      ) : (
        <ul
          style={{
            listStyle: "none",
            margin: 0,
            padding: 0,
            display: "flex",
            flexDirection: "column",
            gap: "0.75rem",
          }}
        >
          {pois.map((poi) => {
            const locationLabel = formatLocation(poi);
            return (
              <li
                key={poi.id}
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: "10px",
                  padding: "1rem 1.1rem",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: "1rem",
                  }}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                        flexWrap: "wrap",
                        marginBottom: "0.35rem",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "0.75rem",
                          fontWeight: 600,
                          textTransform: "uppercase",
                          letterSpacing: "0.04em",
                          color: "var(--accent)",
                          background: "var(--accent-soft, rgba(99, 102, 241, 0.12))",
                          padding: "0.15rem 0.45rem",
                          borderRadius: "4px",
                        }}
                      >
                        {POI_TYPE_LABELS[poi.poi_type] || poi.poi_type}
                      </span>
                      <strong style={{ color: "var(--light)", fontSize: "1rem" }}>
                        {poi.name}
                      </strong>
                    </div>
                    {locationLabel && (
                      <div style={{ color: "var(--muted)", fontSize: "0.875rem" }}>
                        {locationLabel}
                      </div>
                    )}
                    {poi.description && (
                      <p
                        style={{
                          margin: "0.5rem 0 0",
                          color: "var(--light-soft, var(--light))",
                          fontSize: "0.9rem",
                          lineHeight: 1.45,
                        }}
                      >
                        {poi.description}
                      </p>
                    )}
                    {poi.source_url && (
                      <a
                        href={poi.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: "inline-block",
                          marginTop: "0.5rem",
                          fontSize: "0.85rem",
                          color: "var(--accent)",
                        }}
                      >
                        View link
                      </a>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDelete(poi.slug)}
                    disabled={deletingSlug === poi.slug}
                    title="Remove idea"
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "var(--muted)",
                      cursor: deletingSlug === poi.slug ? "wait" : "pointer",
                      fontSize: "1.25rem",
                      lineHeight: 1,
                      padding: "0.25rem",
                    }}
                  >
                    ×
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <CreatePoiModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreate={handleCreate}
      />
    </div>
  );
}
