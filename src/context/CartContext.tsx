'use client';
import React, { createContext, useContext, useState, useEffect } from 'react';
import { LiveProduct } from '@/components/ProductCard';

export interface CartItem extends LiveProduct {
  quantity: number;
  variants_selected?: Record<string, string>;
}

interface CartContextType {
  cart: CartItem[];
  addToCart: (product: LiveProduct, quantity?: number, variants_selected?: Record<string, string>) => void;
  removeFromCart: (productId: string) => void;
  clearCart: () => void;
  updateQuantity: (productId: string, quantity: number) => void;
  getCartTotal: () => number;
  getItemCount: () => number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);

  // Load cart from localStorage on init
  useEffect(() => {
    const savedCart = localStorage.getItem('ab_fashion_cart');
    if (savedCart) {
      try {
        setCart(JSON.parse(savedCart));
      } catch (e) {
        console.error('Failed to parse cart', e);
      }
    }
    setIsInitialized(true);
  }, []);

  // Save cart to localStorage on change
  useEffect(() => {
    if (isInitialized) {
      localStorage.setItem('ab_fashion_cart', JSON.stringify(cart));
    }
  }, [cart, isInitialized]);

  const addToCart = (product: LiveProduct, quantity: number = 1, variants_selected?: Record<string, string>) => {
    setCart((prevCart) => {
      // Create a unique hash or string to identify the same product with the same variants
      const variantKey = variants_selected ? JSON.stringify(variants_selected) : '';
      const existingItem = prevCart.find((item) => item.id === product.id && (item.variants_selected ? JSON.stringify(item.variants_selected) : '') === variantKey);
      
      if (existingItem) {
        return prevCart.map((item) =>
          (item.id === product.id && (item.variants_selected ? JSON.stringify(item.variants_selected) : '') === variantKey) 
            ? { ...item, quantity: item.quantity + quantity } 
            : item
        );
      }
      return [...prevCart, { ...product, quantity, variants_selected }];
    });
  };

  const removeFromCart = (productId: string) => {
    setCart((prevCart) => prevCart.filter((item) => item.id !== productId));
  };

  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity < 1) return;
    setCart((prevCart) =>
      prevCart.map((item) =>
        item.id === productId ? { ...item, quantity } : item
      )
    );
  };

  const clearCart = () => setCart([]);

  const getCartTotal = () => {
    return cart.reduce((total, item) => total + item.price * item.quantity, 0);
  };

  const getItemCount = () => {
    return cart.reduce((count, item) => count + item.quantity, 0);
  };

  return (
    <CartContext.Provider value={{ 
      cart, 
      addToCart, 
      removeFromCart, 
      clearCart, 
      updateQuantity, 
      getCartTotal, 
      getItemCount 
    }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
