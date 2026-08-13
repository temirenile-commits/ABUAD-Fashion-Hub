'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useMarketplaceStore } from '@/store/marketplaceStore';
import { Reel } from '@/types/reel';
import styles from './reels.module.css';
import { ArrowLeft, Heart, MessageCircle, Share2, Store, ShoppingBag, Volume2, VolumeX, Play, Pause, ChevronUp, ChevronDown, X } from 'lucide-react';
import Link from 'next/link';

export default function ReelsPage() {
  const [reels, setReels] = useState<Reel[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const [activeSection, setActiveSection] = useState<'fashion' | 'delicacies'>('fashion');
  
  // Modals & Sheets
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [activeProduct, setActiveProduct] = useState<any>(null);

  const videoRefs = useRef<{ [key: string]: HTMLVideoElement | null }>({});

  useEffect(() => {
    fetchReels();
  }, [activeSection]);

  const fetchReels = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/reels?section=${activeSection}`);
      const data = await res.json();
      if (data.success) {
        setReels(data.reels || []);
      }
    } catch (err) {
      console.error('Failed to load reels:', err);
    } finally {
      setLoading(false);
    }
  };

  const currentReel = reels[currentIndex];

  useEffect(() => {
    // Handle video autoplay & pausing across indices
    Object.keys(videoRefs.current).forEach((id, idx) => {
      const v = videoRefs.current[id];
      if (!v) return;
      if (idx === currentIndex) {
        if (isPlaying) {
          v.play().catch(() => setIsMuted(true));
        } else {
          v.pause();
        }
      } else {
        v.pause();
        v.currentTime = 0;
      }
    });
  }, [currentIndex, isPlaying, reels]);

  const handleScroll = (e: React.WheelEvent) => {
    if (e.deltaY > 30 && currentIndex < reels.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setIsPlaying(true);
    } else if (e.deltaY < -30 && currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
      setIsPlaying(true);
    }
  };

  const toggleLike = async (reelId: string) => {
    try {
      const res = await fetch('/api/reels/interact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'like', reel_id: reelId, user_id: 'anonymous-user' })
      });
      const data = await res.json();
      if (data.success) {
        setReels(prev => prev.map(r => r.id === reelId ? { ...r, likes_count: data.liked ? r.likes_count + 1 : r.likes_count - 1 } : r));
      }
    } catch (err) {
      console.error('Like error:', err);
    }
  };

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner} />
        <p>Loading Immersive Reels...</p>
      </div>
    );
  }

  return (
    <div className={styles.reelsContainer} onWheel={handleScroll}>
      {/* Top Header */}
      <div className={styles.topHeader}>
        <Link href="/" className={styles.backBtn}><ArrowLeft size={24} /></Link>
        <div className={styles.tabSwitcher}>
          <button 
            className={activeSection === 'fashion' ? styles.activeTab : styles.tab} 
            onClick={() => setActiveSection('fashion')}
          >
            Fashion
          </button>
          <button 
            className={activeSection === 'delicacies' ? styles.activeTab : styles.tab} 
            onClick={() => setActiveSection('delicacies')}
          >
            Delicacies
          </button>
        </div>
      </div>

      {reels.length === 0 ? (
        <div className={styles.emptyFeed}>
          <h3>No Reels Available</h3>
          <p>Vendors haven't posted any reels in this section yet.</p>
          <Link href="/" className="btn btn-primary" style={{ marginTop: '1rem' }}>Return to Marketplace</Link>
        </div>
      ) : (
        <div className={styles.feedWrapper} style={{ transform: `translateY(-${currentIndex * 100}vh)` }}>
          {reels.map((reel, idx) => {
            const brandSlug = reel.brands?.name?.toLowerCase().replace(/\s+/g, '-') || 'brand';
            const attachedProduct = reel.reel_products?.[0]?.products;

            return (
              <div key={reel.id} className={styles.reelCard}>
                <video
                  ref={el => { videoRefs.current[reel.id] = el; }}
                  src={reel.video_url}
                  className={styles.videoPlayer}
                  loop
                  muted={isMuted}
                  playsInline
                  onClick={() => setIsPlaying(!isPlaying)}
                />

                {/* Play/Pause indicator overlay */}
                {!isPlaying && idx === currentIndex && (
                  <div className={styles.pauseIndicator} onClick={() => setIsPlaying(true)}>
                    <Play size={48} fill="white" />
                  </div>
                )}

                {/* Audio Mute/Unmute */}
                <button className={styles.audioToggle} onClick={() => setIsMuted(!isMuted)}>
                  {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
                </button>

                {/* Right Action Stack */}
                <div className={styles.actionStack}>
                  <button className={styles.actionBtn} onClick={() => toggleLike(reel.id)}>
                    <Heart size={28} className={styles.heartIcon} />
                    <span>{reel.likes_count}</span>
                  </button>
                  <button className={styles.actionBtn} onClick={() => setShowComments(true)}>
                    <MessageCircle size={28} />
                    <span>{reel.comments_count}</span>
                  </button>
                  <button className={styles.actionBtn} onClick={() => {
                    if (navigator.share) {
                      navigator.share({ title: reel.title, url: window.location.href });
                    } else {
                      navigator.clipboard.writeText(window.location.href);
                      alert('Link copied to clipboard!');
                    }
                  }}>
                    <Share2 size={28} />
                    <span>Share</span>
                  </button>
                </div>

                {/* Bottom Overlay & Product Card */}
                <div className={styles.bottomOverlay}>
                  <Link href={`/vendor/${brandSlug}?id=${reel.brand_id}`} className={styles.vendorInfo}>
                    {reel.brands?.logo_url ? (
                      <img src={reel.brands.logo_url} alt="" className={styles.vendorLogo} />
                    ) : (
                      <div className={styles.vendorLogoFallback}>{reel.brands?.name?.substring(0, 1)}</div>
                    )}
                    <div>
                      <h4 className={styles.vendorName}>{reel.brands?.name} {reel.brands?.verified && '✓'}</h4>
                      <p className={styles.reelTitle}>{reel.title || reel.caption}</p>
                    </div>
                  </Link>

                  {/* Attached Product Card */}
                  {attachedProduct && (
                    <div className={styles.productCard} onClick={() => setActiveProduct(attachedProduct)}>
                      <img src={attachedProduct.image_url || attachedProduct.media_urls?.[0]} alt="" />
                      <div className={styles.productDetails}>
                        <h5>{attachedProduct.title}</h5>
                        <p>₦{attachedProduct.price?.toLocaleString()}</p>
                      </div>
                      <button className={styles.viewProductBtn}>View →</button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Navigation Chevrons for Desktop */}
      <div className={styles.navChevrons}>
        <button 
          disabled={currentIndex === 0} 
          onClick={() => { setCurrentIndex(prev => Math.max(0, prev - 1)); setIsPlaying(true); }}
        >
          <ChevronUp size={24} />
        </button>
        <button 
          disabled={currentIndex === reels.length - 1} 
          onClick={() => { setCurrentIndex(prev => Math.min(reels.length - 1, prev + 1)); setIsPlaying(true); }}
        >
          <ChevronDown size={24} />
        </button>
      </div>

      {/* Product Quick View Modal */}
      {activeProduct && (
        <div className={styles.modalBackdrop} onClick={() => setActiveProduct(null)}>
          <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
            <button className={styles.closeModal} onClick={() => setActiveProduct(null)}><X size={24} /></button>
            <img src={activeProduct.image_url || activeProduct.media_urls?.[0]} alt="" className={styles.modalImage} />
            <h3>{activeProduct.title}</h3>
            <p className={styles.modalPrice}>₦{activeProduct.price?.toLocaleString()}</p>
            <p className={styles.modalStock}>In Stock: {activeProduct.stock_count}</p>
            <Link href={`/product/${activeProduct.id}`} className="btn btn-primary" style={{ width: '100%', textAlign: 'center', marginTop: '1rem' }}>
              View Full Product Page & Cart
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
