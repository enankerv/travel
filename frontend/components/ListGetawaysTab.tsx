"use client";

import { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { scoutUrl, scoutPaste, deleteGetaway, updateGetaway } from "@/lib/api";
import { useListDetailContext } from "@/lib/ListDetailContext";
import { useIsMobile } from "@/hooks/useIsMobile";
import DropZone from "./DropZone";
import PasteModal from "./PasteModal";
import ImageGallery from "./ImageGallery";
import CommentsSidebar from "./CommentsSidebar";
import MapGetawaySidebar from "./MapGetawaySidebar";
import GetawayDetailSheet from "./GetawayDetailSheet";
import GetawayListView from "./GetawayListView";
import ScoutBookmarklet from "./ScoutBookmarklet";

const GetawayMap = dynamic(() => import("./GetawayMap"), { ssr: false });

export default function ListGetawaysTab({
  commentsOpen = false,
  onCommentsOpenChange,
  focusedGetawayId = null,
  onFocusedGetawayChange,
  initialPasteMode,
  onConsumePasteParam,
}: {
  commentsOpen?: boolean;
  onCommentsOpenChange?: (open: boolean) => void;
  focusedGetawayId?: string | null;
  onFocusedGetawayChange?: (id: string | null) => void;
  initialPasteMode?: boolean;
  onConsumePasteParam?: () => void;
}) {
  const { list, getaways, setGetaways, isLoading, onRefresh, commentsByGetaway } = useListDetailContext();
  const isMobile = useIsMobile();
  const listId = list.id;
  const [error, setError] = useState("");
  const [scoutLoading, setScoutLoading] = useState(false);
  const [lastFailedUrl, setLastFailedUrl] = useState("");
  const [lastFailedPaste, setLastFailedPaste] = useState("");
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [pasteGetaway, setPasteGetaway] = useState<any>(null);
  const [galleryImages, setGalleryImages] = useState<string[] | null>(null);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [viewMode, setViewMode] = useState<"table" | "map">("table");
  const [mapGetawayId, setMapGetawayId] = useState<string | null>(null);
  const [pasteFromBookmarklet, setPasteFromBookmarklet] = useState(false);

  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  const consumedPasteRef = useRef(false);
  useEffect(() => {
    if (initialPasteMode && !consumedPasteRef.current) {
      consumedPasteRef.current = true;
      setPasteFromBookmarklet(true);
      setShowPasteModal(true);
      setPasteGetaway(null);
      setLastFailedPaste("");
      onConsumePasteParam?.();
    }
  }, [initialPasteMode]);

  async function handleScoutUrl(url: string, getawayId?: string) {
    setError("");
    setLastFailedUrl("");
    setScoutLoading(true);
    try {
      const result = await scoutUrl(url, listId, getawayId);
      if (result.ok) {
        if (getawayId) {
          setGetaways((prev) =>
            prev.map((g) =>
              g.id === getawayId ? { ...g, import_status: "loading" } : g,
            ),
          );
        }
        if (Notification.permission === "granted") {
          new Notification("Scouting...", {
            body: "Processing listing...",
            icon: "⏳",
          });
        }
      } else if (!result.ok) {
        setLastFailedUrl(url);
        setError(result.error || "Failed to scout getaway");
        if (Notification.permission === "granted") {
          new Notification("Scouting Failed", {
            body: result.error || "Failed to scout getaway",
            icon: "✕",
          });
        }
      }
    } catch (err: any) {
      setLastFailedUrl(url);
      setError(err.message || "Failed to scout getaway");
      if (Notification.permission === "granted") {
        new Notification("Error", {
          body: err.message || "Failed to scout getaway",
          icon: "✕",
        });
      }
    } finally {
      setScoutLoading(false);
    }
  }

  async function handleScoutPaste(text: string) {
    setError("");
    setLastFailedPaste("");
    setShowPasteModal(false);
    const getawayId = pasteGetaway?.id ?? undefined;
    const originalUrl = pasteGetaway?.source_url ?? undefined;
    try {
      const result = await scoutPaste(text, listId, originalUrl, getawayId);
      if (result.ok) {
        setPasteGetaway(null);
        if (getawayId) {
          setGetaways((prev) =>
            prev.map((g) =>
              g.id === getawayId ? { ...g, import_status: "loading" } : g,
            ),
          );
        }
        if (Notification.permission === "granted") {
          new Notification("Processing Paste...", {
            body: "Extracting getaway details...",
            icon: "⏳",
          });
        }
      } else if (!result.ok) {
        setLastFailedPaste(text);
        setError(result.error || "Failed to process paste");
        setShowPasteModal(true);
        if (Notification.permission === "granted") {
          new Notification("Error", {
            body: result.error || "Failed to process paste",
            icon: "✕",
          });
        }
      }
    } catch (err: any) {
      setLastFailedPaste(text);
      setError(err.message || "Failed to process paste");
      setShowPasteModal(true);
      if (Notification.permission === "granted") {
        new Notification("Error", {
          body: err.message || "Failed to process paste",
          icon: "✕",
        });
      }
    }
  }

  function handleRetryError() {
    if (lastFailedUrl) {
      setLastFailedUrl("");
      setError("");
      handleScoutUrl(lastFailedUrl);
    } else if (lastFailedPaste) {
      setShowPasteModal(true);
      setError("");
    }
  }

  async function handleRetryGetaway(getaway: any) {
    if (!getaway?.source_url) return;
    try {
      await handleScoutUrl(getaway.source_url, getaway.id);
    } catch (err: any) {
      setError(err.message || "Failed to retry");
    }
  }

  async function handleDeleteGetaway(getawayId: string) {
    if (!confirm("Delete this getaway?")) return;
    try {
      const getaway = getaways.find((g: any) => g.id === getawayId);
      if (getaway) {
        await deleteGetaway(listId, getaway.slug);
        setGetaways((prev) => prev.filter((g: any) => g.id !== getawayId));
      }
    } catch (err: any) {
      setError(err.message || "Failed to delete getaway");
    }
  }

  async function handleUpdateGetaway(getawayId: string, updatedData: any) {
    try {
      const getaway = getaways.find((g: any) => g.id === getawayId);
      if (getaway) {
        await updateGetaway(listId, getaway.slug, updatedData);
        await onRefresh();
      }
    } catch (err: any) {
      setError(err.message || "Failed to update getaway");
    }
  }

  function handleImageClick(images: string[], index: number) {
    setGalleryImages(images);
    setGalleryIndex(index);
  }

  function handlePasteClick(getaway: any) {
    setPasteGetaway(getaway);
    setLastFailedPaste("");
    setShowPasteModal(true);
  }

  const showRetry = !!(lastFailedUrl || lastFailedPaste);

  return (
    <>
      <div className="list-villas-tab">
        <div className="list-villas-tab__drop">
          <DropZone onUrlSubmit={handleScoutUrl} isLoading={scoutLoading} />
          <ScoutBookmarklet listId={listId} listName={list.name} />
        </div>

        {error && (
          <div className="list-villas-tab__error">
            <span>{error}</span>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              {showRetry && (
                <button
                  type="button"
                  onClick={handleRetryError}
                  className="list-villas-tab__error-retry"
                >
                  Retry
                </button>
              )}
              <button
                type="button"
                onClick={() => setError("")}
                className="list-villas-tab__error-dismiss"
                title="Dismiss"
              >
                ×
              </button>
            </div>
          </div>
        )}

        <div className="list-villas-tab__view-toolbar">
          <button
            type="button"
            className={`list-villas-tab__view-btn ${viewMode === "table" ? "active" : ""}`}
            onClick={() => {
              setViewMode("table");
              setMapGetawayId(null);
            }}
          >
            Table
          </button>
          <button
            type="button"
            className={`list-villas-tab__view-btn ${viewMode === "map" ? "active" : ""}`}
            onClick={() => setViewMode("map")}
          >
            Map
          </button>
        </div>

        <div className="list-villas-tab__table-wrap">
          {viewMode === "table" ? (
          <GetawayListView
            isLoading={isLoading}
            onDelete={handleDeleteGetaway}
            onUpdate={handleUpdateGetaway}
            onImageClick={handleImageClick}
            onRetry={handleRetryGetaway}
            onPasteClick={handlePasteClick}
            onCommentClick={(getawayId: string) => {
              onCommentsOpenChange?.(true);
              onFocusedGetawayChange?.(getawayId);
            }}
          />
          ) : (
          <GetawayMap
            getaways={getaways}
            onGetawayClick={(id) => setMapGetawayId(id)}
          />
          )}
        </div>
      </div>

      {viewMode === "map" && mapGetawayId && (
        isMobile ? (
          <GetawayDetailSheet
            getaway={getaways.find((g: any) => g.id === mapGetawayId) ?? null}
            onClose={() => setMapGetawayId(null)}
            onImageClick={handleImageClick}
          />
        ) : (
          <MapGetawaySidebar
            getaway={getaways.find((g: any) => g.id === mapGetawayId) ?? null}
            onClose={() => setMapGetawayId(null)}
            onImageClick={handleImageClick}
            onCommentClick={
              mapGetawayId
                ? () => {
                    onCommentsOpenChange?.(true);
                    onFocusedGetawayChange?.(mapGetawayId);
                  }
                : undefined
            }
            commentsCount={
              mapGetawayId
                ? (commentsByGetaway?.[mapGetawayId]?.length ?? 0)
                : 0
            }
          />
        )
      )}

      <CommentsSidebar
        isOpen={commentsOpen}
        onClose={() => {
          onCommentsOpenChange?.(false);
          onFocusedGetawayChange?.(null);
        }}
        focusedGetawayId={focusedGetawayId}
        onGetawayClick={(id: string) => onFocusedGetawayChange?.(id)}
      />

      {galleryImages && (
        <ImageGallery
          images={galleryImages}
          initialIndex={galleryIndex}
          onClose={() => setGalleryImages(null)}
        />
      )}

      <PasteModal
        isOpen={showPasteModal}
        onClose={() => {
          setShowPasteModal(false);
          setPasteGetaway(null);
          setLastFailedPaste("");
          setPasteFromBookmarklet(false);
        }}
        onSubmit={handleScoutPaste}
        isLoading={false}
        initialText={lastFailedPaste}
        listingUrl={pasteGetaway?.source_url ?? undefined}
        fromBookmarklet={pasteFromBookmarklet}
      />
    </>
  );
}
