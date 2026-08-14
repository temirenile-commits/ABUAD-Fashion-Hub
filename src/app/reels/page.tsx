'use client';

import React, { useEffect, useState, useRef } from 'react';
import { Reel } from '@/types/reel';
import styles from './reels.module.css';
import { 
  ArrowLeft, Heart, MessageCircle, Share2, Volume2, VolumeX, 
  Play, ChevronUp, ChevronDown, X, Search, Download, 
  Loader2, Send, ShoppingBag, VideoOff, Info, CheckCircle, User
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function ReelsPage() {
  const router = useRouter();
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
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [activeProduct, setActiveProduct] = useState<any>(null);
  const [showIdentityCard, setShowIdentityCard] = useState<any>(null);

  // Double tap animation state
  const [showHeart, setShowHeart] = useState<{ id: string, x: number, y: number } | null>(null);
  const lastTap = useRef<number>(0);

  const videoRefs = useRef<{ [key: string]: HTMLVideoElement | null }>({});
  const cardRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  useEffect(() => {
    fetchReels();
  }, [activeSection]);

  const fetchReels = async (query = '') => {
    if (query) setIsSearching(true);
    else setLoading(true);
    
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
          setCurrentIndex(0);
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
    if (!searchQuery.trim()) return;
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
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || '';

      const res = await fetch('/api/reels/interact', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ action: 'like', reel_id: reelId })
      });
      const data = await res.json();
      if (data.success) {
        setReels(prev => prev.map(r => r.id === reelId ? { 
          ...r, 
          likes_count: data.liked ? (Number(r.likes_count) || 0) + 1 : Math.max(0, (Number(r.likes_count) || 1) - 1),
          is_liked: data.liked
        } : r));
        return data.liked;
      }
    } catch (err) {
      console.error('Like error:', err);
    }
    return false;
  };

  const handleVideoTap = async (e: React.MouseEvent, reelId: string) => {
    const now = Date.now();
    const DOUBLE_TAP_DELAY = 300;
    
    if (now - lastTap.current < DOUBLE_TAP_DELAY) {
      // Double tap detected
      const rect = (e.target as HTMLElement).getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      setShowHeart({ id: reelId, x, y });
      setTimeout(() => setShowHeart(null), 1000);
      
      await toggleLike(reelId);
    } else {
      // Single tap - toggle play/pause
      setIsPlaying(!isPlaying);
    }
    lastTap.current = now;
  };

  const submitComment = async (reelId: string) => {
    if (!newComment.trim() || isSubmittingComment) return;
    setIsSubmittingComment(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || '';

      const res = await fetch('/api/reels/interact', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ action: 'comment', reel_id: reelId, content: newComment })
      });
      const data = await res.json();
      if (data.success) {
        setComments(prev => [data.comment, ...prev]);
        setNewComment('');
        setReels(prev => prev.map(r => r.id === reelId ? { ...r, comments_count: (Number(r.comments_count) || 0) + 1 } : r));
      }
    } catch (err) {
      console.error('Comment error:', err);
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleIdentityClick = (comment: any) => {
    if (comment.author_type === 'vendor' && comment.author_brand_id) {
      const slug = comment.author_name?.toLowerCase().replace(/\s+/g, '-') || 'brand';
      router.push(`/vendor/${slug}?id=${comment.author_brand_id}`);
    } else {
      setShowIdentityCard(comment);
    }
  };

  const [downloadingReelId, setDownloadingReelId] = useState<string | null>(null);

  const handleDownload = async (reelId: string, title: string) => {
    if (downloadingReelId === reelId) return; // Prevent duplicate requests
    setDownloadingReelId(reelId);
    
    try {
      const res = await fetch(`/api/reels/download?id=${reelId}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to prepare video');
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const sanitizedTitle = (title || 'MasterCart_Reel').replace(/[^a-zA-Z0-9_-]/g, '_');
      a.download = `MasterCart_Reel_${sanitizedTitle}.mp4`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      console.error('Download error:', err);
      alert(err.message || 'Couldn\'t prepare this Reel for download. Please try again.');
    } finally {
      setDownloadingReelId(null);
    }
  };

  const currentReel = reels[currentIndex];

  if (loading && !reels.length) {
    return (
      <div className={styles.loadingContainer}>
        <Loader2 className={styles.animSpin} size={40} color="#fff" />
        <p style={{ fontSize: '1.1rem', fontWeight: 500, opacity: 0.8 }}>Entering Immersive Feed...</p>
      </div>
    );
  }

  // --- No Reels Empty State ---
  if (!loading && reels.length === 0 && !isSearchOpen) {
    return (
      <div className={styles.emptyStateContainer}>
        <div className={styles.emptyIconWrapper}>
          <VideoOff size={40} />
        </div>
        <h2 className={styles.emptyTitle}>No Reels Available</h2>
        <p className={styles.emptyDesc}>There are no reels available in this section right now. Check back later for fresh designs!</p>
        <Link href="/" className={styles.emptyBtn}>
          <ArrowLeft size={18} /> Back to Marketplace
        </Link>
      </div>
    );
  }

  return (
    <div className={styles.reelsContainer}>
      {/* Top Header */}
      <div className={styles.topHeader}>
        <button onClick={() => router.back()} className={styles.backBtn}>
          <ArrowLeft size={22} />
        </button>
        
        <div className={styles.searchPill} onClick={() => setIsSearchOpen(true)}>
          <Search size={18} />
          <span>Search Reels...</span>
        </div>

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
        </div>
      </div>

      {/* Search Modal / Overlay */}
      {isSearchOpen && (
        <div className={styles.searchOverlay}>
          <div className={styles.searchHeader}>
            <button className={styles.backBtn} onClick={() => { setIsSearchOpen(false); setSearchQuery(''); setSearchResults([]); }}>
              <ArrowLeft size={22} />
            </button>
            <form onSubmit={handleSearchSubmit} className={styles.searchForm}>
              <Search size={20} className={styles.searchIcon} />
              <input 
                type="text" 
                placeholder="Search sneakers, hoodies, watches..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                autoFocus
              />
            </form>
            <button className={styles.closeSearch} onClick={() => setIsSearchOpen(false)}>
              <X size={24} />
            </button>
          </div>

          <div className={styles.searchResultsGrid}>
            {isSearching ? (
              Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className={`${styles.searchGridCard} ${styles.skeleton}`} />
              ))
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
                    } else {
                      setReels([reel, ...reels]);
                      setCurrentIndex(0);
                    }
                    setIsSearchOpen(false);
                  }}
                >
                  <div style={{ position: 'relative', width: '100%', height: '100%', background: '#000' }}>
                    <img src={reel.cover_url || reel.thumbnail_url || reel.video_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', border: '1px solid rgba(255,255,255,0.2)' }}>
                        <Play size={16} fill="currentColor" />
                      </div>
                    </div>
                  </div>
                  <div className={styles.searchGridOverlay}>
                    <h5>{reel.title}</h5>
                    <span>@{reel.brands?.name}</span>
                  </div>
                </div>
              ))
            ) : searchQuery ? (
              <div style={{ gridColumn: '1 / -1', paddingTop: '4rem' }}>
                <div className={styles.emptyStateContainer} style={{ height: 'auto', background: 'transparent' }}>
                  <div className={styles.emptyIconWrapper}>
                    <Search size={40} />
                  </div>
                  <h2 className={styles.emptyTitle}>No Reels Found</h2>
                  <p className={styles.emptyDesc}>We couldn't find any reels matching "{searchQuery}". Try a different keyword.</p>
                  <button className={styles.emptyBtn} onClick={() => setSearchQuery('')}>
                    Clear Search
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ gridColumn: '1 / -1', padding: '3rem 2rem', textAlign: 'center', opacity: 0.5 }}>
                <Info size={40} style={{ margin: '0 auto 1rem auto', display: 'block' }} />
                <p>Type a keyword above to explore matching reels and products across campus brands.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Feed */}
      <div className={styles.feedWrapper}>
        {reels.map((reel, idx) => {
          const brandSlug = reel.brands?.name?.toLowerCase().replace(/\s+/g, '-') || 'brand';
          const attachedProducts = (reel.reel_products?.map(rp => rp.products).filter(Boolean) || []) as any[];

          return (
            <div 
              key={reel.id} 
              data-index={idx}
              ref={el => { cardRefs.current[reel.id] = el; }}
              className={styles.reelCard}
            >
              <div className={styles.videoWrapper} onClick={(e) => handleVideoTap(e, reel.id)}>
                <video
                  ref={el => { videoRefs.current[reel.id] = el; }}
                  src={reel.video_url}
                  poster={reel.cover_url || reel.thumbnail_url}
                  className={styles.videoPlayer}
                  loop
                  muted={isMuted}
                  playsInline
                />
                
                {showHeart && showHeart.id === reel.id && (
                  <div 
                    className={styles.heartAnimation} 
                    style={{ left: showHeart.x, top: showHeart.y }}
                  >
                    <Heart size={100} fill="#ff2d55" color="#ff2d55" />
                  </div>
                )}
              </div>

              {!isPlaying && idx === currentIndex && (
                <div className={styles.pauseIndicator} onClick={() => setIsPlaying(true)}>
                  <Play size={40} fill="white" color="white" />
                </div>
              )}

              <button className={styles.audioToggle} onClick={() => setIsMuted(!isMuted)}>
                {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
              </button>

              {/* Right Action Stack */}
              <div className={styles.actionStack}>
                <button className={styles.actionBtn} onClick={() => toggleLike(reel.id)}>
                  <Heart size={26} className={reel.is_liked ? styles.heartIconActive : ''} />
                  <span className={styles.actionCount}>{reel.likes_count || 0}</span>
                </button>
                <button className={styles.actionBtn} onClick={() => {
                  setComments(reel.reel_comments || []);
                  setShowComments(true);
                }}>
                  <MessageCircle size={26} />
                  <span className={styles.actionCount}>{reel.comments_count || 0}</span>
                </button>
                <button className={styles.actionBtn} onClick={() => {
                  const shareUrl = `${window.location.origin}/reels?id=${reel.id}`;
                  if (navigator.share) {
                    navigator.share({ title: reel.title, url: shareUrl });
                  } else {
                    navigator.clipboard.writeText(shareUrl);
                    alert('Link copied to clipboard!');
                  }
                }}>
                  <Share2 size={26} />
                </button>
                <button 
                  className={styles.actionBtn} 
                  onClick={() => handleDownload(reel.id, reel.title || 'reel')}
                  disabled={downloadingReelId === reel.id}
                  title={downloadingReelId === reel.id ? 'Preparing video with MasterCart outro...' : 'Download Reel'}
                >
                  {downloadingReelId === reel.id ? (
                    <div className={styles.animSpin} style={{ width: 26, height: 26, border: '3px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%' }} />
                  ) : (
                    <Download size={26} />
                  )}
                </button>
              </div>

              {/* Bottom Overlay */}
              <div className={styles.bottomOverlay}>
                <Link href={`/vendor/${brandSlug}?id=${reel.brand_id}`} className={styles.vendorInfo}>
                  {reel.brands?.logo_url ? (
                    <img src={reel.brands.logo_url} alt="" className={styles.vendorLogo} />
                  ) : (
                    <div className={styles.vendorLogoFallback}>{reel.brands?.name?.substring(0, 1)}</div>
                  )}
                  <div className={styles.vendorDetails}>
                    <h4 className={styles.vendorName}>
                      {reel.brands?.name} {reel.brands?.verified && <CheckCircle size={14} className={styles.verifiedBadge} fill="currentColor" />}
                    </h4>
                  </div>
                </Link>

                <h5 className={styles.reelTitle}>{reel.title}</h5>
                <p className={styles.reelCaption}>{reel.caption}</p>

                {attachedProducts.length > 0 && (
                  <div className={styles.productCarousel}>
                    {attachedProducts.map(product => (
                      <div key={product.id} className={styles.productCard} onClick={() => setActiveProduct(product)}>
                        <img src={product.image_url || product.media_urls?.[0]} alt="" className={styles.productImage} />
                        <div className={styles.productDetails}>
                          <h6 className={styles.productTitle}>{product.title}</h6>
                          <p className={styles.productPrice}>₦{product.price?.toLocaleString()}</p>
                        </div>
                        <button className={styles.viewBtn}>View</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

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
          <ChevronUp size={22} />
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
          <ChevronDown size={22} />
        </button>
      </div>

      {/* Comments Bottom Sheet */}
      {showComments && currentReel && (
        <div className={styles.drawerBackdrop} onClick={() => setShowComments(false)}>
          <div className={styles.commentsDrawer} onClick={e => e.stopPropagation()}>
            <div className={styles.drawerDragHandle} />
            <div className={styles.drawerHeader}>
              <h3>Comments ({comments.length})</h3>
              <button className={styles.closeDrawer} onClick={() => setShowComments(false)}>
                <X size={20} />
              </button>
            </div>
            <div className={styles.commentsList}>
              {comments.length === 0 ? (
                <div className={styles.noComments}>
                  <MessageCircle size={40} style={{ opacity: 0.2, margin: '0 auto 1rem auto', display: 'block' }} />
                  <p>No comments yet. Be the first to engage!</p>
                </div>
              ) : (
                comments.map((c, i) => (
                  <div key={i} className={styles.commentItem}>
                    <div className={styles.commentIdentity} onClick={() => handleIdentityClick(c)}>
                      {c.author_avatar ? (
                        <img src={c.author_avatar} alt="" className={styles.commentAvatarImg} />
                      ) : (
                        <div className={styles.commentAvatar}>
                          {c.author_name?.substring(0, 1) || 'U'}
                        </div>
                      )}
                    </div>
                    <div className={styles.commentContent}>
                      <div className={styles.commentUser} onClick={() => handleIdentityClick(c)} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        {c.author_type === 'customer' ? `@${c.author_name?.toLowerCase().replace(/\s+/g, '')}` : c.author_name}
                        {c.author_verified && <CheckCircle size={14} className={styles.verifiedBadgeSmall} fill="currentColor" />}
                      </div>
                      <p className={styles.commentText}>{c.content}</p>
                      <div className={styles.commentMeta}>
                        <span>{new Date(c.created_at || Date.now()).toLocaleDateString()}</span>
                        <span style={{ cursor: 'pointer' }}>Reply</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className={styles.commentInputBox}>
              <div className={styles.commentInputPill}>
                <input 
                  type="text" 
                  placeholder="Add a comment..." 
                  value={newComment}
                  onChange={e => setNewComment(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && submitComment(currentReel.id)}
                />
                <button 
                  className={styles.sendCommentBtn} 
                  onClick={() => submitComment(currentReel.id)}
                  disabled={!newComment.trim() || isSubmittingComment}
                >
                  {isSubmittingComment ? <Loader2 size={20} className={styles.animSpin} /> : <Send size={20} />}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Identity Card Modal */}
      {showIdentityCard && (
        <div className={styles.modalBackdrop} onClick={() => setShowIdentityCard(null)}>
          <div className={styles.identityCard} onClick={e => e.stopPropagation()}>
            <button className={styles.closeModal} onClick={() => setShowIdentityCard(null)}>
              <X size={20} />
            </button>
            
            {showIdentityCard.author_avatar ? (
              <img src={showIdentityCard.author_avatar} alt="" className={styles.cardAvatar} />
            ) : (
              <div className={styles.cardAvatar}>
                {showIdentityCard.author_name?.substring(0, 1) || 'U'}
              </div>
            )}
            
            <h3 className={styles.cardName}>
              {showIdentityCard.author_type === 'customer' 
                ? `@${showIdentityCard.author_name?.toLowerCase().replace(/\s+/g, '')}` 
                : showIdentityCard.author_name}
            </h3>
            <p className={styles.cardRole}>
              {showIdentityCard.author_type === 'vendor' ? 'Verified Vendor' : 'Customer'}
            </p>
            
            <div className={styles.cardDivider} />
            
            <div className={styles.cardPrivacyNotice}>
              <Info size={16} style={{ margin: '0 auto 8px auto', display: 'block', opacity: 0.5 }} />
              <p>
                {showIdentityCard.author_type === 'vendor' 
                  ? 'This is a public vendor profile. Tap to visit their store.' 
                  : 'Customer profiles are private to protect user data and activity.'}
              </p>
            </div>
            
            {showIdentityCard.author_type === 'vendor' && (
              <button 
                className="btn btn-primary w-full" 
                style={{ marginTop: '20px' }}
                onClick={() => {
                  const slug = showIdentityCard.author_name?.toLowerCase().replace(/\s+/g, '-') || 'brand';
                  router.push(`/vendor/${slug}?id=${showIdentityCard.author_brand_id}`);
                }}
              >
                Visit Store
              </button>
            )}
          </div>
        </div>
      )}

      {/* Product Quick View Modal */}
      {activeProduct && (
        <div className={styles.modalBackdrop} onClick={() => setActiveProduct(null)}>
          <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
            <button className={styles.closeModal} onClick={() => setActiveProduct(null)}>
              <X size={20} />
            </button>
            
            <img src={activeProduct.image_url || activeProduct.media_urls?.[0]} alt="" className={styles.modalImage} />
            <h3 className={styles.modalTitle}>{activeProduct.title}</h3>
            <p className={styles.modalPrice}>₦{activeProduct.price?.toLocaleString()}</p>
            <p className={styles.modalStock}>
              {activeProduct.stock_count > 0 ? `${activeProduct.stock_count} units in stock` : 'Out of stock'}
            </p>
            
            <button 
              className="btn btn-primary w-full"
              onClick={() => {
                const brandSlug = currentReel?.brands?.name?.toLowerCase().replace(/\s+/g, '-') || 'brand';
                router.push(`/vendor/${brandSlug}/product/${activeProduct.id}`);
              }}
            >
              View Full Details
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
