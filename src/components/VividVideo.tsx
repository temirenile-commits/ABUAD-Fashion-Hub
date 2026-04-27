'use client';

import { useEffect, useRef } from 'react';

interface Props {
  src: string;
  className?: string;
  style?: React.CSSProperties;
}

export default function VividVideo({ src, className, style }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Ensure muted is set on the DOM element specifically for browser compliance
    video.muted = true;
    video.defaultMuted = true;

    const playVideo = async () => {
      try {
        await video.play();
      } catch (err) {
        console.warn('Autoplay prevented, retrying on interaction or visibility change', err);
      }
    };

    // Use Intersection Observer to play when visible
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          playVideo();
        } else {
          video.pause();
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(video);

    return () => {
      observer.disconnect();
    };
  }, [src]);

  return (
    <video
      ref={videoRef}
      src={src}
      className={className}
      style={style}
      muted
      playsInline
      loop
      autoPlay
      preload="auto"
      onContextMenu={(e) => e.preventDefault()} // Premium feel
    />
  );
}
