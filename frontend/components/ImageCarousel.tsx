"use client";

import { useRef, useState, useCallback, useEffect, useImperativeHandle, forwardRef } from "react";

export type ImageCarouselHandle = {
  scrollToIndex: (index: number) => void;
  scrollToPrev: () => void;
  scrollToNext: () => void;
};

type ImageCarouselProps = {
  images: string[];
  alt?: string;
  className?: string;
  initialIndex?: number;
  showArrows?: boolean;
  showCounter?: boolean;
};

const ImageCarousel = forwardRef<ImageCarouselHandle, ImageCarouselProps>(function ImageCarousel(
  { images, alt = "Listing image", className = "", initialIndex = 0, showArrows = false, showCounter = false },
  ref
) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(initialIndex);

  const scrollToIndex = useCallback((index: number) => {
    const el = scrollRef.current;
    if (!el) return;
    const slideWidth = el.offsetWidth;
    const clamped = Math.max(0, Math.min(index, images.length - 1));
    el.scrollTo({ left: clamped * slideWidth, behavior: "smooth" });
  }, [images.length]);

  const scrollToPrev = useCallback(() => {
    scrollToIndex(activeIndex === 0 ? images.length - 1 : activeIndex - 1);
  }, [activeIndex, images.length, scrollToIndex]);

  const scrollToNext = useCallback(() => {
    scrollToIndex(activeIndex === images.length - 1 ? 0 : activeIndex + 1);
  }, [activeIndex, images.length, scrollToIndex]);

  useImperativeHandle(ref, () => ({
    scrollToIndex,
    scrollToPrev,
    scrollToNext,
  }), [scrollToIndex, scrollToPrev, scrollToNext]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || images.length === 0) return;
    const slideWidth = el.offsetWidth;
    el.scrollLeft = initialIndex * slideWidth;
    setActiveIndex(Math.min(initialIndex, images.length - 1));
  }, [images.length, initialIndex]);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el || images.length === 0) return;
    const scrollLeft = el.scrollLeft;
    const slideWidth = el.offsetWidth;
    const index = Math.round(scrollLeft / slideWidth);
    setActiveIndex(Math.min(index, images.length - 1));
  }, [images.length]);

  if (images.length === 0) return null;

  return (
    <div className={`image-carousel ${className}`.trim()}>
      <div className="image-carousel__viewport">
        {showArrows && images.length > 1 && (
          <>
            <button
              type="button"
              className="image-carousel__arrow image-carousel__arrow--prev"
              onClick={scrollToPrev}
              aria-label="Previous image"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
            <button
              type="button"
              className="image-carousel__arrow image-carousel__arrow--next"
              onClick={scrollToNext}
              aria-label="Next image"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          </>
        )}
        {showCounter && images.length > 0 && (
          <div className="image-carousel__counter">
            {activeIndex + 1} / {images.length}
          </div>
        )}
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
      </div>
      {images.length > 1 && !showCounter && (
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
});

export default ImageCarousel;
