// Shared utility functions for Master Cart
// These are server-compatible (no 'use client' directive)

/**
 * Formats a number as Nigerian Naira (NGN)
 */
export const formatPrice = (price: number) => {
  return new Intl.NumberFormat('en-NG', { 
    style: 'currency', 
    currency: 'NGN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(price);
};

/**
 * Calculates percentage discount between two prices
 */
export const getDiscount = (price: number, original: number) => {
  if (!original || price >= original) return 0;
  return Math.round(((original - price) / original) * 100);
};

/**
 * Generates a URL-friendly slug from a string
 */
export const generateSlug = (text: string) => {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
};
