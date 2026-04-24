'use client';
import { ShoppingBag, Trash2, Plus, Minus, CreditCard } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { formatPrice } from '@/lib/utils';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function CartPage() {
  const { cart, removeFromCart, updateQuantity, getCartTotal, getItemCount } = useCart();
  const router = useRouter();

  return (
    <div className="container pb-mobile-nav" style={{ paddingTop: '2rem', paddingBottom: '6rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem' }}>
        <ShoppingBag size={28} color="var(--primary)" />
        <h1 style={{ fontSize: '2rem' }}>Your Cart ({getItemCount()})</h1>
      </div>

      {cart.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem 1rem', background: 'var(--bg-200)', borderRadius: '16px' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🛍️</div>
          <h3 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Your bag is empty</h3>
          <p style={{ color: 'var(--text-300)', marginBottom: '2rem' }}>Looks like you haven't added anything yet.</p>
          <button onClick={() => router.back()} className="btn btn-primary btn-lg">
            Start Shopping
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {cart.map((item) => (
              <div key={item.id} style={{ display: 'flex', gap: '1rem', background: 'var(--bg-200)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border)' }}>
                <div style={{ width: '80px', height: '100px', borderRadius: '8px', overflow: 'hidden', flexShrink: 0, background: 'var(--bg-300)' }}>
                  <img src={item.media_urls?.[0]} alt={item.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <h3 style={{ fontSize: '1.1rem', marginBottom: '0.2rem' }}>{item.title}</h3>
                    <button 
                      onClick={() => removeFromCart(item.id)}
                      style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0.2rem' }}
                      aria-label="Remove item"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-400)', textTransform: 'uppercase', marginBottom: 'auto' }}>{item.brands?.name}</p>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
                    <span style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--primary)' }}>{formatPrice(item.price)}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: 'var(--bg-300)', padding: '0.3rem 0.6rem', borderRadius: '8px' }}>
                      <button onClick={() => updateQuantity(item.id, item.quantity - 1)} disabled={item.quantity <= 1} style={{ background: 'none', border: 'none', color: 'var(--text-100)', cursor: 'pointer', padding: '0.2rem', opacity: item.quantity <= 1 ? 0.3 : 1 }}>
                        <Minus size={14} />
                      </button>
                      <span style={{ fontSize: '0.95rem', fontWeight: 600 }}>{item.quantity}</span>
                      <button onClick={() => updateQuantity(item.id, item.quantity + 1)} style={{ background: 'none', border: 'none', color: 'var(--text-100)', cursor: 'pointer', padding: '0.2rem' }}>
                        <Plus size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ background: 'var(--bg-200)', padding: '2rem', borderRadius: '16px', border: '1px solid var(--border)', height: 'max-content', position: 'sticky', top: '100px' }}>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '1.5rem' }}>Order Summary</h3>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', color: 'var(--text-200)' }}>
              <span>Subtotal</span>
              <span>{formatPrice(getCartTotal())}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', color: 'var(--text-200)' }}>
              <span>Shipping</span>
              <span>Calculated at checkout</span>
            </div>
            <div style={{ height: '1px', background: 'var(--border)', margin: '1.5rem 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem', fontSize: '1.25rem', fontWeight: 700 }}>
              <span>Total</span>
              <span style={{ color: 'var(--primary)' }}>{formatPrice(getCartTotal())}</span>
            </div>
            <Link 
              href="/checkout" 
              className="btn btn-primary btn-lg"
              style={{ width: '100%', display: 'flex', justifyContent: 'center', gap: '0.5rem' }}
            >
              <CreditCard size={20} /> Proceed to Secure Checkout
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
