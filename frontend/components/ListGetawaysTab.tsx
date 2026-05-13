"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
import ListCursorSurface from "./ListCursorSurface";
import ScoutBookmarklet from "./ScoutBookmarklet";
import { dispatchScoutOptimisticDecrement, dispatchScoutOptimisticRefund } from "@/components/ScoutCredits";

const GetawayMap = dynamic(() => import("./GetawayMap"), { ssr: false });

/** Safely show a notification; no-op when Notification API is unavailable (e.g. mobile). */
function tryShowNotification(
  title: string,
  options?: NotificationOptions,
): void {
  try {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission !== "granted") return;
    new Notification(title, options);
  } catch {
    // Notifications not supported (e.g. mobile) - silently ignore
  }
}

export default function ListGetawaysTab({
  pasteParam,
  urlParam,
  commentsOpen = false,
  onCommentsOpenChange,
  focusedGetawayId = null,
  onFocusedGetawayChange,
  onStickyContent,
}: {
  pasteParam?: string | null;
  urlParam?: string | null;
  commentsOpen?: boolean;
  onCommentsOpenChange?: (open: boolean) => void;
  focusedGetawayId?: string | null;
  onFocusedGetawayChange?: (id: string | null) => void;
  onStickyContent?: (content: React.ReactNode) => void;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    list,
    getaways,
    setGetaways,
    isLoading,
    onRefresh,
    commentsByGetaway,
  } = useListDetailContext();
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
  const [scoutPanelExpanded, setScoutPanelExpanded] = useState(true);

  const mapGetaway = useMemo(
    () => (mapGetawayId ? getaways.find((g: any) => g.id === mapGetawayId) : undefined),
    [mapGetawayId, getaways],
  );

  useEffect(() => {
    if (mapGetawayId && !getaways.some((g: any) => g.id === mapGetawayId)) {
      setMapGetawayId(null);
    }
  }, [mapGetawayId, getaways]);

  useEffect(() => {
    try {
      if ("Notification" in window && Notification.permission === "default") {
        Notification.requestPermission();
      }
    } catch {
      // Notifications not supported (e.g. mobile) - silently ignore
    }
  }, []);

  useEffect(() => {
    if (pasteParam === "1" && urlParam) {
      setPasteGetaway(null);
      setShowPasteModal(false);
    }
  }, [pasteParam, urlParam]);

  async function handleScoutUrl(url: string, getawayId?: string) {
    setError("");
    setLastFailedUrl("");
    setScoutLoading(true);
    dispatchScoutOptimisticDecrement();
    try {
      const result = await scoutUrl(url, listId, getawayId);
      if (result.ok) {
        if (result.thin_scrape) {
          dispatchScoutOptimisticRefund();
          tryShowNotification("Credit refunded", {
            body: "Credit refunded for thin scrape.",
            icon: "↩️",
          });
        }
        if (getawayId) {
          setGetaways((prev) =>
            prev.map((g) =>
              g.id === getawayId ? { ...g, import_status: "loading" } : g,
            ),
          );
        }
        tryShowNotification("Scouting...", {
          body: "Processing listing...",
          icon: "⏳",
        });
      } else {
        setLastFailedUrl(url);
        setError(result.error || "Failed to scout getaway");
        tryShowNotification("Scouting Failed", {
          body: result.error || "Failed to scout getaway",
          icon: "✕",
        });
      }
    } catch (err: any) {
      dispatchScoutOptimisticRefund();
      setLastFailedUrl(url);
      setError(err.message || "Failed to scout getaway");
      tryShowNotification("Error", {
        body: err.message || "Failed to scout getaway",
        icon: "✕",
      });
    } finally {
      setScoutLoading(false);
    }
  }

  async function handleScoutPaste(text: string) {
    setError("");
    setLastFailedPaste("");
    setShowPasteModal(false);
    setScoutLoading(true);
    dispatchScoutOptimisticDecrement();
    const getawayId = pasteGetaway?.id ?? undefined;
    const originalUrl = pasteGetaway?.source_url ?? urlParam ?? undefined;
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
        tryShowNotification("Processing Paste...", {
          body: result.truncated
            ? "Text was truncated for length limits. Extracting getaway details..."
            : "Extracting getaway details...",
          icon: "⏳",
        });
      } else {
        dispatchScoutOptimisticRefund();
        setLastFailedPaste(text);
        setError(result.error || "Failed to process paste");
        setShowPasteModal(true);
        tryShowNotification("Error", {
          body: result.error || "Failed to process paste",
          icon: "✕",
        });
      }
    } catch (err: any) {
      dispatchScoutOptimisticRefund();
      setLastFailedPaste(text);
      setError(err.message || "Failed to process paste");
      setShowPasteModal(true);
      tryShowNotification("Error", {
        body: err.message || "Failed to process paste",
        icon: "✕",
      });
    } finally {
      setScoutLoading(false);
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

  const stickyContent = useMemo(
    () => (
      <div className="list-villas-tab__sticky">
        <div
          className={`list-villas-tab__scout-panel${
            scoutPanelExpanded ? " list-villas-tab__scout-panel--open" : ""
          }`}
        >
          <div className="list-villas-tab__scout-drop-clip">
            <div
              className="list-villas-tab__scout-drop-inner"
              inert={scoutPanelExpanded ? undefined : true}
            >
              <div className="list-villas-tab__drop">
                <DropZone
                  onUrlSubmit={handleScoutUrl}
                  onError={(msg) => setError(msg)}
                  isLoading={scoutLoading}
                />
                <ScoutBookmarklet />
              </div>
            </div>
          </div>
          <button
            type="button"
            className="list-villas-tab__scout-toggle"
            onClick={() => setScoutPanelExpanded((open) => !open)}
            title={scoutPanelExpanded ? "Hide scout bar" : "Show scout bar"}
            aria-label={scoutPanelExpanded ? "Hide scout bar" : "Show scout bar"}
            aria-expanded={scoutPanelExpanded}
          >
            <svg
              className="list-villas-tab__scout-toggle-chevron"
              viewBox="0 0 12 12"
              width="12"
              height="12"
              aria-hidden
            >
              {scoutPanelExpanded ? (
                <path fill="currentColor" d="M6 3l4 5H2z" />
              ) : (
                <path fill="currentColor" d="M6 9l4-5H2z" />
              )}
            </svg>
          </button>
        </div>

        {error && (
          <div className="list-villas-tab__error">
            <span>{error}</span>
            <div
              style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
            >
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
      </div>
    ),
    [scoutLoading, error, showRetry, viewMode, scoutPanelExpanded],
  );

  useEffect(() => {
    onStickyContent?.(stickyContent);
    return () => onStickyContent?.(null);
  }, [onStickyContent, stickyContent]);

  return (
    <>
      <div
        className={`list-villas-tab${viewMode === "map" ? " list-villas-tab--map" : ""}`}
      >
        <div className="list-villas-tab__table-wrap">
          {viewMode === "table" ? (
            <ListCursorSurface listId={listId} enabled={!isMobile}>
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
            </ListCursorSurface>
          ) : (
            <GetawayMap
              getaways={getaways}
              onGetawayClick={(id) => setMapGetawayId(id)}
            />
          )}
        </div>
      </div>

      {viewMode === "map" &&
        mapGetaway &&
        (isMobile ? (
          <GetawayDetailSheet
            getaway={mapGetaway}
            onClose={() => setMapGetawayId(null)}
            onDelete={handleDeleteGetaway}
            onUpdate={handleUpdateGetaway}
          />
        ) : (
          <MapGetawaySidebar
            getaway={mapGetaway}
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
        ))}

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
          if (pasteParam === "1") {
            const params = new URLSearchParams(searchParams.toString());
            params.delete("paste");
            params.delete("url");
            const q = params.toString();
            router.replace(q ? "/?" + q : "/", { scroll: false });
          }
        }}
        onSubmit={handleScoutPaste}
        isLoading={false}
        initialText={lastFailedPaste}
        listingUrl={pasteGetaway?.source_url ?? urlParam ?? undefined}
        fromBookmarklet={!pasteGetaway}
      />
    </>
  );
}
