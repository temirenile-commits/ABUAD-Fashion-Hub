'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { MessageCircle, Phone, X, AlertTriangle, Loader2 } from 'lucide-react';
import styles from './SupportModal.module.css';

export default function SupportModal({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  const [loading, setLoading] = useState(true);
  const [numbers, setNumbers] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (!isOpen) {
       setCurrentIndex(0);
       return;
    }

    const fetchSupportNumbers = async () => {
      setLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        let uniId = null;
        
        if (session) {
           const { data: profile } = await supabase.from('users').select('university_id').eq('id', session.user.id).single();
           uniId = profile?.university_id;
        }

        // If no university ID, fallback to general platform support (or hardcoded if none exists)
        if (!uniId) {
            setNumbers([{ phone: '+2347045592604', name: 'General Support', is_whatsapp: true }]);
            setLoading(false);
            return;
        }

        const { data: uniSettings } = await supabase.from('platform_settings').select('*').eq('key', `uni_config_${uniId}`).single();
        const config = uniSettings?.value || {};
        
        if (config.support_numbers && config.support_numbers.length > 0) {
            setNumbers(config.support_numbers);
        } else {
            setNumbers([{ phone: '+2347045592604', name: 'General Support', is_whatsapp: true }]);
        }
      } catch (e) {
        setNumbers([{ phone: '+2347045592604', name: 'General Support', is_whatsapp: true }]);
      }
      setLoading(false);
    };

    fetchSupportNumbers();
  }, [isOpen]);

  if (!isOpen) return null;

  const currentNumber = numbers[currentIndex];

  const handleTryNext = () => {
     if (currentIndex < numbers.length - 1) {
        setCurrentIndex(currentIndex + 1);
     }
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2>Customer Service</h2>
          <button onClick={onClose} className={styles.closeBtn}><X size={20} /></button>
        </div>

        <div className={styles.body}>
           {loading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem 0' }}>
                 <Loader2 size={24} className="anim-spin" color="var(--primary)" />
              </div>
           ) : (
              <div style={{ textAlign: 'center' }}>
                 <div className={styles.avatarWrap}>
                    <MessageCircle size={32} color="#10b981" />
                 </div>
                 <h3 style={{ marginBottom: '0.5rem' }}>{currentNumber?.name || 'Support Agent'}</h3>
                 <p style={{ color: 'var(--text-300)', fontSize: '0.9rem', marginBottom: '1.5rem', padding: '0 1rem' }}>
                    We're here to help! Click the button below to reach out to this agent.
                 </p>

                 {currentNumber?.is_whatsapp && (
                    <a 
                       href={`https://wa.me/${currentNumber.phone.replace(/[^0-9]/g, '')}`} 
                       target="_blank" 
                       rel="noreferrer"
                       className="btn" 
                       style={{ background: '#10b981', color: '#fff', width: '100%', marginBottom: '1rem', display: 'flex', justifyContent: 'center' }}
                    >
                       <MessageCircle size={18} /> Chat on WhatsApp
                    </a>
                 )}

                 <a 
                    href={`tel:${currentNumber?.phone}`} 
                    className="btn btn-secondary" 
                    style={{ width: '100%', marginBottom: '1.5rem', display: 'flex', justifyContent: 'center' }}
                 >
                    <Phone size={18} /> Call Directly
                 </a>

                 {currentIndex < numbers.length - 1 && (
                    <div style={{ padding: '1rem', background: 'rgba(245, 158, 11, 0.05)', borderRadius: '8px', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
                       <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#f59e0b', fontSize: '0.85rem', marginBottom: '0.75rem', justifyContent: 'center' }}>
                          <AlertTriangle size={14} /> Agent unavailable?
                       </div>
                       <button onClick={handleTryNext} className="btn btn-ghost btn-sm" style={{ width: '100%' }}>
                          Try Next Available Agent
                       </button>
                    </div>
                 )}
              </div>
           )}
        </div>
      </div>
    </div>
  );
}
