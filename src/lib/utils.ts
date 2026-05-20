// Shared utility functions for MasterCart
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

/**
 * Calculates the active price of a product including selected variants.
 * 
 * Addition Rules:
 * 1. Start with the size/portion/plate variant's price if one is selected.
 *    Otherwise, start with the base price of the product.
 * 2. Add the price of all other selected variants (like spice level, add-ons, location/hostel, etc.).
 */
export const calculateActivePrice = (
  basePrice: number,
  variants: any[] | null | undefined,
  selectedVariants: Record<string, string> | null | undefined
): number => {
  const normBasePrice = Number(basePrice || 0);
  if (!variants || !selectedVariants || Object.keys(selectedVariants).length === 0) {
    return normBasePrice;
  }

  const selectedEntries = Object.entries(selectedVariants);
  let sizePrice: number | null = null;
  let additionalPriceSum = 0;

  selectedEntries.forEach(([type, val]) => {
    const typeLower = type.toLowerCase();
    const match = (variants || []).find(
      (v: any) => v.type === type && v.value === val
    );
    if (match && match.price !== undefined && match.price !== null) {
      const matchPrice = Number(match.price);
      if (matchPrice > 0) {
        if (
          typeLower.includes('size') ||
          typeLower.includes('sizes') ||
          typeLower.includes('sizing') ||
          typeLower.includes('portion') ||
          typeLower.includes('plate')
        ) {
          sizePrice = matchPrice;
        } else {
          additionalPriceSum += matchPrice;
        }
      }
    }
  });

  const finalBasePrice = sizePrice !== null ? sizePrice : normBasePrice;
  return finalBasePrice + additionalPriceSum;
};
