"use client";

import { useState, useEffect } from "react";
import { scoutUrl, scoutPaste, deleteGetaway, updateGetaway } from "@/lib/api";
import DropZone from "./DropZone";
import GetawayTable from "./GetawayTable";
import PasteModal from "./PasteModal";
import ImageGallery from "./ImageGallery";

type ListGetawaysTabProps = {
  listId: string;
  getaways: any[];
  setGetaways: React.Dispatch<React.SetStateAction<any[]>>;
  isLoading: boolean;
  onRefresh: () => Promise<void>;
};

export default function ListGetawaysTab({
  listId,
  getaways,
  setGetaways,
  isLoading,
  onRefresh,
}: ListGetawaysTabProps) {
  const [error, setError] = useState("");
  const [lastFailedUrl, setLastFailedUrl] = useState("");
  const [lastFailedPaste, setLastFailedPaste] = useState("");
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [pasteGetaway, setPasteGetaway] = useState<any>(null);
  const [galleryImages, setGalleryImages] = useState<string[] | null>(null);
  const [galleryIndex, setGalleryIndex] = useState(0);

  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  async function handleScoutUrl(url: string, getawayId?: string) {
    setError("");
    setLastFailedUrl("");
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
          <DropZone onUrlSubmit={handleScoutUrl} isLoading={isLoading} />
        </div>

        {error && (
          <div className="list-villas-tab__error">
            <span>{error}</span>
            {showRetry && (
              <button
                type="button"
                onClick={handleRetryError}
                className="list-villas-tab__error-retry"
              >
                Retry
              </button>
            )}
          </div>
        )}

        <div className="list-villas-tab__table-wrap">
          <GetawayTable
            getaways={getaways}
            isLoading={isLoading}
            onDelete={handleDeleteGetaway}
            onUpdate={handleUpdateGetaway}
            onImageClick={handleImageClick}
            onRetry={handleRetryGetaway}
            onPasteClick={handlePasteClick}
          />
        </div>
      </div>

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
        }}
        onSubmit={handleScoutPaste}
        isLoading={false}
        initialText={lastFailedPaste}
        listingUrl={pasteGetaway?.source_url ?? undefined}
      />
    </>
  );
}
