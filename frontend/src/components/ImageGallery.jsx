import { useState, useEffect } from 'react';
import './ImageGallery.css';

export default function ImageGallery({ images, villa_name, isOpen, onClose }) {
  const [currentIndex, setCurrentIndex] = useState(0);

  const currentImage = images?.[currentIndex];

  useEffect(() => {
    if (!isOpen) return;
    
    function handleKeyDown(e) {
      if (e.key === 'ArrowLeft') goToPrevious();
      if (e.key === 'ArrowRight') goToNext();
      if (e.key === 'Escape') onClose();
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentIndex]);

  function goToNext() {
    setCurrentIndex((prev) => (prev + 1) % images.length);
  }

  function goToPrevious() {
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
  }

  if (!isOpen || !images?.length) return null;

  return (
    <div className="gallery-overlay" onClick={onClose}>
      <div className="gallery-container" onClick={(e) => e.stopPropagation()}>
        <button className="gallery-close" onClick={onClose}>
          ✕
        </button>

        <div className="gallery-main">
          <button
            className="gallery-nav gallery-prev"
            onClick={goToPrevious}
            title="Previous (← key)"
          >
            ‹
          </button>

          <div className="gallery-image-wrapper">
            <img
              key={currentIndex}
              src={currentImage}
              alt={`${villa_name} image ${currentIndex + 1}`}
              className="gallery-image"
              loading="lazy"
            />
          </div>

          <button
            className="gallery-nav gallery-next"
            onClick={goToNext}
            title="Next (→ key)"
          >
            ›
          </button>
        </div>

        <div className="gallery-footer">
          <div className="gallery-counter">
            {currentIndex + 1} / {images.length}
          </div>

          <div className="gallery-thumbnails">
            {images.map((img, idx) => (
              <button
                key={idx}
                className={`gallery-thumb ${idx === currentIndex ? 'active' : ''}`}
                onClick={() => setCurrentIndex(idx)}
                title={`Image ${idx + 1}`}
              >
                <img src={img} alt={`Thumbnail ${idx + 1}`} />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
