'use client';
import { useState, useEffect } from 'react';
import { Heart } from 'lucide-react';

interface Props {
  productId: string;
  size?: number;
  className?: string;
}

export default function WishlistButton({ productId, size = 16, className }: Props) {
  const [isWishlisted, setIsWishlisted] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('wishlist');
    if (saved) {
      const list = JSON.parse(saved);
      if (list.includes(productId)) setIsWishlisted(true);
    }
  }, [productId]);

  const toggleWishlist = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const saved = localStorage.getItem('wishlist');
    let list = saved ? JSON.parse(saved) : [];
    if (list.includes(productId)) {
      list = list.filter((id: string) => id !== productId);
      setIsWishlisted(false);
    } else {
      list.push(productId);
      setIsWishlisted(true);
    }
    localStorage.setItem('wishlist', JSON.stringify(list));
  };

  return (
    <button 
      className={className}
      onClick={toggleWishlist}
      aria-label="Toggle wishlist"
      style={!className ? {
        position: 'absolute', top: '0.5rem', right: '0.5rem', zIndex: 10, 
        background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(4px)', 
        border: 'none', borderRadius: '50%', width: '32px', height: '32px', 
        display: 'flex', alignItems: 'center', justifyContent: 'center', 
        cursor: 'pointer', color: isWishlisted ? '#ef4444' : '#fff'
      } : undefined}
    >
      <Heart size={size} fill={isWishlisted ? "#ef4444" : "none"} color={isWishlisted ? "#ef4444" : "currentColor"} />
    </button>
  );
}
