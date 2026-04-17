'use client';
import { ShoppingBag, X, Trash2, Plus, Minus, CreditCard, Loader2 } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { formatPrice } from '@/lib/utils';
import Link from 'next/link';
import styles from './CartDrawer.module.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function CartDrawer({ isOpen, onClose }: Props) {
  const { cart, removeFromCart, updateQuantity, getCartTotal, getItemCount } = useCart();

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={`${styles.drawer} anim-slide-left`} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.headerTitle}>
            <ShoppingBag size={20} />
            <h2>Your Cart ({getItemCount()})</h2>
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close cart">
            <X size={24} />
          </button>
        </div>

        <div className={styles.content}>
          {cart.length === 0 ? (
            <div className={styles.empty}>
              <div className={styles.emptyIcon}>🛍️</div>
              <h3>Your bag is empty</h3>
              <p>Looks like you haven&apos;t added anything yet.</p>
              <button className="btn btn-primary" onClick={onClose}>
                Start Shopping
              </button>
            </div>
          ) : (
            <div className={styles.itemList}>
              {cart.map((item) => (
                <div key={item.id} className={styles.item}>
                  <div className={styles.itemImage}>
                    <img src={item.media_urls?.[0]} alt={item.title} />
                  </div>
                  <div className={styles.itemInfo}>
                    <div className={styles.itemHeader}>
                      <h3>{item.title}</h3>
                      <button 
                        className={styles.removeBtn} 
                        onClick={() => removeFromCart(item.id)}
                        aria-label="Remove item"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <p className={styles.itemBrand}>{item.brands?.name}</p>
                    <div className={styles.itemPriceRow}>
                      <span className={styles.price}>{formatPrice(item.price)}</span>
                      <div className={styles.qtyControls}>
                        <button onClick={() => updateQuantity(item.id, item.quantity - 1)} disabled={item.quantity <= 1}>
                          <Minus size={12} />
                        </button>
                        <span>{item.quantity}</span>
                        <button onClick={() => updateQuantity(item.id, item.quantity + 1)}>
                          <Plus size={12} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {cart.length > 0 && (
          <div className={styles.footer}>
            <div className={styles.subtotal}>
              <span>Subtotal</span>
              <span className={styles.totalAmount}>{formatPrice(getCartTotal())}</span>
            </div>
            <p className={styles.footerNote}>Shipping & taxes calculated at checkout.</p>
            <Link 
              href="/checkout" 
              className={`btn btn-primary btn-lg ${styles.checkoutBtn}`}
              onClick={onClose}
            >
              <CreditCard size={18} /> Checkout Now
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
