'use client';

import React from 'react';
import { Share2, Link as LinkIcon, Check } from 'lucide-react';

interface ShareProductButtonProps {
  productId: string;
  productTitle: string;
  productPrice?: number;
  className?: string;
}

export default function ShareProductButton({
  productId,
  productTitle,
  productPrice,
  className = ''
}: ShareProductButtonProps) {
  const [copied, setCopied] = React.useState(false);

  const handleShare = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const shareUrl = `${window.location.origin}/product/${productId}`;
    
    const formattedPrice = productPrice 
      ? new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 0 }).format(productPrice) 
      : '';

    const shareText = productPrice 
      ? `Check out ${productTitle} for only ${formattedPrice} on MasterCart! 🛍️`
      : `Check out ${productTitle} on MasterCart! 🛍️`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'MasterCart',
          text: shareText,
          url: shareUrl,
        });
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          console.error('Error sharing:', err);
          copyFallback(shareUrl);
        }
      }
    } else {
      copyFallback(shareUrl);
    }
  };

  const copyFallback = (url: string) => {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <button
      onClick={handleShare}
      className={`${className}`}
      title="Share Product"
      aria-label="Share product link"
    >
      {copied ? (
        <>
          <Check size={16} />
          <span>Copied!</span>
        </>
      ) : (
        <>
          <Share2 size={16} />
          <span>Share</span>
        </>
      )}
    </button>
  );
}
