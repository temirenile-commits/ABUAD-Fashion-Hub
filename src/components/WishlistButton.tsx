'use client';
import { useState, useEffect } from 'react';
import { Heart, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface Props {
  productId: string;
  size?: number;
  className?: string;
}

export default function WishlistButton({ productId, size = 16, className }: Props) {
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    const checkStatus = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from('wishlists')
        .select('id')
        .eq('user_id', session.user.id)
        .eq('product_id', productId)
        .single();
      
      if (data) setIsWishlisted(true);
      setLoading(false);
    };
    checkStatus();
  }, [productId]);

  const toggleWishlist = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return alert('Please login to wishlist items!');

    setProcessing(true);
    if (isWishlisted) {
      const { error } = await supabase
        .from('wishlists')
        .delete()
        .eq('user_id', session.user.id)
        .eq('product_id', productId);
      if (!error) setIsWishlisted(false);
    } else {
      const { error } = await supabase
        .from('wishlists')
        .insert({ user_id: session.user.id, product_id: productId });
      if (!error) setIsWishlisted(true);
    }
    setProcessing(false);
  };

  if (loading) return null;

  return (
    <button 
      className={className}
      onClick={toggleWishlist}
      disabled={processing}
      aria-label="Toggle wishlist"
      style={!className ? {
        position: 'absolute', top: '0.5rem', right: '0.5rem', zIndex: 10, 
        background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(4px)', 
        border: 'none', borderRadius: '50%', width: '32px', height: '32px', 
        display: 'flex', alignItems: 'center', justifyContent: 'center', 
        cursor: 'pointer', color: isWishlisted ? '#ef4444' : '#fff'
      } : undefined}
    >
      {processing ? (
        <Loader2 size={size} className="animate-spin" />
      ) : (
        <Heart size={size} fill={isWishlisted ? "#ef4444" : "none"} color={isWishlisted ? "#ef4444" : "currentColor"} />
      )}
    </button>
  );
}
