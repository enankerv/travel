"use client";

import { useState, useEffect } from "react";
import { scoutUrl, scoutPaste, deleteVilla, updateVilla } from "@/lib/api";
import DropZone from "./DropZone";
import VillaTable from "./VillaTable";
import PasteModal from "./PasteModal";
import ImageGallery from "./ImageGallery";

type ListVillasTabProps = {
  listId: string;
  villas: any[];
  setVillas: React.Dispatch<React.SetStateAction<any[]>>;
  isLoading: boolean;
  onRefresh: () => Promise<void>;
};

export default function ListVillasTab({
  listId,
  villas,
  setVillas,
  isLoading,
  onRefresh,
}: ListVillasTabProps) {
  const [error, setError] = useState("");
  const [lastFailedUrl, setLastFailedUrl] = useState("");
  const [lastFailedPaste, setLastFailedPaste] = useState("");
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [pasteVilla, setPasteVilla] = useState<any>(null);
  const [galleryImages, setGalleryImages] = useState<string[] | null>(null);
  const [galleryIndex, setGalleryIndex] = useState(0);

  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  async function handleScoutUrl(url: string, villaId?: string) {
    setError("");
    setLastFailedUrl("");
    try {
      const result = await scoutUrl(url, listId, villaId);
      if (result.ok) {
        if (villaId) {
          setVillas((prev) =>
            prev.map((v) => (v.id === villaId ? { ...v, scrap_status: "loading" } : v))
          );
        }
        if (Notification.permission === "granted") {
          new Notification("Scouting...", { body: "Processing listing...", icon: "⏳" });
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
    const villaId = pasteVilla?.id ?? undefined;
    const originalUrl = pasteVilla?.original_url ?? undefined;
    try {
      const result = await scoutPaste(text, listId, originalUrl, villaId);
      if (result.ok) {
        setPasteVilla(null);
        if (villaId) {
          setVillas((prev) =>
            prev.map((v) => (v.id === villaId ? { ...v, scrap_status: "loading" } : v))
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

  async function handleRetryVilla(villa: any) {
    if (!villa?.original_url) return;
    try {
      await handleScoutUrl(villa.original_url, villa.id);
    } catch (err: any) {
      setError(err.message || "Failed to retry");
    }
  }

  async function handleDeleteVilla(villaId: string) {
    if (!confirm("Delete this getaway?")) return;
    try {
      const villa = villas.find((v: any) => v.id === villaId);
      if (villa) {
        await deleteVilla(listId, villa.slug);
        setVillas((prev) => prev.filter((v: any) => v.id !== villaId));
      }
    } catch (err: any) {
      setError(err.message || "Failed to delete getaway");
    }
  }

  async function handleUpdateVilla(villaId: string, updatedData: any) {
    try {
      const villa = villas.find((v: any) => v.id === villaId);
      if (villa) {
        await updateVilla(listId, villa.slug, updatedData);
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

  function handlePasteClick(villa: any) {
    setPasteVilla(villa);
    setLastFailedPaste("");
    setShowPasteModal(true);
  }

  const showRetry = !!(lastFailedUrl || lastFailedPaste);

  return (
    <>
      <div className="list-villas-tab">
        <div className="list-villas-tab__drop">
          <DropZone onUrlSubmit={handleScoutUrl} isLoading={false} />
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
          <VillaTable
            villas={villas}
            isLoading={isLoading}
            onDelete={handleDeleteVilla}
            onUpdate={handleUpdateVilla}
            onImageClick={handleImageClick}
            onRetry={handleRetryVilla}
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
          setPasteVilla(null);
          setLastFailedPaste("");
        }}
        onSubmit={handleScoutPaste}
        isLoading={false}
        initialText={lastFailedPaste}
        listingUrl={pasteVilla?.original_url ?? undefined}
      />
    </>
  );
}
