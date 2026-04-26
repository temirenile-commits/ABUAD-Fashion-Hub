'use client';
import { useState, useEffect } from 'react';
import { MessageCircle, Users } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { supabase } from '@/lib/supabase';

interface Props {
  vendorId: string;
  vendorName: string;
  whatsappNumber: string;
  initialFollowers: number;
}

export default function VendorActions({ vendorId, vendorName, whatsappNumber, initialFollowers }: Props) {
  const [isFollowing, setIsFollowing] = useState(false);
  const [followersCount, setFollowersCount] = useState(initialFollowers);
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    async function checkFollow() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUser(session.user);
        const { data } = await supabase
          .from('follows')
          .select('id')
          .eq('follower_id', session.user.id)
          .eq('brand_id', vendorId)
          .single();
        
        if (data) setIsFollowing(true);
      }
    }
    checkFollow();
  }, [vendorId]);

  const handleFollow = async () => {
    if (!user) {
      toast.error('Log in to follow this brand!');
      return;
    }
    
    setLoading(true);
    const action = isFollowing ? 'unfollow' : 'follow';
    
    try {
      const res = await fetch('/api/vendor/follow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, brandId: vendorId, action })
      });
      const data = await res.json();
      
      if (data.success) {
        setIsFollowing(!isFollowing);
        setFollowersCount(data.count);
        toast.success(isFollowing ? `Unfollowed ${vendorName}` : `Now following ${vendorName}! 🚀`);
      } else {
        toast.error(data.error || 'Failed to update follow status');
      }
    } catch (err) {
      toast.error('Connection error. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const waMessage = `Hi ${vendorName}! I found you on ABUAD Fashion Hub. I'd love to know more about your products.`;
  // Normalize to Nigerian format: strip +, leading 0, then prepend 234
  const normalizeNgPhone = (num: string) => {
    const digits = (num || '').replace(/\D/g, '');
    if (digits.startsWith('234')) return digits;
    if (digits.startsWith('0')) return '234' + digits.slice(1);
    if (digits.length === 10) return '234' + digits;
    return digits || '2348000000000';
  };
  const whatsapp = normalizeNgPhone(whatsappNumber);

  return (
    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
      <a
        href={`https://wa.me/${whatsapp}?text=${encodeURIComponent(waMessage)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="btn btn-whatsapp"
        style={{ flex: 1, minWidth: '140px' }}
      >
        <MessageCircle size={16} /> Chat Vendor
      </a>
      <button 
        className={`btn ${isFollowing ? 'btn-secondary' : 'btn-primary'}`} 
        onClick={handleFollow}
        disabled={loading}
        style={{ flex: 1, minWidth: '140px' }}
      >
        <Users size={16} />
        {loading ? '...' : isFollowing ? 'Following' : 'Follow'}
      </button>
    </div>
  );
}
