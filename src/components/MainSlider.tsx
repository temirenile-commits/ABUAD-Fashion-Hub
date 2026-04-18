'use client';
import { useState, useEffect } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import styles from './MainSlider.module.css';

const SLIDES = [
  {
    id: 1,
    image: '/gold_fashion_banner_1_1776541486791.png',
    title: 'The Gold Collection',
    sub: 'Discover premium campus fashion redefined.'
  },
  {
    id: 2,
    image: '/gold_fashion_banner_2_1776541653764.png',
    title: 'Luxury Accessories',
    sub: 'Elevate your style with metallic accents.'
  }
];

export default function MainSlider() {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrent((prev) => (prev + 1) % SLIDES.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const next = () => setCurrent((prev) => (prev + 1) % SLIDES.length);
  const prev = () => setCurrent((prev) => (prev - 1 + SLIDES.length) % SLIDES.length);

  return (
    <div className={styles.slider}>
      <div 
        className={styles.inner} 
        style={{ transform: `translateX(-${current * 100}%)` }}
      >
        {SLIDES.map((slide) => (
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
        {SLIDES.map((_, i) => (
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
