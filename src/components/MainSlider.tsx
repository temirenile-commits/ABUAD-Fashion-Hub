'use client';
import { useState, useEffect } from 'react';
import OptimizedImage from '@/components/OptimizedImage';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import styles from './MainSlider.module.css';

const DEFAULT_UNIVERSITY_ID = '00000000-0000-0000-0000-000000000001';

export default function MainSlider() {
  const [slides, setSlides] = useState<any[]>([]);
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const fetchBillboard = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      let userUniId: string | null = null;
      if (session) {
        const { data: userProfile } = await supabase.from('users').select('university_id').eq('id', session.user.id).single();
        userUniId = userProfile?.university_id;
      }

      // 1. Fetch Organic Brand Boosts
      let query = supabase
        .from('brands')
        .select('id, name, description, cover_url, billboard_boost_expires_at, sales_count, social_links, university_id')
        .or(`billboard_boost_expires_at.gt.${new Date().toISOString()},sales_count.gt.10`)
        .order('sales_count', { ascending: false })
        .limit(5);

      query = userUniId
        ? query.or(`university_id.is.null,university_id.eq.${userUniId}`)
        : query.or(`university_id.is.null,university_id.eq.${DEFAULT_UNIVERSITY_ID}`);

      const { data: brandData } = await query;

      // 2. Fetch Manual Billboards
      const { data: settingsData } = await supabase
        .from('platform_settings')
        .select('value')
        .eq('key', 'manual_billboards')
        .single();
        
      const rawManualBillboards = (settingsData?.value as any[]) || [];
      const targetUniversityId = userUniId || DEFAULT_UNIVERSITY_ID;
      const manualBillboards = rawManualBillboards.filter(mb =>
        (!mb.university_id || mb.university_id === targetUniversityId) && Boolean(mb.cover_url)
      );
      
      // 3. Merge & Format
      let mergedSlides = [];
      
      if (manualBillboards.length > 0) {
        mergedSlides.push(...manualBillboards.map(mb => ({
          id: mb.id || `${mb.title || 'billboard'}-${mb.cover_url}`,
          image: mb.cover_url,
          title: mb.title,
          sub: mb.description,
          link: mb.link
        })));
      }

      if (brandData && brandData.length > 0) {
        mergedSlides.push(...brandData.map(b => {
          const social = b.social_links || {};
          const brandSlug = b.name?.toLowerCase().replace(/\s+/g, '-') || 'brand';
          return {
            id: b.id,
            image: social.billboard_image || b.cover_url,
            title: b.name,
            sub: b.description || '',
            link: social.billboard_link || `/vendor/${brandSlug}?id=${b.id}`
          };
        }));
      }

      setSlides(mergedSlides.filter((slide) => Boolean(slide.image)).slice(0, 8)); // Limit total slides
    };
    fetchBillboard();
  }, []);

  useEffect(() => {
    if (slides.length <= 1) return;
    const timer = setInterval(() => {
      setCurrent((prev) => (prev + 1) % slides.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [slides]);

  const next = () => setCurrent((prev) => (prev + 1) % slides.length);
  const prev = () => setCurrent((prev) => (prev - 1 + slides.length) % slides.length);

  return (
    <div className={styles.slider}>
      <div 
        className={styles.inner} 
        style={{ transform: `translateX(-${current * 100}%)` }}
      >
        {slides.map((slide) => (
          <div 
            key={slide.id} 
            className={styles.slide}
            onClick={() => { if(slide.link) window.location.href = slide.link; }}
            style={{ cursor: slide.link ? 'pointer' : 'default' }}
          >
            <OptimizedImage 
              src={slide.image} 
              alt={slide.title} 
              fill 
              priority 
              className={styles.img} 
              useThumbnail={false}
            />
            <div className={styles.overlay}>
              <h2 className={styles.title}>{slide.title}</h2>
              <p className={styles.sub}>{slide.sub}</p>
            </div>
          </div>
        ))}
      </div>

      <button className={`${styles.navBtn} ${styles.prev}`} onClick={prev}>
        <ChevronLeft size={24} />
      </button>
      <button className={`${styles.navBtn} ${styles.next}`} onClick={next}>
        <ChevronRight size={24} />
      </button>

      <div className={styles.dots}>
        {slides.map((_, i) => (
          <div 
            key={i} 
            className={`${styles.dot} ${i === current ? styles.dotActive : ''}`}
            onClick={() => setCurrent(i)}
          />
        ))}
      </div>
    </div>
  );
}
