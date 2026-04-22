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
  [key: string]: any;
}

export interface Service {
  id: string;
  brand_id: string;
  title: string;
  description: string;
  price: number;
  category: string;
  created_at: string;
  brand?: any;
  [key: string]: any;
}

export interface Vendor {
  id: string;
  owner_id: string;
  name: string;
  description: string;
  logo_url: string;
  verification_status: string;
  created_at: string;
  [key: string]: any;
}

export interface Order {
  id: string;
  buyer_id: string;
  brand_id: string;
  total_amount: number;
  status: string;
  created_at: string;
  [key: string]: any;
}

interface MarketplaceState {
  products: Product[];
  services: Service[];
  vendors: Vendor[];
  orders: Order[];
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

  setInitialized: (status: boolean) => void;
}

export const useMarketplaceStore = create<MarketplaceState>((set) => ({
  products: [],
  services: [],
  vendors: [],
  orders: [],
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

  setInitialized: (status) => set({ isInitialized: status }),
}));
