"use client";

import { useRef, useState, useCallback } from "react";

type ImageCarouselProps = {
  images: string[];
  alt?: string;
  className?: string;
};

export default function ImageCarousel({ images, alt = "Listing image", className = "" }: ImageCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el || images.length === 0) return;
    const scrollLeft = el.scrollLeft;
    const slideWidth = el.offsetWidth;
    const index = Math.round(scrollLeft / slideWidth);
    setActiveIndex(Math.min(index, images.length - 1));
  }, [images.length]);

  const scrollToIndex = (index: number) => {
    const el = scrollRef.current;
    if (!el) return;
    const slideWidth = el.offsetWidth;
    el.scrollTo({ left: index * slideWidth, behavior: "smooth" });
  };

  if (images.length === 0) return null;

  return (
    <div className={`image-carousel ${className}`.trim()}>
      <div
        ref={scrollRef}
        className="image-carousel__track"
        onScroll={handleScroll}
        role="region"
        aria-label="Image carousel"
      >
        {images.map((src, i) => (
          <div key={i} className="image-carousel__slide">
            <img src={src} alt={`${alt} ${i + 1}`} />
          </div>
        ))}
      </div>
      {images.length > 1 && (
        <div className="image-carousel__dots">
          {images.map((_, i) => (
            <button
              key={i}
              type="button"
              className={`image-carousel__dot ${i === activeIndex ? "active" : ""}`}
              onClick={() => scrollToIndex(i)}
              aria-label={`Go to image ${i + 1}`}
              aria-current={i === activeIndex ? "true" : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}
