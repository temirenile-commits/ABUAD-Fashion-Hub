-- MasterCart university context switching and vendor target-audience approval workflow
create table if not exists public.vendor_university_change_requests (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.brands(id) on delete cascade,
  requesting_user_id uuid not null references public.users(id) on delete restrict,
  current_university_id uuid references public.universities(id) on delete restrict,
  requested_university_id uuid not null references public.universities(id) on delete restrict,
  reason text not null check (char_length(trim(reason)) between 10 and 500),
  vendor_verification_status text not null,
  status text not null default 'PENDING' check (status in ('PENDING','APPROVED','REJECTED','CANCELLED')),
  reviewed_by uuid references public.users(id) on delete set null,
  admin_message text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create index if not exists vendor_uni_change_requests_status_idx on public.vendor_university_change_requests(status, created_at desc);
create index if not exists vendor_uni_change_requests_requested_uni_idx on public.vendor_university_change_requests(requested_university_id, status);
create index if not exists vendor_uni_change_requests_vendor_idx on public.vendor_university_change_requests(vendor_id, created_at desc);
create unique index if not exists vendor_uni_change_requests_one_pending_idx
  on public.vendor_university_change_requests(vendor_id, requested_university_id)
  where status = 'PENDING';

alter table public.vendor_university_change_requests enable row level security;

drop policy if exists vendor_uni_change_requests_service_role on public.vendor_university_change_requests;
create policy vendor_uni_change_requests_service_role on public.vendor_university_change_requests
  for all to service_role using (true) with check (true);

create or replace function public.switch_marketplace_university(p_user_id uuid, p_university_id uuid)
returns public.users
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user public.users;
  v_university public.universities;
begin
  select * into v_user from public.users where id = p_user_id for update;
  if not found then raise exception 'User profile not found'; end if;
  if v_user.role not in ('customer', 'user') then raise exception 'Only customers can change marketplace context'; end if;
  select * into v_university from public.universities where id = p_university_id and coalesce(is_active, true);
  if not found then raise exception 'Selected university is not active'; end if;
  update public.users set university_id = v_university.id where id = p_user_id returning * into v_user;
  return v_user;
end;
$$;

create or replace function public.submit_vendor_university_change_request(
  p_vendor_id uuid,
  p_requesting_user_id uuid,
  p_requested_university_id uuid,
  p_reason text
)
returns public.vendor_university_change_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_brand public.brands;
  v_requested public.universities;
  v_request public.vendor_university_change_requests;
  v_admin record;
  v_reason text := trim(coalesce(p_reason, ''));
begin
  select * into v_brand from public.brands where id = p_vendor_id and owner_id = p_requesting_user_id for update;
  if not found then raise exception 'Vendor profile not found or not owned by requester'; end if;
  if coalesce(v_brand.verified, false) is not true or coalesce(v_brand.verification_status, '') <> 'approved' then
    raise exception 'University target changes are available only to verified vendors';
  end if;
  if char_length(v_reason) < 10 or char_length(v_reason) > 500 then raise exception 'Reason must be between 10 and 500 characters'; end if;
  select * into v_requested from public.universities where id = p_requested_university_id and coalesce(is_active, true);
  if not found then raise exception 'Requested university is not active'; end if;
  if v_brand.university_id is not distinct from p_requested_university_id then raise exception 'This is already the current target university'; end if;
  if exists (select 1 from public.vendor_university_change_requests where vendor_id = v_brand.id and requested_university_id = p_requested_university_id and status = 'PENDING') then
    raise exception 'A request for this target university is already pending';
  end if;
  insert into public.vendor_university_change_requests(vendor_id, requesting_user_id, current_university_id, requested_university_id, reason, vendor_verification_status)
  values (v_brand.id, p_requesting_user_id, v_brand.university_id, p_requested_university_id, v_reason, coalesce(v_brand.verification_status, 'unknown'))
  returning * into v_request;
  for v_admin in select id from public.users where role in ('university_admin','university_staff','admin','super_admin') and (role in ('admin','super_admin') or university_id = p_requested_university_id) loop
    insert into public.notifications(user_id, type, title, content, link, is_read, university_id)
    values (v_admin.id, 'vendor_university_change', 'New vendor university change request', 'A verified vendor has requested to target your university marketplace.', '/university-admin?tab=university_change_requests', false, p_requested_university_id);
  end loop;
  return v_request;
end;
$$;

create or replace function public.cancel_vendor_university_change_request(p_request_id uuid, p_user_id uuid)
returns public.vendor_university_change_requests
language plpgsql security definer set search_path = public
as $$
declare v_request public.vendor_university_change_requests;
begin
  update public.vendor_university_change_requests r
  set status='CANCELLED', reviewed_at=now(), reviewed_by=p_user_id, admin_message='Cancelled by vendor'
  from public.brands b
  where r.id=p_request_id and r.vendor_id=b.id and b.owner_id=p_user_id and r.status='PENDING'
  returning r.* into v_request;
  if not found then raise exception 'Pending request not found'; end if;
  return v_request;
end;
$$;

create or replace function public.review_vendor_university_change_request(
  p_request_id uuid,
  p_admin_id uuid,
  p_decision text,
  p_message text default null
)
returns public.vendor_university_change_requests
language plpgsql security definer set search_path = public
as $$
declare
  v_request public.vendor_university_change_requests;
  v_brand public.brands;
  v_admin public.users;
  v_target public.universities;
  v_title text;
  v_content text;
begin
  select * into v_admin from public.users where id=p_admin_id and role in ('university_admin','university_staff','admin','super_admin');
  if not found then raise exception 'Not authorized to review requests'; end if;
  select r.* into v_request from public.vendor_university_change_requests r where r.id=p_request_id for update;
  if not found then raise exception 'Request not found'; end if;
  if v_request.status <> 'PENDING' then raise exception 'This request has already been reviewed'; end if;
  if v_admin.role not in ('admin','super_admin') and v_admin.university_id is distinct from v_request.requested_university_id then raise exception 'You are not authorized for the requested university'; end if;
  select * into v_brand from public.brands where id=v_request.vendor_id for update;
  if not found then raise exception 'Vendor profile not found'; end if;
  if upper(p_decision)='APPROVE' then
    if coalesce(v_brand.verified,false) is not true or coalesce(v_brand.verification_status,'') <> 'approved' then raise exception 'Vendor is no longer verified'; end if;
    select * into v_target from public.universities where id=v_request.requested_university_id and coalesce(is_active,true);
    if not found then raise exception 'Requested university is no longer active'; end if;
    update public.brands set university_id=v_request.requested_university_id where id=v_brand.id;
    update public.products set university_id=v_request.requested_university_id where brand_id=v_brand.id;
    update public.reels set university_id=v_request.requested_university_id where brand_id=v_brand.id;
    v_request.status := 'APPROVED';
    v_title := 'University target change approved';
    v_content := 'Your request to change your target university has been approved.';
  elsif upper(p_decision)='REJECT' then
    v_request.status := 'REJECTED';
    v_title := 'University target change rejected';
    v_content := 'Your request to change your target university was not approved.';
  else raise exception 'Decision must be APPROVE or REJECT'; end if;
  update public.vendor_university_change_requests set status=v_request.status, reviewed_by=p_admin_id, admin_message=nullif(trim(coalesce(p_message,'')),''), reviewed_at=now() where id=p_request_id returning * into v_request;
  insert into public.notifications(user_id,type,title,content,link,is_read,university_id)
  values ((select owner_id from public.brands where id=v_request.vendor_id), 'vendor_university_change', v_title, v_content || case when nullif(trim(coalesce(p_message,'')),'') is not null then ' Admin message: ' || trim(p_message) else '' end, '/dashboard/vendor?tab=settings', false, v_request.requested_university_id);
  return v_request;
end;
$$;

create or replace function public.message_vendor_university_change_request(p_request_id uuid, p_admin_id uuid, p_message text)
returns boolean language plpgsql security definer set search_path = public
as $$
declare v_request public.vendor_university_change_requests; v_admin public.users; v_owner uuid;
begin
  if char_length(trim(coalesce(p_message,''))) < 2 or char_length(p_message)>1000 then raise exception 'Message is required'; end if;
  select * into v_admin from public.users where id=p_admin_id and role in ('university_admin','university_staff','admin','super_admin');
  select * into v_request from public.vendor_university_change_requests where id=p_request_id;
  if not found or v_request.status <> 'PENDING' then raise exception 'Pending request not found'; end if;
  if not found then raise exception 'Not authorized'; end if;
  if v_admin.role not in ('admin','super_admin') and v_admin.university_id is distinct from v_request.requested_university_id then raise exception 'Not authorized for this request'; end if;
  select owner_id into v_owner from public.brands where id=v_request.vendor_id;
  insert into public.messages(sender_id, receiver_id, content, is_read) values (p_admin_id, v_owner, trim(p_message), false);
  insert into public.notifications(user_id,type,title,content,link,is_read,university_id) values (v_owner,'vendor_university_change','University admin sent you a message',trim(p_message),'/dashboard/vendor?tab=settings',false,v_request.requested_university_id);
  return true;
end;
$$;

revoke all on function public.switch_marketplace_university(uuid,uuid) from public;
revoke all on function public.submit_vendor_university_change_request(uuid,uuid,uuid,text) from public;
revoke all on function public.cancel_vendor_university_change_request(uuid,uuid) from public;
revoke all on function public.review_vendor_university_change_request(uuid,uuid,text,text) from public;
revoke all on function public.message_vendor_university_change_request(uuid,uuid,text) from public;
grant execute on function public.switch_marketplace_university(uuid,uuid) to service_role;
grant execute on function public.submit_vendor_university_change_request(uuid,uuid,uuid,text) to service_role;
grant execute on function public.cancel_vendor_university_change_request(uuid,uuid) to service_role;
grant execute on function public.review_vendor_university_change_request(uuid,uuid,text,text) to service_role;
grant execute on function public.message_vendor_university_change_request(uuid,uuid,text) to service_role;
