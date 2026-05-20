'use client';

import React, { useState, useEffect } from 'react';
import { toThumbUrl } from '@/lib/storage';

interface OptimizedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  useThumbnail?: boolean;
  fill?: boolean;
  priority?: boolean;
}

export default function OptimizedImage({
  src,
  alt,
  useThumbnail = true,
  fill = false,
  priority = false,
  style,
  className,
  onError,
  ...props
}: OptimizedImageProps) {
  const [currentSrc, setCurrentSrc] = useState<string>(src);
  const [isFallback, setIsFallback] = useState<boolean>(false);

  useEffect(() => {
    // If the src changes, reset state
    setIsFallback(false);
    
    // Check if we should try the thumbnail first
    const isSupabase = src?.includes('supabase.co');
    if (useThumbnail && isSupabase && !src.includes('_thumb.webp')) {
      setCurrentSrc(toThumbUrl(src));
    } else {
      setCurrentSrc(src);
    }
  }, [src, useThumbnail]);

  const handleError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    // If thumbnail failed to load, fall back to the original full-res URL
    if (useThumbnail && !isFallback && src && currentSrc !== src) {
      setIsFallback(true);
      setCurrentSrc(src);
    } else if (onError) {
      onError(e);
    }
  };

  // Replicate Next.js fill layout if requested to preserve premium visual layout/aspect ratios
  const fillStyles: React.CSSProperties = fill
    ? {
        position: 'absolute',
        height: '100%',
        width: '100%',
        left: 0,
        top: 0,
        right: 0,
        bottom: 0,
        objectFit: 'cover',
        objectPosition: 'center',
      }
    : {};

  const mergedStyles: React.CSSProperties = {
    ...fillStyles,
    ...style,
  };

  return (
    <img
      src={currentSrc}
      alt={alt}
      loading={priority ? 'eager' : 'lazy'}
      onError={handleError}
      style={mergedStyles}
      className={className}
      {...props}
    />
  );
}
