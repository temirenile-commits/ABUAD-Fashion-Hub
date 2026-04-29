'use client';
import { useState, useEffect } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import styles from './MainSlider.module.css';

export default function MainSlider() {
  const [slides, setSlides] = useState<any[]>([]);
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const fetchBillboard = async () => {
      // 1. Fetch Organic Brand Boosts
      const { data: brandData } = await supabase
        .from('brands')
        .select('id, name, description, cover_url, billboard_boost_expires_at, sales_count')
        .or(`billboard_boost_expires_at.gt.${new Date().toISOString()},sales_count.gt.10`)
        .order('sales_count', { ascending: false })
        .limit(5);

      // 2. Fetch Manual Billboards
      const { data: settingsData } = await supabase
        .from('platform_settings')
        .select('value')
        .eq('key', 'manual_billboards')
        .single();
        
      const manualBillboards = (settingsData?.value as any[]) || [];
      
      // 3. Merge & Format
      let mergedSlides = [];
      
      if (manualBillboards.length > 0) {
        mergedSlides.push(...manualBillboards.map(mb => ({
          id: mb.id || `mb_${Math.random()}`,
          image: mb.cover_url || '/gold_fashion_banner_1_1776541486791.png',
          title: mb.title,
          sub: mb.description,
          link: mb.link
        })));
      }

      if (brandData && brandData.length > 0) {
        mergedSlides.push(...brandData.map(b => ({
          id: b.id,
          image: b.cover_url || '/gold_fashion_banner_1_1776541486791.png',
          title: b.name,
          sub: b.description || 'Verified Campus Brand',
          link: `/vendor/${b.id}`
        })));
      }

      if (mergedSlides.length > 0) {
        setSlides(mergedSlides.slice(0, 8)); // Limit total slides
      } else {
        setSlides([
          { id: 1, image: '/gold_fashion_banner_1_1776541486791.png', title: 'The Gold Collection', sub: 'Discover premium campus fashion redefined.', link: null },
          { id: 2, image: '/gold_fashion_banner_2_1776541653764.png', title: 'Luxury Accessories', sub: 'Elevate your style with metallic accents.', link: null }
        ]);
      }
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
            <Image 
              src={slide.image} 
              alt={slide.title} 
              fill 
              priority 
              className={styles.img} 
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
