export interface ReelProduct {
  id: string;
  reel_id: string;
  product_id: string;
  sort_order: number;
  products?: {
    id: string;
    title: string;
    price: number;
    original_price?: number | null;
    image_url?: string;
    media_urls?: string[];
    stock_count: number;
  };
}

export interface ReelComment {
  id: string;
  reel_id: string;
  user_id: string;
  content: string;
  created_at: string;
  users?: {
    name?: string;
    email?: string;
  };
}

export interface Reel {
  id: string;
  brand_id: string;
  video_url: string;
  thumbnail_url?: string;
  title?: string;
  caption?: string;
  duration?: number;
  status: 'draft' | 'processing' | 'published' | 'hidden' | 'rejected' | 'deleted';
  views_count: number;
  likes_count: number;
  comments_count: number;
  shares_count: number;
  product_section?: 'fashion' | 'delicacies';
  created_at: string;
  brands?: {
    id: string;
    owner_id: string;
    name: string;
    whatsapp_number: string;
    verified: boolean;
    logo_url?: string;
  };
  reel_products?: ReelProduct[];
  is_liked_by_user?: boolean;
}
