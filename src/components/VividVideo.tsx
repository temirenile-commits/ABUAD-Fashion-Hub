'use client';

import { useEffect, useId, useRef, useState } from 'react';

interface Props {
  src: string;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Advanced VividVideo Component
 * Features:
 * 1. Global Audio Focus: Only one video plays sound at a time.
 * 2. Intelligent Intersection: Autoplays when visible, pauses when out of view.
 * 3. Priority Unmuting: Unmutes automatically when most prominent on screen (>60% visibility).
 */
export default function VividVideo({ src, className, style }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  // Generate a stable unique ID for this instance using useId
  const uid = useId();
  const instanceId = useRef(`vid_${uid.replace(/:/g, '')}`);
  const [isMuted, setIsMuted] = useState(true);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    // Initial setup: start muted to satisfy browser autoplay policies
    video.muted = true;
    video.setAttribute('playsinline', '');

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            // Play video when it enters view
            video.play().catch(() => {
              // Fallback for browsers that block autoplay
              console.log('Autoplay blocked, waiting for interaction');
            });

            // If video is prominently visible (>60%), request audio focus
            if (entry.intersectionRatio > 0.6) {
              const focusEvent = new CustomEvent('af-video-request-focus', { 
                detail: { id: instanceId.current } 
              });
              window.dispatchEvent(focusEvent);
            }
          } else {
            // Pause when out of view to save resources
            video.pause();
          }
        });
      },
      { 
        // Monitor visibility at multiple thresholds
        threshold: [0.1, 0.6, 0.9],
        rootMargin: '0px'
      }
    );

    // Listener for audio focus changes
    const handleFocusChange = (e: Event) => {
      const detail = (e as CustomEvent<{ id: string }>).detail;
      if (detail.id === instanceId.current) {
        // We have focus! Unmute.
        video.muted = false;
        setIsMuted(false);
      } else {
        // Someone else has focus. Mute.
        video.muted = true;
        setIsMuted(true);
      }
    };

    window.addEventListener('af-video-request-focus', handleFocusChange);
    observer.observe(video);

    return () => {
      observer.disconnect();
      window.removeEventListener('af-video-request-focus', handleFocusChange);
    };
  }, [src]);

  return (
    <video
      ref={videoRef}
      src={src}
      className={className}
      style={style}
      playsInline
      loop
      muted={isMuted}
      preload="auto"
      crossOrigin="anonymous"
    />
  );
}
