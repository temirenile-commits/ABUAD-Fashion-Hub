'use client';
import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { ArrowRight, ShoppingBag, Zap, TrendingUp, Tag, Loader2 } from 'lucide-react';
import ProductCard from './ProductCard';
import styles from '@/app/page.module.css';

interface MerchandisingSection {
  id: string;
  title: string;
  description?: string;
  type: 'manual' | 'automated';
  layout_type: 'horizontal_scroll' | 'grid' | 'banner';
  priority: number;
  products: any[];
}

export default function DynamicMerchandising() {
  const [sections, setSections] = useState<MerchandisingSection[]>([]);
  const [loading, setLoading] = useState(true);
  const observedSections = useRef<Set<string>>(new Set());

  useEffect(() => {
    const fetchSections = async () => {
      try {
        const res = await fetch('/api/merchandising');
        const data = await res.json();
        if (data.success) {
          setSections(data.sections);
        }
      } catch (err) {
        console.error('Failed to fetch merchandising sections:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchSections();
  }, []);

  useEffect(() => {
    if (sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const sectionId = entry.target.getAttribute('data-section-id');
            if (sectionId && !observedSections.current.has(sectionId)) {
              observedSections.current.add(sectionId);
              trackEvent(sectionId, 'impression');
            }
          }
        });
      },
      { threshold: 0.3 }
    );

    document.querySelectorAll('[data-section-id]').forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, [sections]);

  const trackEvent = async (sectionId: string, eventType: 'impression' | 'click', productId?: string) => {
    try {
      await fetch('/api/merchandising', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sectionId, eventType, productId }),
      });
    } catch (err) {
      // Silent error for analytics
    }
  };

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
      <Loader2 className="spin" size={32} color="var(--primary)" />
    </div>
  );

  if (sections.length === 0) return null;

  return (
    <>
      {sections.map((section) => (
        <section 
          key={section.id} 
          className={styles.section} 
          data-section-id={section.id}
          style={{ marginBottom: '3rem' }}
        >
          <div className={styles.sectionHead}>
            <div className={styles.sectionTitleGroup}>
              {section.type === 'automated' ? <Zap size={20} className={styles.goldIcon} /> : <Tag size={20} className={styles.sectionIcon} />}
              <div>
                <h2 style={{ margin: 0 }}>{section.title}</h2>
                {section.description && <p className={styles.subText} style={{ margin: '4px 0 0 0', fontSize: '0.85rem' }}>{section.description}</p>}
              </div>
            </div>
            <Link href="/explore" className={styles.seeAll}>
              View all <ArrowRight size={14} />
            </Link>
          </div>

          {section.layout_type === 'grid' ? (
            <div className={styles.productGrid}>
              {section.products.map((product) => (
                <div key={product.id} onClick={() => trackEvent(section.id, 'click', product.id)}>
                  <ProductCard product={product} />
                </div>
              ))}
            </div>
          ) : (
            <div 
              style={{ 
                display: 'flex', 
                gap: '1.25rem', 
                overflowX: 'auto', 
                paddingBottom: '1rem',
                scrollbarWidth: 'none',
                msOverflowStyle: 'none',
                WebkitOverflowScrolling: 'touch'
              }}
              className="no-scrollbar"
            >
              {section.products.map((product) => (
                <div 
                  key={product.id} 
                  style={{ minWidth: '220px', flexShrink: 0 }}
                  onClick={() => trackEvent(section.id, 'click', product.id)}
                >
                  <ProductCard product={product} />
                </div>
              ))}
            </div>
          )}
        </section>
      ))}
    </>
  );
}
