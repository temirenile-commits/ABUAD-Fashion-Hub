

import { create } from 'zustand';

// Basic interfaces matching our Supabase schema
export interface Product {
  id: string;
  brand_id: string;
  title: string;
  description: string;
  price: number;
  original_price: number | null;
  category: string;
  media_urls: string[];
  image_url?: string;
  video_url?: string;
  is_draft: boolean;
  is_featured: boolean;
  locked: boolean;
  stock_count: number;
  views_count: number;
  sales_count: number;
  boost_level: number;
  created_at: string;
  updated_at?: string;
  brands: {
    id: string;
    owner_id: string;
    name: string;
    whatsapp_number: string;
    verified: boolean;
    logo_url?: string;
  };
  rating?: number;
  reviews?: number;
  sold?: number;
  product_section?: 'fashion' | 'delicacies';
  [key: string]: unknown;
}

export interface Service {
  id: string;
  brand_id: string;
  title: string;
  description: string;
  price: number;
  category: string;
  created_at: string;
  // Service-specific fields
  service_type?: string;
  portfolio_urls?: string[];
  is_draft?: boolean;
  // Join fields
  brands?: {
    id?: string;
    name: string;
    whatsapp_number: string;
    verified?: boolean;
    logo_url?: string;
  } | null;
  [key: string]: unknown;
}

export interface Vendor {
  id: string;
  owner_id: string;
  name: string;
  description: string;
  logo_url: string;
  verification_status: string;
  created_at: string;
  [key: string]: unknown;
}

export interface Order {
  id: string;
  buyer_id: string;
  customer_id?: string;
  brand_id: string;
  total_amount: number;
  status: string;
  created_at: string;
  expires_at?: string;
  paystack_reference?: string;
  delivery_method?: string;
  delivery_code?: string;
  // Supabase join fields
  products?: { title: string } | null;
  users?: { id?: string; name?: string; email?: string; phone?: string } | null;
  deliveries?: Array<{
    id: string;
    status: string;
    agent_id?: string;
    delivery_code?: string;
    users?: { id?: string; name?: string; phone?: string } | null;
  }> | null;
  [key: string]: unknown;
}

export interface Reel {
  id: string;
  brand_id: string;
  video_url: string;
  thumbnail_url?: string;
  title?: string;
  created_at: string;
  brands?: {
    name: string;
    logo_url?: string;
  };
  product_section?: 'fashion' | 'delicacies';
}

interface MarketplaceState {
  products: Product[];
  services: Service[];
  vendors: Vendor[];
  orders: Order[];
  reels: Reel[];
  isInitialized: boolean;

  // Actions
  setProducts: (products: Product[]) => void;
  addProduct: (product: Product) => void;
  updateProduct: (id: string, product: Partial<Product>) => void;
  removeProduct: (id: string) => void;

  setServices: (services: Service[]) => void;
  addService: (service: Service) => void;
  updateService: (id: string, service: Partial<Service>) => void;
  removeService: (id: string) => void;

  setVendors: (vendors: Vendor[]) => void;
  addVendor: (vendor: Vendor) => void;
  updateVendor: (id: string, vendor: Partial<Vendor>) => void;
  
  setOrders: (orders: Order[]) => void;
  addOrder: (order: Order) => void;
  updateOrder: (id: string, order: Partial<Order>) => void;

  setReels: (reels: Reel[]) => void;
  addReel: (reel: Reel) => void;
  removeReel: (id: string) => void;

  setInitialized: (status: boolean) => void;
}

export const useMarketplaceStore = create<MarketplaceState>((set) => ({
  products: [],
  services: [],
  vendors: [],
  orders: [],
  reels: [],
  isInitialized: false,

  setProducts: (products) => set({ products }),
  addProduct: (product) => set((state) => {
    if (state.products.find(p => p.id === product.id)) return state;
    return { products: [product, ...state.products] };
  }),
  updateProduct: (id, updates) => set((state) => ({
    products: state.products.map(p => p.id === id ? { ...p, ...updates } : p)
  })),
  removeProduct: (id) => set((state) => ({
    products: state.products.filter(p => p.id !== id)
  })),

  setServices: (services) => set({ services }),
  addService: (service) => set((state) => {
    if (state.services.find(s => s.id === service.id)) return state;
    return { services: [service, ...state.services] };
  }),
  updateService: (id, updates) => set((state) => ({
    services: state.services.map(s => s.id === id ? { ...s, ...updates } : s)
  })),
  removeService: (id) => set((state) => ({
    services: state.services.filter(s => s.id !== id)
  })),

  setVendors: (vendors) => set({ vendors }),
  addVendor: (vendor) => set((state) => {
    if (state.vendors.find(v => v.id === vendor.id)) return state;
    return { vendors: [vendor, ...state.vendors] };
  }),
  updateVendor: (id, updates) => set((state) => ({
    vendors: state.vendors.map(v => v.id === id ? { ...v, ...updates } : v)
  })),

  setOrders: (orders) => set({ orders }),
  addOrder: (order) => set((state) => {
    if (state.orders.find(o => o.id === order.id)) return state;
    return { orders: [order, ...state.orders] };
  }),
  updateOrder: (id, updates) => set((state) => ({
    orders: state.orders.map(o => o.id === id ? { ...o, ...updates } : o)
  })),

  setReels: (reels) => set({ reels }),
  addReel: (reel) => set((state) => {
    if (state.reels.find(r => r.id === reel.id)) return state;
    return { reels: [reel, ...state.reels] };
  }),
  removeReel: (id) => set((state) => ({
    reels: state.reels.filter(r => r.id !== id)
  })),

  setInitialized: (status) => set({ isInitialized: status }),
}));
