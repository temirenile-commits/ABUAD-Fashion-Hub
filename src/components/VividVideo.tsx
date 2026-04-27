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

    // Force mute at DOM level — needed for Safari/iOS autoplay policy
    video.muted = true;
    (video as any).defaultMuted = true;
    video.setAttribute('muted', '');
    video.setAttribute('playsinline', '');

    // Attempt to play once on mount
    const tryPlay = () => {
      video.play().catch(() => {
        // If autoplay is blocked, retry on first user touch/click
        const unlock = () => {
          video.play().catch(() => {});
          document.removeEventListener('click', unlock);
          document.removeEventListener('touchstart', unlock);
        };
        document.addEventListener('click', unlock, { once: true });
        document.addEventListener('touchstart', unlock, { once: true });
      });
    };

    // IntersectionObserver: play when visible, pause when not
    // We do NOT call load() here — only play/pause
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          video.play().catch(() => {});
        } else {
          video.pause();
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(video);
    tryPlay();

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
    />
  );
}
