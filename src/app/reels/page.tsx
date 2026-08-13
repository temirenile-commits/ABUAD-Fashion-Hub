'use client';

import React, { useEffect, useState, useRef } from 'react';
import { Reel } from '@/types/reel';
import styles from './reels.module.css';
import { ArrowLeft, Heart, MessageCircle, Share2, Volume2, VolumeX, Play, ChevronUp, ChevronDown, X, Search } from 'lucide-react';
import Link from 'next/link';

export default function ReelsPage() {
  const [reels, setReels] = useState<Reel[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const [activeSection, setActiveSection] = useState<'fashion' | 'delicacies' | 'all'>('all');
  
  // Search state
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Reel[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Modals & Sheets
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [activeProduct, setActiveProduct] = useState<any>(null);

  const videoRefs = useRef<{ [key: string]: HTMLVideoElement | null }>({});
  const cardRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  useEffect(() => {
    fetchReels();
  }, [activeSection]);

  const fetchReels = async (query = '') => {
    setLoading(true);
    try {
      const url = query 
        ? `/api/reels?search=${encodeURIComponent(query)}`
        : `/api/reels?section=${activeSection}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        if (query) {
          setSearchResults(data.reels || []);
        } else {
          setReels(data.reels || []);
        }
      }
    } catch (err) {
      console.error('Failed to load reels:', err);
    } finally {
      setLoading(false);
      setIsSearching(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    fetchReels(searchQuery);
  };

  // Intersection observer for native scroll snap tracking
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const indexStr = entry.target.getAttribute('data-index');
            if (indexStr !== null) {
              const idx = parseInt(indexStr, 10);
              setCurrentIndex(idx);
              setIsPlaying(true);
            }
          }
        });
      },
      { threshold: 0.6 }
    );

    Object.values(cardRefs.current).forEach((card) => {
      if (card) observer.observe(card);
    });

    return () => {
      observer.disconnect();
    };
  }, [reels]);

  // Video autoplay & pausing across indices
  useEffect(() => {
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

  const toggleLike = async (reelId: string) => {
    try {
      const res = await fetch('/api/reels/interact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'like', reel_id: reelId })
      });
      const data = await res.json();
      if (data.success) {
        setReels(prev => prev.map(r => r.id === reelId ? { ...r, likes_count: data.liked ? (r.likes_count || 0) + 1 : Math.max(0, (r.likes_count || 1) - 1) } : r));
      }
    } catch (err) {
      console.error('Like error:', err);
    }
  };

  const submitComment = async (reelId: string) => {
    if (!newComment.trim()) return;
    try {
      const res = await fetch('/api/reels/interact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'comment', reel_id: reelId, content: newComment })
      });
      const data = await res.json();
      if (data.success) {
        setComments(prev => [...prev, data.comment]);
        setNewComment('');
        setReels(prev => prev.map(r => r.id === reelId ? { ...r, comments_count: (r.comments_count || 0) + 1 } : r));
      }
    } catch (err) {
      console.error('Comment error:', err);
    }
  };

  const currentReel = reels[currentIndex];

  if (loading && !reels.length) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner} />
        <p>Loading Immersive Reels...</p>
      </div>
    );
  }

  return (
    <div className={styles.reelsContainer}>
      {/* Top Header */}
      <div className={styles.topHeader}>
        <Link href="/" className={styles.backBtn}><ArrowLeft size={24} /></Link>
        <div className={styles.tabSwitcher}>
          <button 
            className={activeSection === 'all' ? styles.activeTab : styles.tab} 
            onClick={() => setActiveSection('all')}
          >
            All
          </button>
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
        <button className={styles.searchToggleBtn} onClick={() => setIsSearchOpen(true)}>
          <Search size={22} />
        </button>
      </div>

      {/* Search Modal / Overlay */}
      {isSearchOpen && (
        <div className={styles.searchOverlay}>
          <div className={styles.searchHeader}>
            <button className={styles.backBtn} onClick={() => { setIsSearchOpen(false); setSearchQuery(''); setSearchResults([]); }}>
              <ArrowLeft size={22} />
            </button>
            <form onSubmit={handleSearchSubmit} className={styles.searchForm}>
              <Search size={18} className={styles.searchIcon} />
              <input 
                type="text" 
                placeholder="Search sneakers, black hoodie, wrist watch, cakes..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                autoFocus
              />
            </form>
            <button className={styles.closeSearch} onClick={() => setIsSearchOpen(false)}>
              <X size={22} />
            </button>
          </div>

          <div className={styles.searchResultsGrid}>
            {isSearching ? (
              <div className={styles.searchLoading}>Searching reels & products...</div>
            ) : searchResults.length > 0 ? (
              searchResults.map(reel => (
                <div 
                  key={reel.id} 
                  className={styles.searchGridCard}
                  onClick={() => {
                    const idx = reels.findIndex(r => r.id === reel.id);
                    if (idx !== -1) {
                      setCurrentIndex(idx);
                      cardRefs.current[reel.id]?.scrollIntoView({ behavior: 'smooth' });
                    }
                    setIsSearchOpen(false);
                  }}
                >
                  <img src={reel.thumbnail_url || reel.video_url} alt="" />
                  <div className={styles.searchGridOverlay}>
                    <h5>{reel.title || reel.caption}</h5>
                    <span>@{reel.brands?.name}</span>
                  </div>
                </div>
              ))
            ) : searchQuery ? (
              <div className={styles.emptySearch}>No reels found matching "{searchQuery}"</div>
            ) : (
              <div className={styles.searchPrompt}>Type a keyword above to explore matching reels and products across campus brands.</div>
            )}
          </div>
        </div>
      )}

      {reels.length === 0 ? (
        <div className={styles.emptyFeed}>
          <h3>No Reels Available</h3>
          <p>Vendors haven't posted any reels in this section yet.</p>
          <Link href="/" className="btn btn-primary" style={{ marginTop: '1rem' }}>Return to Marketplace</Link>
        </div>
      ) : (
        <div className={styles.feedWrapper}>
          {reels.map((reel, idx) => {
            const brandSlug = reel.brands?.name?.toLowerCase().replace(/\s+/g, '-') || 'brand';
            const attachedProduct = reel.reel_products?.[0]?.products;

            return (
              <div 
                key={reel.id} 
                data-index={idx}
                ref={el => { cardRefs.current[reel.id] = el; }}
                className={styles.reelCard}
              >
                <video
                  ref={el => { videoRefs.current[reel.id] = el; }}
                  src={reel.video_url}
                  className={styles.videoPlayer}
                  loop
                  muted={isMuted}
                  playsInline
                  onClick={() => setIsPlaying(!isPlaying)}
                />

                {!isPlaying && idx === currentIndex && (
                  <div className={styles.pauseIndicator} onClick={() => setIsPlaying(true)}>
                    <Play size={48} fill="white" />
                  </div>
                )}

                <button className={styles.audioToggle} onClick={() => setIsMuted(!isMuted)}>
                  {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
                </button>

                {/* Right Action Stack */}
                <div className={styles.actionStack}>
                  <button className={styles.actionBtn} onClick={() => toggleLike(reel.id)}>
                    <Heart size={28} className={styles.heartIcon} />
                    <span>{reel.likes_count || 0}</span>
                  </button>
                  <button className={styles.actionBtn} onClick={() => {
                    setComments(reel.reel_comments || []);
                    setShowComments(true);
                  }}>
                    <MessageCircle size={28} />
                    <span>{reel.comments_count || reel.reel_comments?.length || 0}</span>
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
                      <p className={styles.reelTitle}><strong>{reel.title}</strong> {reel.caption}</p>
                    </div>
                  </Link>

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
          onClick={() => {
            const prevIdx = Math.max(0, currentIndex - 1);
            setCurrentIndex(prevIdx);
            const reelId = reels[prevIdx]?.id;
            if (reelId) cardRefs.current[reelId]?.scrollIntoView({ behavior: 'smooth' });
          }}
        >
          <ChevronUp size={24} />
        </button>
        <button 
          disabled={currentIndex === reels.length - 1} 
          onClick={() => {
            const nextIdx = Math.min(reels.length - 1, currentIndex + 1);
            setCurrentIndex(nextIdx);
            const reelId = reels[nextIdx]?.id;
            if (reelId) cardRefs.current[reelId]?.scrollIntoView({ behavior: 'smooth' });
          }}
        >
          <ChevronDown size={24} />
        </button>
      </div>

      {/* Comments Drawer */}
      {showComments && currentReel && (
        <div className={styles.drawerBackdrop} onClick={() => setShowComments(false)}>
          <div className={styles.commentsDrawer} onClick={e => e.stopPropagation()}>
            <div className={styles.drawerHeader}>
              <h3>Comments ({comments.length})</h3>
              <button onClick={() => setShowComments(false)}><X size={20} /></button>
            </div>
            <div className={styles.commentsList}>
              {comments.length === 0 ? (
                <p className={styles.noComments}>No comments yet. Be the first to comment!</p>
              ) : (
                comments.map((c, i) => (
                  <div key={i} className={styles.commentItem}>
                    <div className={styles.commentUser}>User</div>
                    <p>{c.content}</p>
                    <span className={styles.commentTime}>{new Date(c.created_at || Date.now()).toLocaleDateString()}</span>
                  </div>
                ))
              )}
            </div>
            <div className={styles.commentInputBox}>
              <input 
                type="text" 
                placeholder="Add a comment..." 
                value={newComment}
                onChange={e => setNewComment(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && submitComment(currentReel.id)}
              />
              <button onClick={() => submitComment(currentReel.id)}>Post</button>
            </div>
          </div>
        </div>
      )}

      {/* Product Quick View Modal */}
      {activeProduct && (
        <div className={styles.modalBackdrop} onClick={() => setActiveProduct(null)}>
          <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
            <button className={styles.closeModal} onClick={() => setActiveProduct(null)}><X size={24} /></button>
            <img src={activeProduct.image_url || activeProduct.media_urls?.[0]} alt="" className={styles.modalImage} />
            <h3>{activeProduct.title}</h3>
            <p className={styles.modalPrice}>₦{activeProduct.price?.toLocaleString()}</p>
            <p className={styles.modalStock}>In Stock: {activeProduct.stock_count || 'Available'}</p>
            <Link href={`/product/${activeProduct.id}`} className="btn btn-primary" style={{ width: '100%', textAlign: 'center', marginTop: '1rem', display: 'block' }}>
              View Full Product Page & Cart
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
