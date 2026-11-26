alter table public.customers
  add column contact_name text,
  add column phone text,
  add column delivery_address text;

create table public.signups (
  id bigint generated always as identity primary key,
  telegram_user_id bigint not null,
  telegram_chat_id bigint not null,
  telegram_name text,
  telegram_username text,
  status text not null default 'collecting' check (status in ('collecting', 'pending', 'approved', 'rejected')),
  step text not null default 'business_name' check (step in ('business_name', 'contact_name', 'phone', 'address', 'review')),
  business_name text check (char_length(business_name) <= 120),
  contact_name text check (char_length(contact_name) <= 80),
  phone text check (char_length(phone) <= 20),
  delivery_address text check (char_length(delivery_address) <= 300),
  customer_id uuid references public.customers(id),
  created_at timestamptz not null default now(),
  submitted_at timestamptz,
  decided_at timestamptz,
  decided_by uuid,
  notified_at timestamptz
);

create unique index signups_one_open on public.signups (telegram_user_id)
  where status in ('collecting', 'pending');

alter table public.signups enable row level security;
create policy authenticated_select_signups on public.signups for select to authenticated using (true);

revoke all on public.signups from public, anon, authenticated;
revoke all on sequence public.signups_id_seq from public, anon, authenticated;
grant select on public.signups to authenticated;
grant all on public.signups to service_role;
grant usage, select on sequence public.signups_id_seq to service_role;

create or replace function public.decide_signup(
  p_id bigint,
  p_decision text,
  p_name text default null,
  p_kind text default null,
  p_tier_id smallint default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_staff_id uuid := auth.uid();
  v_signup public.signups%rowtype;
  v_customer_id uuid;
begin
  if v_staff_id is null then
    raise exception using errcode = '42501', message = 'sign-in required to decide a signup';
  end if;

  if p_decision is null or p_decision not in ('approve', 'reject') then
    raise exception using errcode = '22023', message = 'invalid signup decision';
  end if;

  select * into v_signup
  from public.signups
  where id = p_id and status = 'pending'
  for update;

  if not found then
    return 'handled';
  end if;

  if p_decision = 'approve' then
    if coalesce(char_length(trim(p_name)), 0) not between 1 and 120 then
      raise exception using errcode = '22023', message = 'invalid customer name';
    end if;

    if p_kind is null or p_kind not in ('cafe', 'restaurant', 'hotel') then
      raise exception using errcode = '22023', message = 'invalid customer kind';
    end if;

    if p_tier_id is null or not exists (select 1 from public.tiers where id = p_tier_id) then
      raise exception using errcode = '22023', message = 'invalid customer tier';
    end if;

    insert into public.customers (name, kind, tier_id, telegram_user_id, contact_name, phone, delivery_address)
    values (trim(p_name), p_kind, p_tier_id, v_signup.telegram_user_id, v_signup.contact_name, v_signup.phone, v_signup.delivery_address)
    on conflict (telegram_user_id) do nothing
    returning id into v_customer_id;

    if not found then
      return 'already_linked';
    end if;

    update public.signups
    set status = 'approved',
        customer_id = v_customer_id,
        decided_at = now(),
        decided_by = v_staff_id
    where id = v_signup.id;

    return 'approved';
  end if;

  update public.signups
  set status = 'rejected',
      decided_at = now(),
      decided_by = v_staff_id
  where id = v_signup.id;

  return 'rejected';
end;
$$;

revoke all on function public.decide_signup(bigint, text, text, text, smallint) from public, anon, service_role;
grant execute on function public.decide_signup(bigint, text, text, text, smallint) to authenticated;

alter publication supabase_realtime add table public.signups;
