'use client';

interface Props {
  src: string;
  className?: string;
  style?: React.CSSProperties;
}

export default function VividVideo({ src, className, style }: Props) {
  return (
    <video
      src={src}
      className={className}
      style={style}
      muted
      playsInline
      loop
      autoPlay
      preload="auto"
      crossOrigin="anonymous"
      // Hack for React to force these attributes into the DOM immediately
      ref={(el) => {
        if (el) {
          el.muted = true;
          el.defaultMuted = true;
          el.setAttribute('playsinline', '');
          el.setAttribute('muted', '');
          el.play().catch(() => {});
        }
      }}
    />
  );
}
