"use client";

import React, { useState, useEffect, useRef } from 'react';
import OptimizedImage from '@/components/OptimizedImage';
import { ChevronLeft, ChevronRight, X, Maximize2 } from 'lucide-react';
import styles from './ProductGallery.module.css';

interface ProductGalleryProps {
  images: string[];
  title: string;
  videoUrl?: string | null;
  discount?: number | null;
}

export default function ProductGallery({ images, title, videoUrl, discount }: ProductGalleryProps) {
  const validImages = images.filter(Boolean);
  const mediaList = videoUrl ? [videoUrl, ...validImages] : (validImages.length > 0 ? validImages : ['/placeholder.png']);
  
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);

  // Autoplay effect (every 4 seconds)
  useEffect(() => {
    if (mediaList.length <= 1 || isPaused || isFullScreen) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % mediaList.length);
    }, 4000);

    return () => clearInterval(interval);
  }, [mediaList.length, isPaused, isFullScreen]);

  const handlePrev = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setCurrentIndex((prev) => (prev === 0 ? mediaList.length - 1 : prev - 1));
  };

  const handleNext = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setCurrentIndex((prev) => (prev + 1) % mediaList.length);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    setIsPaused(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = () => {
    const diff = touchStartX.current - touchEndX.current;
    if (Math.abs(diff) > 50) {
      if (diff > 0) {
        // Swiped left -> next
        handleNext();
      } else {
        // Swiped right -> prev
        handlePrev();
      }
    }
    // Resume autoplay after delay
    setTimeout(() => setIsPaused(false), 5000);
  };

  const currentMedia = mediaList[currentIndex];
  const isVideo = currentMedia === videoUrl || currentMedia?.match(/\.(mp4|webm|ogg)$/i);

  return (
    <div className={styles.galleryContainer}>
      {/* Main Display Stage */}
      <div 
        className={styles.mainStage}
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={() => !isVideo && setIsFullScreen(true)}
      >
        {isVideo ? (
          <video
            controls
            autoPlay
            muted
            className={styles.mediaEl}
            poster={validImages[0]}
          >
            <source src={currentMedia} type="video/mp4" />
            Your browser does not support the video tag.
          </video>
        ) : (
          <div style={{ position: 'relative', width: '100%', height: '100%' }}>
            <OptimizedImage
              src={currentMedia}
              alt={`${title} - Image ${currentIndex + 1}`}
              fill
              priority
              className={styles.mediaEl}
              useThumbnail={false}
            />
          </div>
        )}

        {/* Discount Badge */}
        {discount && discount > 0 ? (
          <span className={`badge badge-flash`} style={{ position: 'absolute', top: '1rem', left: '1rem', zIndex: 5 }}>
            -{discount}% OFF
          </span>
        ) : null}

        {/* Maximize hint */}
        {!isVideo && (
          <div style={{ position: 'absolute', top: '1rem', right: '1.25rem', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', color: '#fff', padding: '6px', borderRadius: '50%', zIndex: 5, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Maximize2 size={16} />
          </div>
        )}

        {/* Navigation Arrows (if multiple items) */}
        {mediaList.length > 1 && (
          <>
            <button className={`${styles.navArrow} ${styles.prevArrow}`} onClick={handlePrev} aria-label="Previous image">
              <ChevronLeft size={22} />
            </button>
            <button className={`${styles.navArrow} ${styles.nextArrow}`} onClick={handleNext} aria-label="Next image">
              <ChevronRight size={22} />
            </button>

            {/* Dot Indicators */}
            <div className={styles.indicators}>
              {mediaList.map((_, idx) => (
                <div
                  key={idx}
                  className={`${styles.dot} ${idx === currentIndex ? styles.activeDot : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setCurrentIndex(idx);
                  }}
                  aria-label={`Go to slide ${idx + 1}`}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Thumbnail Strip */}
      {mediaList.length > 1 && (
        <div className={styles.thumbnailStrip}>
          {mediaList.map((img, idx) => (
            <div
              key={idx}
              className={`${styles.thumbnail} ${idx === currentIndex ? styles.activeThumbnail : ''}`}
              onClick={() => setCurrentIndex(idx)}
            >
              <OptimizedImage
                src={img}
                alt={`${title} thumbnail ${idx + 1}`}
                fill
                className={styles.thumbImg}
                useThumbnail={false}
              />
            </div>
          ))}
        </div>
      )}

      {/* Full-Screen Lightbox Modal */}
      {isFullScreen && !isVideo && (
        <div className={styles.modalOverlay} onClick={() => setIsFullScreen(false)}>
          <button 
            className={styles.closeModalBtn} 
            onClick={() => setIsFullScreen(false)}
            aria-label="Close full-screen viewer"
          >
            <X size={24} />
          </button>

          <div className={styles.modalStage} onClick={(e) => e.stopPropagation()}>
            <button className={`${styles.navArrow} ${styles.prevArrow}`} onClick={handlePrev}>
              <ChevronLeft size={28} />
            </button>

            <img
              src={currentMedia}
              alt={`${title} fullscreen`}
              className={styles.modalImage}
            />

            <button className={`${styles.navArrow} ${styles.nextArrow}`} onClick={handleNext}>
              <ChevronRight size={28} />
            </button>
          </div>

          <div className={styles.modalIndicators}>
            {mediaList.map((_, idx) => (
              <div
                key={idx}
                className={`${styles.dot} ${idx === currentIndex ? styles.activeDot : ''}`}
                onClick={() => setCurrentIndex(idx)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
