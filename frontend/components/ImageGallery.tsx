"use client";

import { useRef, useEffect } from "react";
import { useSignedImageUrls } from "@/hooks/useSignedImageUrls";
import ImageCarousel, { type ImageCarouselHandle } from "./ImageCarousel";

interface ImageGalleryProps {
  images: string[] | null | undefined;
  initialIndex?: number;
  onClose: () => void;
}

export default function ImageGallery({ images, initialIndex = 0, onClose }: ImageGalleryProps) {
  const signedUrls = useSignedImageUrls(images || []);
  const validImages = signedUrls.filter(Boolean);
  const carouselRef = useRef<ImageCarouselHandle>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        carouselRef.current?.scrollToPrev();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        carouselRef.current?.scrollToNext();
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (validImages.length === 0) return null;

  return (
    <div className="gallery-modal-overlay open" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="gallery-container" onClick={(e) => e.stopPropagation()}>
        <ImageCarousel
          ref={carouselRef}
          images={validImages}
          alt="Gallery image"
          className="gallery-carousel"
          initialIndex={Math.min(initialIndex, validImages.length - 1)}
          showArrows
          showCounter
        />
        <button className="gallery-close" onClick={onClose} title="Close (ESC)">
          ✕
        </button>
      </div>
    </div>
  );
}
