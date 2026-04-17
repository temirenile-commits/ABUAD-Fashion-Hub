// ============================================
// MOCK DATA - ABUAD Fashion Hub
// Will be replaced with Supabase data fetching
// ============================================

export type Product = {
  id: string;
  title: string;
  price: number;
  originalPrice?: number;
  brand: string;
  brandId: string;
  category: string;
  image: string;
  images: string[];
  rating: number;
  reviews: number;
  sold: number;
  trending: boolean;
  featured: boolean;
  whatsapp: string;
  description: string;
};

export type Vendor = {
  id: string;
  name: string;
  slug: string;
  category: string;
  logo: string;
  coverImage: string;
  verified: boolean;
  rating: number;
  reviews: number;
  products: number;
  followers: number;
  whatsapp: string;
  description: string;
  joinedYear: number;
};

export type Service = {
  id: string;
  title: string;
  serviceType: string;
  brandId: string;
  brand: string;
  price: string;
  image: string;
  portfolio: string[];
  rating: number;
  reviews: number;
  whatsapp: string;
  description: string;
  verified: boolean;
};

export const PRODUCTS: Product[] = [
  {
    id: 'p1',
    title: 'Vintage Oversized Denim Jacket',
    price: 18500,
    originalPrice: 24000,
    brand: 'RetroFits ABUAD',
    brandId: 'v1',
    category: 'Clothing',
    image: 'https://images.unsplash.com/photo-1576995853123-5a10305d93c0?w=600&q=80',
    images: [
      'https://images.unsplash.com/photo-1576995853123-5a10305d93c0?w=600&q=80',
      'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=600&q=80',
    ],
    rating: 4.8,
    reviews: 42,
    sold: 89,
    trending: true,
    featured: true,
    whatsapp: '2348XXXXXXXXX',
    description: 'A timeless vintage oversized denim jacket perfect for any campus outfit. High-quality denim with a comfortable relaxed fit.',
  },
  {
    id: 'p2',
    title: 'Minimalist Structured Tote Bag',
    price: 9500,
    originalPrice: 12000,
    brand: 'BagHaus Studio',
    brandId: 'v2',
    category: 'Bags',
    image: 'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=600&q=80',
    images: ['https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=600&q=80'],
    rating: 4.6,
    reviews: 28,
    sold: 67,
    trending: true,
    featured: false,
    whatsapp: '2348XXXXXXXXX',
    description: 'Clean, structured tote bag crafted for the modern student.',
  },
  {
    id: 'p3',
    title: 'Y2K Cargo Utility Pants',
    price: 13000,
    brand: 'Urban Vogue',
    brandId: 'v3',
    category: 'Clothing',
    image: 'https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?w=600&q=80',
    images: ['https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?w=600&q=80'],
    rating: 4.5,
    reviews: 33,
    sold: 54,
    trending: true,
    featured: false,
    whatsapp: '2348XXXXXXXXX',
    description: 'Trendy Y2K-inspired cargo pants with multiple pockets. Statement piece for any bold look.',
  },
  {
    id: 'p4',
    title: 'Graphic Print Crop Top',
    price: 5500,
    originalPrice: 7000,
    brand: 'TeeCulture',
    brandId: 'v4',
    category: 'Clothing',
    image: 'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=600&q=80',
    images: ['https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=600&q=80'],
    rating: 4.3,
    reviews: 19,
    sold: 41,
    trending: false,
    featured: true,
    whatsapp: '2348XXXXXXXXX',
    description: 'Bold graphic crop top for the fashion-forward student.',
  },
  {
    id: 'p5',
    title: 'Chunky Gold Chain Necklace',
    price: 4800,
    brand: 'GlowJewels',
    brandId: 'v5',
    category: 'Jewelry',
    image: 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=600&q=80',
    images: ['https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=600&q=80'],
    rating: 4.7,
    reviews: 56,
    sold: 112,
    trending: true,
    featured: true,
    whatsapp: '2348XXXXXXXXX',
    description: 'Statement chunky gold chain necklace. Pairs great with any outfit for an instant upgrade.',
  },
  {
    id: 'p6',
    title: 'White Air Force 1 Sneakers',
    price: 38000,
    originalPrice: 45000,
    brand: 'Sole Connect',
    brandId: 'v6',
    category: 'Footwear',
    image: 'https://images.unsplash.com/photo-1600185365926-3a2ce3cdb9eb?w=600&q=80',
    images: ['https://images.unsplash.com/photo-1600185365926-3a2ce3cdb9eb?w=600&q=80'],
    rating: 4.9,
    reviews: 85,
    sold: 167,
    trending: true,
    featured: true,
    whatsapp: '2348XXXXXXXXX',
    description: 'Classic clean white sneakers. Brand new, authentic pair delivered on campus.',
  },
  {
    id: 'p7',
    title: 'Woven Raffia Bucket Hat',
    price: 3500,
    brand: 'RetroFits ABUAD',
    brandId: 'v1',
    category: 'Accessories',
    image: 'https://images.unsplash.com/photo-1521369909029-2afed882baee?w=600&q=80',
    images: ['https://images.unsplash.com/photo-1521369909029-2afed882baee?w=600&q=80'],
    rating: 4.4,
    reviews: 14,
    sold: 29,
    trending: false,
    featured: false,
    whatsapp: '2348XXXXXXXXX',
    description: 'Stylish woven raffia bucket hat, perfect for sunny campus days.',
  },
  {
    id: 'p8',
    title: 'Satin Slip Mini Dress',
    price: 16000,
    originalPrice: 21000,
    brand: 'Velvet Thread',
    brandId: 'v7',
    category: 'Clothing',
    image: 'https://images.unsplash.com/photo-1539008835657-9e8e9680c956?w=600&q=80',
    images: ['https://images.unsplash.com/photo-1539008835657-9e8e9680c956?w=600&q=80'],
    rating: 4.8,
    reviews: 47,
    sold: 93,
    trending: true,
    featured: true,
    whatsapp: '2348XXXXXXXXX',
    description: 'Elegant satin slip mini dress - perfect for events, hangouts, and campus nights.',
  },
];

export const VENDORS: Vendor[] = [
  {
    id: 'v1',
    name: 'RetroFits ABUAD',
    slug: 'retrofits-abuad',
    category: 'Vintage & Thrift',
    logo: 'RF',
    coverImage: 'https://images.unsplash.com/photo-1555529669-e69e7aa0ba9a?w=800&q=80',
    verified: true,
    rating: 4.8,
    reviews: 127,
    products: 34,
    followers: 612,
    whatsapp: '2348XXXXXXXXX',
    description: 'Top-rated vintage & thrift fashion brand on campus. Unique, affordable, and sustainable.',
    joinedYear: 2023,
  },
  {
    id: 'v2',
    name: 'BagHaus Studio',
    slug: 'baghaus-studio',
    category: 'Bags & Accessories',
    logo: 'BH',
    coverImage: 'https://images.unsplash.com/photo-1547949003-9792a18a2601?w=800&q=80',
    verified: true,
    rating: 4.6,
    reviews: 89,
    products: 21,
    followers: 340,
    whatsapp: '2348XXXXXXXXX',
    description: 'Premium handmade bags and accessories designed for the modern ABUAD student.',
    joinedYear: 2024,
  },
  {
    id: 'v3',
    name: 'Urban Vogue',
    slug: 'urban-vogue',
    category: 'Streetwear',
    logo: 'UV',
    coverImage: 'https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?w=800&q=80',
    verified: true,
    rating: 4.5,
    reviews: 73,
    products: 28,
    followers: 445,
    whatsapp: '2348XXXXXXXXX',
    description: 'Bringing the freshest streetwear aesthetics to ABUAD campus.',
    joinedYear: 2023,
  },
  {
    id: 'v5',
    name: 'GlowJewels',
    slug: 'glowjewels',
    category: 'Jewelry',
    logo: 'GJ',
    coverImage: 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=800&q=80',
    verified: true,
    rating: 4.7,
    reviews: 156,
    products: 47,
    followers: 830,
    whatsapp: '2348XXXXXXXXX',
    description: 'Stunning jewelry pieces for every occasion. Gold plated and fashion jewelry at affordable prices.',
    joinedYear: 2022,
  },
  {
    id: 'v6',
    name: 'Sole Connect',
    slug: 'sole-connect',
    category: 'Sneakers & Footwear',
    logo: 'SC',
    coverImage: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&q=80',
    verified: true,
    rating: 4.9,
    reviews: 201,
    products: 52,
    followers: 1200,
    whatsapp: '2348XXXXXXXXX',
    description: '#1 sneaker plug on ABUAD campus. Authentic brands, student-friendly prices.',
    joinedYear: 2022,
  },
  {
    id: 'v4',
    name: 'TeeCulture',
    slug: 'teeculture',
    category: 'Graphic Apparel',
    logo: 'TC',
    coverImage: 'https://images.unsplash.com/photo-1523381210434-271e8be1f52b?w=800&q=80',
    verified: false,
    rating: 4.3,
    reviews: 45,
    products: 18,
    followers: 210,
    whatsapp: '2348XXXXXXXXX',
    description: 'Bold graphic apparel for students who want to make a statement every day.',
    joinedYear: 2024,
  },
  {
    id: 'v7',
    name: 'Velvet Thread',
    slug: 'velvet-thread',
    category: 'Dresses & Formal',
    logo: 'VT',
    coverImage: 'https://images.unsplash.com/photo-1558769132-cb1aea458c5e?w=800&q=80',
    verified: true,
    rating: 4.8,
    reviews: 98,
    products: 31,
    followers: 567,
    whatsapp: '2348XXXXXXXXX',
    description: 'Custom and ready-made dresses for every occasion. Designed on campus with love.',
    joinedYear: 2023,
  },
];

export const SERVICES: Service[] = [
  {
    id: 's1',
    title: 'Professional Makeup & Beat',
    serviceType: 'Makeup Artist',
    brandId: 'sv1',
    brand: 'Glamour House',
    price: '₦5,000 – ₦25,000',
    image: 'https://images.unsplash.com/photo-1487412947147-5cebf100ffc2?w=600&q=80',
    portfolio: [
      'https://images.unsplash.com/photo-1487412947147-5cebf100ffc2?w=600&q=80',
      'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=600&q=80',
    ],
    rating: 4.9,
    reviews: 112,
    whatsapp: '2348XXXXXXXXX',
    description: 'Top-tier makeup artistry for all occasions — bridal, prom, birthday, grad photos and more.',
    verified: true,
  },
  {
    id: 's2',
    title: 'Fashion Photography & Studio Shots',
    serviceType: 'Photographer',
    brandId: 'sv2',
    brand: 'LensArt Studio',
    price: '₦8,000 – ₦50,000',
    image: 'https://images.unsplash.com/photo-1542038784456-1ea8e935640e?w=600&q=80',
    portfolio: ['https://images.unsplash.com/photo-1542038784456-1ea8e935640e?w=600&q=80'],
    rating: 4.8,
    reviews: 78,
    whatsapp: '2348XXXXXXXXX',
    description: 'Professional fashion photography for brands, personal shoots, and events on campus.',
    verified: true,
  },
  {
    id: 's3',
    title: 'Custom Outfit Design & Tailoring',
    serviceType: 'Fashion Designer',
    brandId: 'sv3',
    brand: 'ThreadWorks Atelier',
    price: '₦10,000 – ₦80,000',
    image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&q=80',
    portfolio: ['https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&q=80'],
    rating: 4.7,
    reviews: 64,
    whatsapp: '2348XXXXXXXXX',
    description: 'Bespoke custom outfits and alterations. From casual to formal — perfectly fitted for you.',
    verified: true,
  },
  {
    id: 's4',
    title: 'Hair Styling & Braiding',
    serviceType: 'Hair Stylist',
    brandId: 'sv4',
    brand: 'Crown & Mane',
    price: '₦3,000 – ₦20,000',
    image: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=600&q=80',
    portfolio: ['https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=600&q=80'],
    rating: 4.6,
    reviews: 93,
    whatsapp: '2348XXXXXXXXX',
    description: 'All hair types welcomed. Braids, weaves, natural styles, and more — done in your room or at the salon.',
    verified: false,
  },
];

export const CATEGORIES = [
  { id: 'all', label: 'All', icon: '✨' },
  { id: 'Clothing', label: 'Clothing', icon: '👕' },
  { id: 'Footwear', label: 'Footwear', icon: '👟' },
  { id: 'Bags', label: 'Bags', icon: '👜' },
  { id: 'Accessories', label: 'Accessories', icon: '🎩' },
  { id: 'Jewelry', label: 'Jewelry', icon: '💍' },
];

export const formatPrice = (price: number): string => {
  return `₦${price.toLocaleString('en-NG')}`;
};

export const getDiscount = (price: number, originalPrice: number): number => {
  return Math.round(((originalPrice - price) / originalPrice) * 100);
};
