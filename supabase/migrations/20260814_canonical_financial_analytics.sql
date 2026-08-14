create or replace function public.get_vendor_financial_summary(
  p_brand_id uuid,
  p_start timestamptz,
  p_end timestamptz
)
returns jsonb
language sql
security definer
set search_path = public
as $$
  with eligible_orders as (
    select o.*
    from public.orders o
    where o.brand_id = p_brand_id
      and o.created_at >= p_start
      and o.created_at < p_end
      and o.status in ('paid', 'preparing', 'ready', 'picked_up', 'in_transit', 'delivered', 'received')
  ),
  order_metrics as (
    select
      coalesce(sum(total_amount), 0) as gross_sales,
      coalesce(sum(vendor_earning), 0) as vendor_earnings,
      coalesce(sum(commission_amount), 0) as platform_revenue,
      coalesce(sum(delivery_fee_charged), 0) as delivery_revenue,
      count(*)::integer as order_count,
      coalesce(avg(total_amount), 0) as average_order_value,
      coalesce(sum(quantity), 0)::integer as sales_volume
    from eligible_orders
  ),
  brand_owner as (
    select owner_id from public.brands where id = p_brand_id limit 1
  ),
  payout_metrics as (
    select
      coalesce(sum(amount_requested) filter (where status in ('pending', 'processing')), 0) as pending_payouts,
      coalesce(sum(amount_requested) filter (where status = 'completed'), 0) as completed_payouts,
      coalesce(sum(amount_requested), 0) as withdrawn_amount
    from public.payout_requests p
    join brand_owner b on b.owner_id = p.user_id
    where p.created_at >= p_start and p.created_at < p_end
  ),
  transaction_metrics as (
    select
      count(*)::integer as transaction_count,
      coalesce(sum(amount) filter (where status in ('success', 'completed')), 0) as transaction_volume
    from public.transactions t
    where t.brand_id = p_brand_id
      and t.created_at >= p_start
      and t.created_at < p_end
  ),
  wallet_metrics as (
    select
      coalesce(available_balance, 0) as available_balance,
      coalesce(pending_balance, 0) as pending_earnings,
      coalesce(total_earnings, 0) as lifetime_earnings,
      coalesce(total_withdrawn, 0) as lifetime_withdrawn
    from public.wallets
    where brand_id = p_brand_id
    limit 1
  )
  select jsonb_build_object(
    'brand_id', p_brand_id,
    'period_start', p_start,
    'period_end', p_end,
    'gross_sales', coalesce((select gross_sales from order_metrics), 0),
    'vendor_earnings', coalesce((select vendor_earnings from order_metrics), 0),
    'platform_revenue', coalesce((select platform_revenue from order_metrics), 0),
    'delivery_revenue', coalesce((select delivery_revenue from order_metrics), 0),
    'order_count', coalesce((select order_count from order_metrics), 0),
    'sales_volume', coalesce((select sales_volume from order_metrics), 0),
    'average_order_value', coalesce((select average_order_value from order_metrics), 0),
    'pending_earnings', coalesce((select pending_earnings from wallet_metrics), 0),
    'available_balance', coalesce((select available_balance from wallet_metrics), 0),
    'withdrawn_amount', coalesce((select completed_payouts from payout_metrics), 0),
    'pending_payouts', coalesce((select pending_payouts from payout_metrics), 0),
    'completed_payouts', coalesce((select completed_payouts from payout_metrics), 0),
    'transaction_count', coalesce((select transaction_count from transaction_metrics), 0),
    'transaction_volume', coalesce((select transaction_volume from transaction_metrics), 0),
    'lifetime_earnings', coalesce((select lifetime_earnings from wallet_metrics), 0),
    'lifetime_withdrawn', coalesce((select lifetime_withdrawn from wallet_metrics), 0)
  );
$$;

create or replace function public.get_platform_financial_summary(
  p_start timestamptz,
  p_end timestamptz,
  p_university_id uuid default null
)
returns jsonb
language sql
security definer
set search_path = public
as $$
  with eligible_orders as (
    select o.*
    from public.orders o
    where o.created_at >= p_start
      and o.created_at < p_end
      and o.status in ('paid', 'preparing', 'ready', 'picked_up', 'in_transit', 'delivered', 'received')
      and (p_university_id is null or o.university_id = p_university_id)
  ),
  order_metrics as (
    select
      coalesce(sum(total_amount), 0) as marketplace_gmv,
      coalesce(sum(commission_amount), 0) as platform_revenue,
      coalesce(sum(vendor_earning), 0) as vendor_earnings,
      coalesce(sum(delivery_fee_charged), 0) as delivery_revenue,
      count(*)::integer as order_volume
    from eligible_orders
  ),
  scoped_brands as (
    select id, owner_id
    from public.brands
    where p_university_id is null or university_id = p_university_id
  ),
  payout_metrics as (
    select
      coalesce(sum(p.amount_requested) filter (where p.status in ('pending', 'processing')), 0) as pending_payouts,
      coalesce(sum(p.amount_requested) filter (where p.status = 'completed'), 0) as completed_payouts
    from public.payout_requests p
    join scoped_brands b on b.owner_id = p.user_id
    where p.created_at >= p_start and p.created_at < p_end
  ),
  transaction_metrics as (
    select
      count(*)::integer as transaction_count,
      coalesce(sum(t.amount) filter (where t.status in ('success', 'completed')), 0) as transaction_volume,
      coalesce(sum(t.amount) filter (where t.type = 'refund' and t.status in ('success', 'completed')), 0) as refunds
    from public.transactions t
    left join scoped_brands b on b.id = t.brand_id
    where t.created_at >= p_start
      and t.created_at < p_end
      and (p_university_id is null or b.id is not null)
  )
  select jsonb_build_object(
    'period_start', p_start,
    'period_end', p_end,
    'university_id', p_university_id,
    'marketplace_gmv', coalesce((select marketplace_gmv from order_metrics), 0),
    'platform_revenue', coalesce((select platform_revenue from order_metrics), 0),
    'vendor_earnings', coalesce((select vendor_earnings from order_metrics), 0),
    'delivery_revenue', coalesce((select delivery_revenue from order_metrics), 0),
    'pending_payouts', coalesce((select pending_payouts from payout_metrics), 0),
    'completed_payouts', coalesce((select completed_payouts from payout_metrics), 0),
    'order_volume', coalesce((select order_volume from order_metrics), 0),
    'transaction_count', coalesce((select transaction_count from transaction_metrics), 0),
    'transaction_volume', coalesce((select transaction_volume from transaction_metrics), 0),
    'refunds', coalesce((select refunds from transaction_metrics), 0)
  );
$$;

create or replace function public.get_university_gmv_rankings(
  p_start timestamptz,
  p_end timestamptz,
  p_university_id uuid default null
)
returns table (
  rank bigint,
  university_id uuid,
  university_name text,
  abbreviation text,
  gmv numeric,
  order_count bigint,
  sales_volume numeric,
  vendor_activity bigint,
  growth numeric
)
language sql
security definer
set search_path = public
as $$
  with current_period as (
    select
      coalesce(o.university_id, b.university_id) as university_id,
      coalesce(sum(o.total_amount), 0)::numeric as gmv,
      count(*)::bigint as order_count,
      coalesce(sum(o.quantity), 0)::numeric as sales_volume,
      count(distinct o.brand_id)::bigint as vendor_activity
    from public.orders o
    left join public.brands b on b.id = o.brand_id
    where o.created_at >= p_start
      and o.created_at < p_end
      and o.status in ('paid', 'preparing', 'ready', 'picked_up', 'in_transit', 'delivered', 'received')
      and (p_university_id is null or coalesce(o.university_id, b.university_id) = p_university_id)
    group by coalesce(o.university_id, b.university_id)
  ),
  previous_period as (
    select
      coalesce(o.university_id, b.university_id) as university_id,
      coalesce(sum(o.total_amount), 0)::numeric as gmv
    from public.orders o
    left join public.brands b on b.id = o.brand_id
    where o.created_at >= (p_start - (p_end - p_start))
      and o.created_at < p_start
      and o.status in ('paid', 'preparing', 'ready', 'picked_up', 'in_transit', 'delivered', 'received')
      and (p_university_id is null or coalesce(o.university_id, b.university_id) = p_university_id)
    group by coalesce(o.university_id, b.university_id)
  ),
  ranked as (
    select
      row_number() over (order by c.gmv desc, c.order_count desc, u.name asc) as rank,
      c.university_id,
      u.name as university_name,
      u.abbreviation,
      c.gmv,
      c.order_count,
      c.sales_volume,
      c.vendor_activity,
      case when coalesce(p.gmv, 0) = 0 then case when c.gmv > 0 then 100 else 0 end
           else round(((c.gmv - p.gmv) / p.gmv) * 100, 2) end as growth
    from current_period c
    join public.universities u on u.id = c.university_id
    left join previous_period p on p.university_id = c.university_id
  )
  select * from ranked order by rank;
$$;

create index if not exists orders_analytics_scope_idx on public.orders (created_at, status, brand_id, university_id);
create index if not exists transactions_analytics_scope_idx on public.transactions (created_at, status, brand_id, type);
create index if not exists payout_requests_analytics_scope_idx on public.payout_requests (created_at, status, user_id);

revoke all on function public.get_vendor_financial_summary(uuid, timestamptz, timestamptz) from public;
revoke all on function public.get_platform_financial_summary(timestamptz, timestamptz, uuid) from public;
revoke all on function public.get_university_gmv_rankings(timestamptz, timestamptz, uuid) from public;
grant execute on function public.get_vendor_financial_summary(uuid, timestamptz, timestamptz) to service_role;
grant execute on function public.get_platform_financial_summary(timestamptz, timestamptz, uuid) to service_role;
grant execute on function public.get_university_gmv_rankings(timestamptz, timestamptz, uuid) to service_role;
