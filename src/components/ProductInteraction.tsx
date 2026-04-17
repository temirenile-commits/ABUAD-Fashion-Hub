'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShoppingBag, CreditCard, Plus, Minus, Check } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { LiveProduct } from '@/components/ProductCard';
import { formatPrice } from '@/lib/utils';
import styles from './ProductInteraction.module.css';

interface Props {
  product: LiveProduct;
}

export default function ProductInteraction({ product }: Props) {
  const router = useRouter();
  const { addToCart } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);

  const handleAddToCart = () => {
    addToCart(product, quantity);
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  const handleBuyNow = () => {
    addToCart(product, quantity);
    router.push('/checkout');
  };

  return (
    <div className={styles.container}>
      {/* Quantity Selector */}
      <div className={styles.quantitySection}>
        <span className={styles.label}>Quantity</span>
        <div className={styles.qtyControls}>
          <button 
            className={styles.qtyBtn} 
            onClick={() => setQuantity(q => Math.max(1, q - 1))}
            aria-label="Decrease quantity"
          >
            <Minus size={16} />
          </button>
          <span className={styles.qtyValue}>{quantity}</span>
          <button 
            className={styles.qtyBtn} 
            onClick={() => setQuantity(q => q + 1)}
            aria-label="Increase quantity"
          >
            <Plus size={16} />
          </button>
        </div>
      </div>

      {/* Action Buttons */}
      <div className={styles.actions}>
        <button 
          className={`btn btn-secondary btn-lg ${styles.cartBtn}`} 
          onClick={handleAddToCart}
        >
          {added ? (
            <><Check size={20} /> Added to Bag</>
          ) : (
            <><ShoppingBag size={20} /> Add to Cart</>
          )}
        </button>
        
        <button 
          className={`btn btn-primary btn-lg ${styles.buyBtn}`} 
          onClick={handleBuyNow}
        >
          <CreditCard size={20} /> Buy Now
        </button>
      </div>
    </div>
  );
}
