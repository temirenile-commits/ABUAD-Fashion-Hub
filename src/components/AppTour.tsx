'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import styles from './AppTour.module.css';

// ─── Tour Step Definitions per role ───────────────────────────────────────────
const CUSTOMER_STEPS = [
  {
    id: 'welcome',
    title: '👋 Welcome to MasterCart!',
    description: 'You\'re on the #1 campus marketplace. Let\'s take a quick 60-second tour so you know how to get the most out of it.',
    position: 'center',
    target: null,
  },
  {
    id: 'search',
    title: '🔍 Search for Anything',
    description: 'Use the top search bar to find products, brands, or services. Just type and hit SEARCH!',
    position: 'bottom',
    target: null,
    icon: '🔍',
  },
  {
    id: 'explore',
    title: '🛍️ Explore the Marketplace',
    description: 'Browse all products by category. Click "Explore" in the menu or use category pills below the nav bar.',
    position: 'center',
    target: null,
    icon: '🛍️',
  },
  {
    id: 'delicacies',
    title: '🍔 Delicacies – Campus Food',
    description: 'Craving something? Visit the Delicacies section to order food from verified campus chefs, right to your door.',
    position: 'center',
    target: null,
    icon: '🍔',
  },
  {
    id: 'cart',
    title: '🛒 Your Cart',
    description: 'Add items to your cart and checkout securely. Your payment is held in Escrow until you confirm delivery.',
    position: 'center',
    target: null,
    icon: '🛒',
  },
  {
    id: 'escrow',
    title: '🔐 Escrow = Your Safety Net',
    description: 'You pay, but the vendor only gets their money AFTER you confirm delivery. This protects you from scams!',
    position: 'center',
    target: null,
    icon: '🔐',
  },
  {
    id: 'dashboard',
    title: '📊 Your Dashboard',
    description: 'Track all your orders, view delivery status, and confirm receipt — all in your personal dashboard.',
    position: 'center',
    target: null,
    icon: '📊',
  },
  {
    id: 'notifications',
    title: '🔔 Stay Notified',
    description: 'Allow notifications to get real-time updates when your order is confirmed, on its way, or delivered.',
    position: 'center',
    target: null,
    icon: '🔔',
  },
  {
    id: 'done',
    title: '✅ You\'re All Set!',
    description: 'You now know the basics. You can always revisit this guide anytime from Help Center in the menu. Happy Shopping!',
    position: 'center',
    target: null,
    icon: '🎉',
  },
];

const VENDOR_STEPS = [
  {
    id: 'welcome',
    title: '🏪 Welcome, Campus Vendor!',
    description: 'You\'re about to reach thousands of students. Let\'s walk you through your Vendor Dashboard in under 2 minutes.',
    position: 'center',
    target: null,
  },
  {
    id: 'dashboard_overview',
    title: '📊 Your Dashboard Hub',
    description: 'Your dashboard shows real-time stats: total sales, wallet balance, pending orders, and your product catalog all in one place.',
    position: 'center',
    icon: '📊',
    target: null,
  },
  {
    id: 'upload_product',
    title: '📦 Upload Products',
    description: 'Click "Add Product" to list items. You can add images/videos, set prices, variants (sizes, colors), stock count, and more.',
    position: 'center',
    icon: '📦',
    target: null,
  },
  {
    id: 'variants_pricing',
    title: '🎨 Variants & Per-Variant Pricing',
    description: 'When adding variants (e.g., Size S / M / L), you can set a SPECIFIC PRICE for each variant. That price becomes the checkout price for that variant.',
    position: 'center',
    icon: '🎨',
    target: null,
  },
  {
    id: 'orders_tab',
    title: '📋 Managing Orders',
    description: 'New orders appear in real-time. You must: 1) Accept → 2) Mark as Ready → 3) Rider picks up → 4) Funds released after delivery confirmed.',
    position: 'center',
    icon: '📋',
    target: null,
  },
  {
    id: 'wallet',
    title: '💰 Your Wallet & Payouts',
    description: 'Earnings accumulate in your wallet after delivery confirmation. Request a payout anytime — funds transfer within 24 hours.',
    position: 'center',
    icon: '💰',
    target: null,
  },
  {
    id: 'subscription',
    title: '⚡ Boost Your Store',
    description: 'Upgrade your subscription to list more products, get featured placement, and appear in more searches. Check the Plans tab.',
    position: 'center',
    icon: '⚡',
    target: null,
  },
  {
    id: 'done',
    title: '🚀 Ready to Start Selling!',
    description: 'List your first product and start selling. The Help Center in the menu has answers to all vendor FAQs anytime.',
    position: 'center',
    icon: '🚀',
    target: null,
  },
];

const ADMIN_STEPS = [
  {
    id: 'welcome',
    title: '🛡️ University Admin Portal',
    description: 'Welcome to your command center. You manage vendors, students, orders, promos, and analytics for your university from here.',
    position: 'center',
    target: null,
  },
  {
    id: 'stats',
    title: '📊 Dashboard Stats',
    description: 'The top cards show live stats: total users, active vendors, orders, revenue, and projected stock value.',
    position: 'center',
    icon: '📊',
    target: null,
  },
  {
    id: 'analytics',
    title: '📈 Analytics Chart',
    description: 'Use the period tabs (7D / 30D / 90D / All Time) to see order volume and revenue trends over different timeframes.',
    position: 'center',
    icon: '📈',
    target: null,
  },
  {
    id: 'vendors',
    title: '🏪 Vendor Management',
    description: 'Approve, suspend, or reject vendor applications. Each vendor must be verified before they can list products.',
    position: 'center',
    icon: '🏪',
    target: null,
  },
  {
    id: 'promo_codes',
    title: '🎟️ Promo Codes',
    description: 'Create discount codes for your university students. Set the type (percentage/fixed), value, and usage limit.',
    position: 'center',
    icon: '🎟️',
    target: null,
  },
  {
    id: 'notices',
    title: '📢 Notices & Billboards',
    description: 'Post university-wide notices (urgent, general, promo) and create manual billboard ads visible on your campus homepage.',
    position: 'center',
    icon: '📢',
    target: null,
  },
  {
    id: 'merchandising',
    title: '🎯 Merchandising Sections',
    description: 'Create custom product sections (e.g., "Trending This Week") that appear on your campus homepage. Curate products manually.',
    position: 'center',
    icon: '🎯',
    target: null,
  },
  {
    id: 'done',
    title: '✅ You\'re Ready!',
    description: 'Explore each tab using the sidebar. The Help Center has detailed guides for every admin function.',
    position: 'center',
    icon: '✅',
    target: null,
  },
];

const RIDER_STEPS = [
  {
    id: 'welcome',
    title: '🚴 Welcome, Delivery Agent!',
    description: 'Your dashboard shows all orders ready for pickup in your area. Let\'s get you started in 60 seconds.',
    position: 'center',
    target: null,
  },
  {
    id: 'ready_orders',
    title: '📦 Ready for Pickup Orders',
    description: 'Orders that vendors have marked "Ready" appear in your "Available Deliveries" section. Tap to accept and pick up.',
    position: 'center',
    icon: '📦',
    target: null,
  },
  {
    id: 'delivery_code',
    title: '🔑 The Delivery Code',
    description: 'Each order has a 6-digit delivery code. The customer reveals this code when you arrive. Enter it to confirm delivery.',
    position: 'center',
    icon: '🔑',
    target: null,
  },
  {
    id: 'status_flow',
    title: '🔄 Status Flow',
    description: 'Accepted → In Transit → Delivered. Each step you update triggers a notification to the customer. Keep them informed!',
    position: 'center',
    icon: '🔄',
    target: null,
  },
  {
    id: 'earnings',
    title: '💵 Your Earnings',
    description: 'Your delivery fee is credited after each successful delivery. View your total in the Wallet section of your dashboard.',
    position: 'center',
    icon: '💵',
    target: null,
  },
  {
    id: 'done',
    title: '✅ Ready to Ride!',
    description: 'Check your available deliveries now. Stay available and earn daily. Good luck on your first delivery!',
    position: 'center',
    icon: '✅',
    target: null,
  },
];

const ROLE_TOUR_MAP: Record<string, typeof CUSTOMER_STEPS> = {
  customer: CUSTOMER_STEPS,
  vendor: VENDOR_STEPS,
  university_admin: ADMIN_STEPS,
  university_staff: ADMIN_STEPS,
  admin: ADMIN_STEPS,
  delivery: RIDER_STEPS,
};

const STORAGE_KEY_PREFIX = 'mc_tour_done_';

export default function AppTour() {
  const [active, setActive] = useState(false);
  const [steps, setSteps] = useState<typeof CUSTOMER_STEPS>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [role, setRole] = useState<string>('customer');
  const touchStartX = useRef<number>(0);

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      let userRole = 'customer';

      if (session) {
        const { data: profile } = await supabase
          .from('users')
          .select('role')
          .eq('id', session.user.id)
          .single();
        userRole = profile?.role || 'customer';
      }

      setRole(userRole);

      const tourKey = STORAGE_KEY_PREFIX + userRole;
      const done = localStorage.getItem(tourKey);
      if (!done) {
        const tourSteps = ROLE_TOUR_MAP[userRole] || CUSTOMER_STEPS;
        setSteps(tourSteps);
        // Delay to let page settle
        setTimeout(() => setActive(true), 2500);
      }
    };

    init();
  }, []);

  const handleSkip = useCallback(() => {
    localStorage.setItem(STORAGE_KEY_PREFIX + role, 'true');
    setActive(false);
  }, [role]);

  const handleNext = useCallback(() => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(c => c + 1);
    } else {
      handleSkip();
    }
  }, [currentStep, steps.length, handleSkip]);

  const handleBack = useCallback(() => {
    if (currentStep > 0) setCurrentStep(c => c - 1);
  }, [currentStep]);

  // Swipe support
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) {
      if (diff > 0) handleNext();
      else handleBack();
    }
  };

  if (!active || steps.length === 0) return null;

  const step = steps[currentStep];
  const isLast = currentStep === steps.length - 1;
  const progress = ((currentStep + 1) / steps.length) * 100;

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="App Tour">
      <div
        className={styles.card}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Progress Bar */}
        <div className={styles.progressBar}>
          <div className={styles.progressFill} style={{ width: `${progress}%` }} />
        </div>

        {/* Step Counter */}
        <div className={styles.stepCounter}>
          {currentStep + 1} / {steps.length}
        </div>

        {/* Icon */}
        {step.icon && (
          <div className={styles.stepIcon}>{step.icon}</div>
        )}

        {/* Content */}
        <h2 className={styles.stepTitle}>{step.title}</h2>
        <p className={styles.stepDesc}>{step.description}</p>

        {/* Dots */}
        <div className={styles.dots}>
          {steps.map((_, i) => (
            <button
              key={i}
              className={`${styles.dot} ${i === currentStep ? styles.dotActive : ''}`}
              onClick={() => setCurrentStep(i)}
              aria-label={`Go to step ${i + 1}`}
            />
          ))}
        </div>

        {/* Navigation */}
        <div className={styles.nav}>
          <button
            className={styles.skipBtn}
            onClick={handleSkip}
          >
            Skip Tour
          </button>

          <div className={styles.navRight}>
            {currentStep > 0 && (
              <button className={styles.backBtn} onClick={handleBack}>
                ← Back
              </button>
            )}
            <button className={styles.nextBtn} onClick={handleNext}>
              {isLast ? '🎉 Let\'s Go!' : 'Next →'}
            </button>
          </div>
        </div>

        {/* Swipe hint */}
        <p className={styles.swipeHint}>Swipe left/right to navigate</p>
      </div>
    </div>
  );
}
