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
      const { data, error } = await supabase
        .from('brands')
        .select('id, name, description, cover_url, billboard_boost_expires_at, sales_count')
        .or(`billboard_boost_expires_at.gt.${new Date().toISOString()},sales_count.gt.10`)
        .order('sales_count', { ascending: false })
        .limit(5);

      if (data && data.length > 0) {
        setSlides(data.map(b => ({
          id: b.id,
          image: b.cover_url || '/gold_fashion_banner_1_1776541486791.png',
          title: b.name,
          sub: b.description || 'Verified Campus Brand'
        })));
      } else {
        setSlides([
          { id: 1, image: '/gold_fashion_banner_1_1776541486791.png', title: 'The Gold Collection', sub: 'Discover premium campus fashion redefined.' },
          { id: 2, image: '/gold_fashion_banner_2_1776541653764.png', title: 'Luxury Accessories', sub: 'Elevate your style with metallic accents.' }
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
          <div key={slide.id} className={styles.slide}>
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
