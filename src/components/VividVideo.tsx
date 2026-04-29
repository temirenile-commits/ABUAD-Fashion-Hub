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
    if (!video || !src) return;

    video.muted = false;
    (video as any).defaultMuted = false;
    video.setAttribute('playsinline', '');

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            video.play().catch(() => {});
          } else {
            video.pause();
          }
        });
      },
      { threshold: 0.2 } // Play when 20% visible
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
      playsInline
      loop
      preload="auto"
      crossOrigin="anonymous"
    />
  );
}
