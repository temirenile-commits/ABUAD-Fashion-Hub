'use client';

import React, { useState, useMemo } from 'react';
import { X, Search, ChevronDown, ChevronUp, MessageCircle, PlayCircle } from 'lucide-react';
import SupportModal from './SupportModal';
import { useTour } from '@/context/TourContext';
import styles from './HelpCenter.module.css';

// Pre-defined FAQ knowledge base
const FAQ_DATA = [
  {
    category: 'Customers',
    q: 'How does Escrow protection work?',
    a: 'When you pay for an order, the money goes into a secure MasterCart Escrow account. The vendor only receives the funds AFTER you confirm delivery of your order. If there is an issue, you can dispute it and get a refund.',
    tourId: 'feature_escrow'
  },
  {
    category: 'Customers',
    q: 'How do I confirm delivery?',
    a: 'Go to your Dashboard -> Orders. Find the order, and you will see a "Confirm Delivery" button. You will also see a 6-digit delivery code that you must provide to the delivery rider when they arrive.',
    tourId: 'feature_escrow'
  },
  {
    category: 'Customers',
    q: 'How long does delivery take?',
    a: 'Delivery times vary by vendor and product type. Delicacies (food) are usually delivered within 30-60 minutes. Fashion and other items typically take 1-2 days.',
  },
  {
    category: 'Vendors',
    q: 'How do I get paid?',
    a: 'After a customer confirms delivery, the funds (minus commission) are instantly credited to your MasterCart wallet. You can request a payout from your Dashboard -> Wallet, and it will be sent to your bank account within 24 hours.',
  },
  {
    category: 'Vendors',
    q: 'How do I set different prices for variants (e.g. sizes)?',
    a: 'When adding or editing a product, scroll to the "Variants" section. When you add a variant option (like Size M), you can specify an exact price for that specific variant. If a customer selects it, they will be charged that specific price instead of the base price.',
    tourId: 'feature_variants'
  },
  {
    category: 'Vendors',
    q: 'What is the commission rate?',
    a: 'Commission rates depend on your product category and subscription tier. General fashion/electronics usually carry a small percentage fee. You can view the exact breakdown on the checkout/order page.',
  },
  {
    category: 'Riders',
    q: 'How do I accept a delivery?',
    a: 'In your Delivery Dashboard, check the "Available Deliveries" tab. These are orders vendors have marked as Ready. Tap "Accept Delivery" to assign it to yourself, then head to the vendor for pickup.',
  },
  {
    category: 'General',
    q: 'I forgot my password. How do I reset it?',
    a: 'On the login page, click "Forgot Password". Enter your email address and we will send you a secure link to reset your password.',
  },
];

const CATEGORIES = ['All', 'Customers', 'Vendors', 'Riders', 'General'];

export default function HelpCenter({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  const { startTour } = useTour();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [showSupport, setShowSupport] = useState(false);

  const filteredFaqs = useMemo(() => {
    return FAQ_DATA.filter(faq => {
      const matchesSearch = faq.q.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            faq.a.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = activeCategory === 'All' || faq.category === activeCategory;
      return matchesSearch && matchesCategory;
    });
  }, [searchQuery, activeCategory]);

  if (!isOpen) return null;

  return (
    <>
      <div className={styles.overlay} onClick={onClose}>
        <div className={styles.modal} onClick={e => e.stopPropagation()}>
          <div className={styles.header}>
            <h2>Help Center</h2>
            <button className={styles.closeBtn} onClick={onClose}>
              <X size={20} />
            </button>
          </div>

          <div className={styles.searchBar}>
            <Search size={18} className={styles.searchIcon} />
            <input 
              type="text" 
              placeholder="Search for answers..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={styles.searchInput}
            />
          </div>

          <div className={styles.tabs}>
            {CATEGORIES.map(cat => (
              <button 
                key={cat}
                className={`${styles.tab} ${activeCategory === cat ? styles.tabActive : ''}`}
                onClick={() => setActiveCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className={styles.body}>
            {filteredFaqs.length > 0 ? (
              filteredFaqs.map((faq, index) => {
                const isExpanded = expandedId === index;
                return (
                  <div key={index} className={styles.faqItem}>
                    <button 
                      className={styles.faqQuestion} 
                      onClick={() => setExpandedId(isExpanded ? null : index)}
                    >
                      <span>{faq.q}</span>
                      {isExpanded ? <ChevronUp size={18} color="var(--primary)" /> : <ChevronDown size={18} color="var(--text-400)" />}
                    </button>
                    {isExpanded && (
                      <div className={styles.faqAnswer}>
                        <p style={{ marginBottom: faq.tourId ? '1rem' : '0' }}>{faq.a}</p>
                        
                        {faq.tourId && (
                          <button 
                            onClick={() => {
                              onClose();
                              startTour(faq.tourId as string);
                            }}
                            className="btn btn-sm"
                            style={{ 
                              background: 'var(--primary-soft)', 
                              color: 'var(--primary)', 
                              border: '1px solid var(--primary)', 
                              display: 'flex', 
                              alignItems: 'center', 
                              gap: '0.5rem',
                              fontWeight: 700
                            }}
                          >
                            <PlayCircle size={16} /> Show Me How (Interactive Tour)
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className={styles.emptyState}>
                <p>No answers found for "{searchQuery}".</p>
              </div>
            )}

            {/* Contact Support Button - Always at bottom */}
            <div style={{ marginTop: 'auto', paddingTop: '1rem' }}>
              <button 
                onClick={() => setShowSupport(true)}
                className="btn" 
                style={{ width: '100%', display: 'flex', justifyContent: 'center', gap: '0.5rem', background: 'var(--primary)', color: '#000000' }}
              >
                <MessageCircle size={18} />
                Still need help? Contact Support
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Render the legacy SupportModal on top if requested */}
      <SupportModal isOpen={showSupport} onClose={() => setShowSupport(false)} />
    </>
  );
}
