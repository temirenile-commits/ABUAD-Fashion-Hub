'use client';
import { useState, useEffect } from 'react';
import styles from './SplashScreen.module.css';

export default function SplashScreen() {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
    }, 3000); // Show for 3 seconds

    return () => clearTimeout(timer);
  }, []);

  if (!isVisible) return null;

  return (
    <div className={styles.splashContainer}>
      <div className={styles.logoWrapper}>
        <img src="/logo.png" alt="ABUAD Fashion Hub" className={styles.logo} />
        <div className={styles.shimmer}></div>
      </div>
    </div>
  );
}
