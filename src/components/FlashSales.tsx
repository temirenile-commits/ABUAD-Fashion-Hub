'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Zap, ChevronRight } from 'lucide-react';
import { formatPrice } from '@/lib/utils';
import styles from './FlashSales.module.css';

interface FlashSaleItem {
  id: string;
  title: string;
  price: number;
  oldPrice: number;
  image: string;
  discount: number;
}

export default function FlashSales({ items }: { items: FlashSaleItem[] }) {
  const [timeLeft, setTimeLeft] = useState({ hours: 0, mins: 0, secs: 0 });

  useEffect(() => {
    // Set target to end of day
    const calculateTime = () => {
      const now = new Date();
      const end = new Date();
      end.setHours(23, 59, 59);
      const diff = end.getTime() - now.getTime();
      
      const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
      const m = Math.floor((diff / (1000 * 60)) % 60);
      const s = Math.floor((diff / 1000) % 60);
      
      setTimeLeft({ hours: h, mins: m, secs: s });
    };

    calculateTime();
    const timer = setInterval(calculateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className={styles.section}>
      <div className={styles.header}>
         <div className={styles.left}>
            <Zap size={20} fill="currentColor" />
            <h2 className={styles.title}>Flash Sales</h2>
            <div className={styles.timer}>
              <span>Time Left:</span>
              <div className={styles.timeBox}>{String(timeLeft.hours).padStart(2, '0')}h</div>
              <div className={styles.timeBox}>{String(timeLeft.mins).padStart(2, '0')}m</div>
              <div className={styles.timeBox}>{String(timeLeft.secs).padStart(2, '0')}s</div>
            </div>
         </div>
         <Link href="/explore" className={styles.seeAll}>
           SEE ALL <ChevronRight size={16} />
         </Link>
      </div>

      <div className={styles.itemsTrack}>
        <div className={styles.itemsInner}>
          {items.map((item) => (
            <Link key={item.id} href={`/product/${item.id}`} className={styles.card}>
              <div className={styles.imgWrap}>
                <Image src={item.image} alt={item.title} fill className={styles.img} />
                <span className={styles.discountBadge}>-{item.discount}%</span>
              </div>
              <div className={styles.body}>
                <p className={styles.itemTitle}>{item.title}</p>
                <p className={styles.price}>{formatPrice(item.price)}</p>
                <p className={styles.oldPrice}>{formatPrice(item.oldPrice)}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
