-- Miles Search Engine performance and lookup indexes.
-- These indexes support exact/prefix/trigram search and scoped retrieval;
-- raw storage objects are intentionally not indexed as search results.
create extension if not exists pg_trgm;

create index if not exists brands_name_trgm_idx on public.brands using gin (name gin_trgm_ops);
create index if not exists brands_description_trgm_idx on public.brands using gin (description gin_trgm_ops);
create index if not exists brands_university_idx on public.brands (university_id, verification_status, name);
create index if not exists brands_owner_idx on public.brands (owner_id, name);

create index if not exists products_title_trgm_idx on public.products using gin (title gin_trgm_ops);
create index if not exists products_description_trgm_idx on public.products using gin (description gin_trgm_ops);
create index if not exists products_category_idx on public.products (category, university_id, is_draft);
create index if not exists products_brand_scope_idx on public.products (brand_id, is_draft, stock_count);
create index if not exists products_university_visibility_idx on public.products (university_id, visibility_type, is_draft);

create index if not exists reels_title_trgm_idx on public.reels using gin (title gin_trgm_ops);
create index if not exists reels_caption_trgm_idx on public.reels using gin (caption gin_trgm_ops);
create index if not exists reels_brand_scope_idx on public.reels (brand_id, status, created_at desc);
create index if not exists reels_university_scope_idx on public.reels (university_id, status, created_at desc);

create index if not exists orders_customer_recent_idx on public.orders (customer_id, created_at desc);
create index if not exists orders_brand_recent_idx on public.orders (brand_id, created_at desc);
create index if not exists orders_university_recent_idx on public.orders (university_id, created_at desc);

create index if not exists users_name_trgm_idx on public.users using gin (name gin_trgm_ops);
create index if not exists users_email_trgm_idx on public.users using gin (email gin_trgm_ops);
create index if not exists users_university_role_idx on public.users (university_id, role, status);

notify pgrst, 'reload schema';
