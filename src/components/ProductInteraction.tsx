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

  const [selectedVariants, setSelectedVariants] = useState<Record<string, string>>({});

  // Group variants by type (e.g. Size: ["S", "M", "L"], Color: ["Red", "Blue"])
  const variantsByType = (product.variants || []).reduce((acc: Record<string, string[]>, v: any) => {
    if (!acc[v.type]) acc[v.type] = [];
    if (!acc[v.type].includes(v.value)) acc[v.type].push(v.value);
    return acc;
  }, {});

  const handleAddToCart = () => {
    // Check if all variant types have been selected
    const requiredTypes = Object.keys(variantsByType);
    const missingTypes = requiredTypes.filter(t => !selectedVariants[t]);
    
    if (missingTypes.length > 0) {
      alert(`Please select: ${missingTypes.join(', ')}`);
      return;
    }
    
    addToCart(product, quantity, selectedVariants);
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  const handleBuyNow = () => {
    const requiredTypes = Object.keys(variantsByType);
    const missingTypes = requiredTypes.filter(t => !selectedVariants[t]);
    
    if (missingTypes.length > 0) {
      alert(`Please select: ${missingTypes.join(', ')}`);
      return;
    }

    addToCart(product, quantity, selectedVariants);
    router.push('/checkout');
  };

  return (
    <div className={styles.container}>
      {/* Variants Selection */}
      {Object.keys(variantsByType).length > 0 && (
        <div style={{ marginBottom: '1.5rem' }}>
          {Object.entries(variantsByType).map(([type, values]) => (
            <div key={type} style={{ marginBottom: '1rem' }}>
              <span className={styles.label}>{type}</span>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                {(values as string[]).map((val) => (
                  <button
                    key={val}
                    onClick={() => setSelectedVariants(prev => ({ ...prev, [type]: val }))}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '8px',
                      border: `1px solid ${selectedVariants[type] === val ? 'var(--primary)' : 'var(--border)'}`,
                      background: selectedVariants[type] === val ? 'var(--primary-soft)' : 'transparent',
                      color: selectedVariants[type] === val ? 'var(--primary)' : 'var(--text-100)',
                      cursor: 'pointer',
                      fontWeight: 500,
                      transition: 'all 0.2s'
                    }}
                  >
                    {val}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

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
