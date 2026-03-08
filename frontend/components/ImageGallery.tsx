"use client";

import { useState, useEffect } from "react";
import { resolveImageUrl } from "@/lib/api";

export default function ImageGallery({ images, initialIndex = 0, onClose }) {
  const validImages = (images || []).filter((img) => resolveImageUrl(img))
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  useEffect(() => {
    setCurrentIndex(initialIndex);
  }, [initialIndex]);

  const handleKeyDown = (e) => {
    if (e.key === "ArrowLeft") {
      setCurrentIndex((prev) => (prev === 0 ? validImages.length - 1 : prev - 1));
    } else if (e.key === "ArrowRight") {
      setCurrentIndex((prev) => (prev === validImages.length - 1 ? 0 : prev + 1));
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [validImages.length]);
  if (validImages.length === 0) {
    return null;
  }

  const currentImage = validImages[Math.min(currentIndex, validImages.length - 1)]

  return (
    <div className="gallery-modal-overlay open">
      <div className="gallery-container">
        <img
          src={resolveImageUrl(currentImage)}
          alt={`Image ${currentIndex + 1}`}
          className="gallery-image"
        />

        <button className="gallery-close" onClick={onClose} title="Close (ESC)">
          ✕
        </button>

        {validImages.length > 1 && (
          <div className="gallery-nav">
            <button
              onClick={() =>
                setCurrentIndex((prev) =>
                  prev === 0 ? validImages.length - 1 : prev - 1,
                )
              }
              title="Previous (← key)"
            >
              ← Prev
            </button>
            <span
              style={{ color: "rgba(255, 255, 255, 0.6)", paddingTop: "8px" }}
            >
              {currentIndex + 1} / {validImages.length}
            </span>
            <button
              onClick={() =>
                setCurrentIndex((prev) =>
                  prev === validImages.length - 1 ? 0 : prev + 1,
                )
              }
              title="Next (→ key)"
            >
              Next →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

