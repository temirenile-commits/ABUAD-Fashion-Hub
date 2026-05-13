/* eslint-disable @next/next/no-img-element */
'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { UtensilsCrossed, Star, ArrowRight, Clock } from 'lucide-react';

interface DelicacyItem {
  id: string;
  title: string;
  price: number;
  image_url?: string;
  media_urls?: string[];
  rating?: number;
  delicacy_category?: string;
  brands?: { name?: string; is_available_now?: boolean };
}

export default function DelicaciesPreview({ universityId }: { universityId?: string }) {
  const [items, setItems] = useState<DelicacyItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!universityId) { setLoading(false); return; }
    const fetch_ = async () => {
      try {
        const res = await fetch(`/api/delicacies?universityId=${universityId}&limit=8`);
        const data = await res.json();
        setItems(data.products || []);
      } catch { /* silent */ }
      finally { setLoading(false); }
    };
    fetch_();
  }, [universityId]);

  if (!loading && items.length === 0) return null;

  const CATEGORY_EMOJIS: Record<string, string> = {
    snacks: '🍟', drinks: '🥤', pastries: '🥐',
    provisions: '🛒', small_chops: '🍢', beverages: '☕', other: '🍽️'
  };

  return (
    <section style={{ marginTop: '2.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <UtensilsCrossed size={22} style={{ color: '#f59e0b' }} />
          <h2 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0 }}>
            MasterCart Delicacies
          </h2>
          <span style={{
            background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
            color: '#fff',
            fontSize: '0.6rem',
            fontWeight: 700,
            padding: '2px 7px',
            borderRadius: '999px',
            letterSpacing: '0.04em'
          }}>CAMPUS EATS</span>
        </div>
        <Link href="/delicacies" style={{
          display: 'flex', alignItems: 'center', gap: '0.3rem',
          color: '#f59e0b', fontSize: '0.85rem', fontWeight: 600, textDecoration: 'none'
        }}>
          View all <ArrowRight size={14} />
        </Link>
      </div>

      {loading ? (
        <div style={{ display: 'flex', gap: '1rem', overflowX: 'auto' }}>
          {[...Array(4)].map((_, i) => (
            <div key={i} style={{
              minWidth: 160, height: 220, borderRadius: 12,
              background: 'var(--bg-200)', flexShrink: 0,
              animation: 'pulse 1.5s infinite'
            }} />
          ))}
        </div>
      ) : (
        <div style={{
          display: 'flex', gap: '1rem', overflowX: 'auto',
          paddingBottom: '0.5rem', scrollbarWidth: 'none'
        }}>
          {items.map((item) => {
            const brand = Array.isArray(item.brands) ? item.brands[0] : item.brands;
            const img = item.image_url || item.media_urls?.[0];
            const emoji = CATEGORY_EMOJIS[item.delicacy_category || 'other'];
            const isOpen = brand?.is_available_now !== false;

            return (
              <Link key={item.id} href={`/product/${item.id}`} style={{ textDecoration: 'none', flexShrink: 0 }}>
                <div style={{
                  width: 158,
                  borderRadius: 12,
                  overflow: 'hidden',
                  background: 'var(--bg-100)',
                  border: '1px solid var(--border)',
                  transition: 'transform 0.2s',
                  cursor: 'pointer',
                }}
                  onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-3px)')}
                  onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}
                >
                  <div style={{ position: 'relative', height: 120, background: 'var(--bg-200)' }}>
                    {img ? (
                      <img src={img} alt={item.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.5rem' }}>
                        {emoji}
                      </div>
                    )}
                    {/* Availability badge */}
                    <span style={{
                      position: 'absolute', top: 6, right: 6,
                      background: isOpen ? 'rgba(16,185,129,0.9)' : 'rgba(239,68,68,0.9)',
                      color: '#fff', fontSize: '0.55rem', fontWeight: 700,
                      padding: '2px 6px', borderRadius: 999,
                      display: 'flex', alignItems: 'center', gap: 3
                    }}>
                      <Clock size={8} />
                      {isOpen ? 'OPEN' : 'CLOSED'}
                    </span>
                  </div>
                  <div style={{ padding: '0.6rem 0.75rem 0.75rem' }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-100)', marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {emoji} {item.title}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-400)', marginBottom: 4 }}>
                      {brand?.name || ''}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: '#f59e0b', fontWeight: 800, fontSize: '0.9rem' }}>
                        ₦{Number(item.price).toLocaleString()}
                      </span>
                      {item.rating && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 2, fontSize: '0.65rem', color: '#facc15' }}>
                          <Star size={10} fill="currentColor" />
                          {Number(item.rating).toFixed(1)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
