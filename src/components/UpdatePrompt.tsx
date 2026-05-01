'use client';

import { useState, useEffect } from 'react';
import { Download, X, AlertTriangle, ShieldCheck, Zap } from 'lucide-react';
import styles from './UpdatePrompt.module.css';

export default function UpdatePrompt() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Check if user has already seen/dismissed this specific update notice
    const hasSeenUpdate = localStorage.getItem('mastercart_update_notice_v1');
    
    // We also check if they are coming from the old brand
    const isOldUser = document.referrer.includes('abuad') || !localStorage.getItem('mastercart_active');
    
    if (!hasSeenUpdate) {
      // Show after a short delay
      const timer = setTimeout(() => {
        setShow(true);
        localStorage.setItem('mastercart_active', 'true');
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, []);

  if (!show) return null;

  const handleDismiss = () => {
    setShow(false);
    localStorage.setItem('mastercart_update_notice_v1', 'true');
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <button className={styles.closeBtn} onClick={handleDismiss}>
          <X size={20} />
        </button>
        
        <div className={styles.iconCircle}>
          <Zap size={32} className={styles.zap} />
        </div>

        <div className={styles.content}>
          <h2>Upgrade to Master Cart</h2>
          <p className={styles.badge}>Official Platform Transition</p>
          
          <div className={styles.infoBox}>
            <AlertTriangle size={18} className={styles.warnIcon} />
            <p>
              The ABUAD Fashion Hub app is now <strong>Master Cart</strong>. 
              To continue enjoying seamless shopping, live tracking, and secure payouts, 
              please update your application.
            </p>
          </div>

          <div className={styles.steps}>
            <div className={styles.step}>
              <div className={styles.stepNum}>1</div>
              <p>Uninstall the old "AFH" app from your device.</p>
            </div>
            <div className={styles.step}>
              <div className={styles.stepNum}>2</div>
              <p>Visit the new portal or use the download button below.</p>
            </div>
            <div className={styles.step}>
              <div className={styles.stepNum}>3</div>
              <p>Login with your existing credentials to restore your data.</p>
            </div>
          </div>

          <div className={styles.actions}>
            <button 
              className={styles.updateBtn}
              onClick={() => {
                window.location.reload();
              }}
            >
              <Download size={18} />
              <span>Update & Reload</span>
            </button>
            <button className={styles.laterBtn} onClick={handleDismiss}>
              I'll do it later
            </button>
          </div>

          <div className={styles.footer}>
            <ShieldCheck size={14} />
            <span>Your data and wallet balance are safe and transferred.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
