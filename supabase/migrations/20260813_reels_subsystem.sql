-- ABUAD Fashion Hub: Reels Subsystem Migration
-- Tables: reels, reel_products, reel_likes, reel_comments, reel_views

create table if not exists public.reels (
  id uuid default gen_random_uuid() primary key,
  brand_id uuid references public.brands(id) on delete cascade not null,
  video_url text not null,
  thumbnail_url text,
  title text,
  caption text,
  duration numeric,
  status text default 'published' check (status in ('draft', 'processing', 'published', 'hidden', 'rejected', 'deleted')),
  views_count bigint default 0,
  likes_count bigint default 0,
  comments_count bigint default 0,
  shares_count bigint default 0,
  product_section text default 'fashion' check (product_section in ('fashion', 'delicacies')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  published_at timestamp with time zone default timezone('utc'::text, now())
);

create table if not exists public.reel_products (
  id uuid default gen_random_uuid() primary key,
  reel_id uuid references public.reels(id) on delete cascade not null,
  product_id uuid references public.products(id) on delete cascade not null,
  sort_order int default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(reel_id, product_id)
);

create table if not exists public.reel_likes (
  id uuid default gen_random_uuid() primary key,
  reel_id uuid references public.reels(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(reel_id, user_id)
);

create table if not exists public.reel_comments (
  id uuid default gen_random_uuid() primary key,
  reel_id uuid references public.reels(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  content text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists public.reel_views (
  id uuid default gen_random_uuid() primary key,
  reel_id uuid references public.reels(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete set null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.reels enable row level security;
alter table public.reel_products enable row level security;
alter table public.reel_likes enable row level security;
alter table public.reel_comments enable row level security;
alter table public.reel_views enable row level security;

-- Policies
create policy "Reels are viewable by everyone" on public.reels for select using (status = 'published');
create policy "Vendors can manage their own reels" on public.reels for all using (
  auth.uid() in (select owner_id from public.brands where id = brand_id)
);

create policy "Reel products viewable by everyone" on public.reel_products for select using (true);
create policy "Vendors can manage reel products" on public.reel_products for all using (
  auth.uid() in (select b.owner_id from public.brands b join public.reels r on r.brand_id = b.id where r.id = reel_id)
);

create policy "Reel likes viewable by everyone" on public.reel_likes for select using (true);
create policy "Authenticated users can manage their likes" on public.reel_likes for all using (auth.uid() = user_id);

create policy "Reel comments viewable by everyone" on public.reel_comments for select using (true);
create policy "Authenticated users can insert comments" on public.reel_comments for insert with check (auth.uid() = user_id);
create policy "Users can delete their own comments" on public.reel_comments for delete using (auth.uid() = user_id);

create policy "Anyone can insert views" on public.reel_views for insert with check (true);
create policy "Views viewable by everyone" on public.reel_views for select using (true);
