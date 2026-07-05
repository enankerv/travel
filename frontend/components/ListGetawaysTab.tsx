"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import dynamic from "next/dynamic";
import { scoutPaste, deleteGetaway, updateGetaway, updatePoi, deletePoi } from "@/lib/api";
import { mergePoiFromRealtime, type POIUpdate } from "@/lib/poi";
import { useListDetailContext } from "@/lib/ListDetailContext";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useScoutUrl } from "@/hooks/useScoutUrl";
import { tryShowScoutNotification } from "@/lib/scoutNotifications";
import PasteModal from "./PasteModal";
import ImageGallery from "./ImageGallery";
import CommentsSidebar from "./CommentsSidebar";
import PoiDetailSidebar from "./PoiDetailSidebar";
import GetawayDetailSheet from "./GetawayDetailSheet";
import GetawayListView from "./GetawayListView";
import ListCursorSurface from "./ListCursorSurface";
import {
  dispatchScoutOptimisticDecrement,
  dispatchScoutOptimisticRefund,
} from "@/components/ScoutCredits";

const GetawayMap = dynamic(() => import("./GetawayMap"), { ssr: false });

export default function ListGetawaysTab({
  viewMode,
  pasteParam,
  urlParam,
  commentsOpen = false,
  onCommentsOpenChange,
  focusedGetawayId = null,
  onFocusedGetawayChange,
}: {
  viewMode: 'table' | 'map'
  pasteParam?: string | null;
  urlParam?: string | null;
  commentsOpen?: boolean;
  onCommentsOpenChange?: (open: boolean) => void;
  focusedGetawayId?: string | null;
  onFocusedGetawayChange?: (id: string | null) => void;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const {
    list,
    getaways,
    setGetaways,
    pois,
    setPois,
    isLoading,
    dataLoaded,
    onRefresh,
    otherViewers,
  } = useListDetailContext();
  const isMobile = useIsMobile();
  const listId = list.id;
  const [error, setError] = useState("");
  const [pasteScoutLoading, setPasteScoutLoading] = useState(false);
  const onGetawayLoading = useCallback(
    (getawayId: string) => {
      setGetaways((prev) =>
        prev.map((g) =>
          g.id === getawayId ? { ...g, import_status: "loading" } : g,
        ),
      );
    },
    [setGetaways],
  );
  const { lastFailedUrl, setLastFailedUrl, handleScoutUrl } = useScoutUrl(
    listId,
    { setError, onGetawayLoading },
  );
  const [lastFailedPaste, setLastFailedPaste] = useState("");
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [pasteGetaway, setPasteGetaway] = useState<any>(null);
  const [galleryImages, setGalleryImages] = useState<string[] | null>(null);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [mapPoiId, setMapPoiId] = useState<string | null>(null);

  const mapPoi = useMemo(
    () => (mapPoiId ? pois.find((p) => p.id === mapPoiId) : undefined),
    [mapPoiId, pois],
  );

  useEffect(() => {
    if (viewMode !== "map" || dataLoaded || isLoading) return;
    void onRefresh();
  }, [viewMode, dataLoaded, isLoading, onRefresh]);

  useEffect(() => {
    if (viewMode !== 'map') setMapPoiId(null);
  }, [viewMode]);

  useEffect(() => {
    if (mapPoiId && !pois.some((p) => p.id === mapPoiId)) {
      setMapPoiId(null);
    }
  }, [mapPoiId, pois]);

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

  async function handleScoutPaste(text: string) {
    setError("");
    setLastFailedPaste("");
    setShowPasteModal(false);
    setPasteScoutLoading(true);
    dispatchScoutOptimisticDecrement();
    const getawayId = pasteGetaway?.id ?? undefined;
    const originalUrl = pasteGetaway?.source_url ?? urlParam ?? undefined;
    try {
      const result = await scoutPaste(text, listId, originalUrl, getawayId);
      if (result.ok) {
        setPasteGetaway(null);
        if (getawayId) {
          onGetawayLoading(getawayId);
        }
        tryShowScoutNotification("Processing Paste...", {
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
        tryShowScoutNotification("Error", {
          body: result.error || "Failed to process paste",
          icon: "✕",
        });
      }
    } catch (err: unknown) {
      dispatchScoutOptimisticRefund();
      setLastFailedPaste(text);
      const message =
        err instanceof Error ? err.message : "Failed to process paste";
      setError(message);
      setShowPasteModal(true);
      tryShowScoutNotification("Error", {
        body: message,
        icon: "✕",
      });
    } finally {
      setPasteScoutLoading(false);
    }
  }

  function handleRetryError() {
    if (lastFailedUrl) {
      const url = lastFailedUrl;
      setLastFailedUrl("");
      setError("");
      void handleScoutUrl(url);
    } else if (lastFailedPaste) {
      setShowPasteModal(true);
      setError("");
    }
  }

  async function handleRetryGetaway(getaway: any) {
    if (!getaway?.source_url) return;
    try {
      await handleScoutUrl(getaway.source_url, getaway.id);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to retry");
    }
  }

  async function handleDeleteGetaway(getawayId: string) {
    if (!confirm("Delete this getaway?")) return;
    try {
      const getaway = getaways.find((g) => g.id === getawayId);
      if (getaway) {
        await deleteGetaway(listId, getaway.id);
        setGetaways((prev) => prev.filter((g: any) => g.id !== getawayId));
      }
    } catch (err: any) {
      setError(err.message || "Failed to delete getaway");
    }
  }

  async function handleUpdateGetaway(getawayId: string, updatedData: any) {
    try {
      const getaway = getaways.find((g) => g.id === getawayId);
      if (getaway) {
        await updateGetaway(listId, getaway.id, updatedData);
        await onRefresh();
      }
    } catch (err: any) {
      setError(err.message || "Failed to update getaway");
    }
  }

  async function handleUpdatePoi(poiId: string, updates: POIUpdate) {
    try {
      const updated = await updatePoi(listId, poiId, updates);
      setPois((prev) =>
        prev.map((p) =>
          p.id === poiId ? mergePoiFromRealtime(p, updated) : p,
        ),
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update item");
    }
  }

  async function handleDeletePoi(poiId: string) {
    const poi = pois.find((p) => p.id === poiId);
    if (!poi || !confirm("Delete this item?")) return;
    try {
      if (poi.poi_type === "getaway") {
        await deleteGetaway(listId, poiId);
        setGetaways((prev) => prev.filter((g) => g.id !== poiId));
      } else {
        await deletePoi(listId, poiId);
      }
      setPois((prev) => prev.filter((p) => p.id !== poiId));
      if (mapPoiId === poiId) setMapPoiId(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to delete item");
    }
  }

  function handleMapPoiUpdate(poiId: string, updates: POIUpdate | Record<string, unknown>) {
    const poi = pois.find((p) => p.id === poiId);
    if (poi?.poi_type === "getaway") {
      void handleUpdateGetaway(poiId, updates);
    } else {
      void handleUpdatePoi(poiId, updates as POIUpdate);
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
      <div
        className={`list-villas-tab${viewMode === "map" ? " list-villas-tab--map" : ""}`}
      >
        {error && (
          <div className="list-villas-tab__error list-villas-tab__error--inline">
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
        <div className="list-villas-tab__table-wrap">
          {viewMode === "table" ? (
            <ListCursorSurface
              listId={listId}
              enabled={!isMobile}
              otherViewers={otherViewers}
            >
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
              pois={pois}
              isLoading={isLoading || !dataLoaded}
              onPoiClick={(id) => setMapPoiId(id)}
            />
          )}
        </div>
      </div>

      {viewMode === "map" &&
        mapPoi &&
        (isMobile ? (
          <GetawayDetailSheet
            getaway={mapPoi}
            onClose={() => setMapPoiId(null)}
            onDelete={(id) => void handleDeletePoi(id)}
            onUpdate={handleMapPoiUpdate}
          />
        ) : (
          <PoiDetailSidebar
            poi={mapPoi}
            onClose={() => setMapPoiId(null)}
            onImageClick={handleImageClick}
            onUpdateGetaway={handleUpdateGetaway}
            onUpdatePoi={handleUpdatePoi}
            onDelete={(id) => void handleDeletePoi(id)}
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
            router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
          }
        }}
        onSubmit={handleScoutPaste}
        isLoading={pasteScoutLoading}
        initialText={lastFailedPaste}
        listingUrl={pasteGetaway?.source_url ?? urlParam ?? undefined}
        fromBookmarklet={!pasteGetaway}
      />
    </>
  );
}
