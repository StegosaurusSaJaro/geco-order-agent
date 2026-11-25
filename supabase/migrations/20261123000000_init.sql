create type order_status as enum ('draft', 'needs_review', 'confirmed', 'fulfilled', 'cancelled', 'expired');

create table tiers (
  id smallint primary key,
  code text unique not null check (code in ('cafe', 'restaurant_group', 'hotel_chain')),
  name text not null,
  discount_pct numeric(5,2) not null
);

create table units_of_measure (
  code text primary key,
  name text not null,
  base_qty int not null
);

create table products (
  sku text primary key,
  name text not null,
  category text not null check (category in ('dairy', 'coffee_tea', 'dry_goods', 'sauces', 'packaging')),
  unit_code text not null references units_of_measure(code),
  list_price numeric(10,2) not null,
  aliases text[] not null default '{}',
  active boolean not null default true
);

create table tier_prices (
  tier_id smallint not null references tiers(id),
  sku text not null references products(sku),
  unit_price numeric(10,2) not null,
  primary key (tier_id, sku)
);

create table customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind text not null check (kind in ('cafe', 'restaurant', 'hotel')),
  tier_id smallint not null references tiers(id),
  telegram_user_id bigint unique,
  created_at timestamptz not null default now()
);

create table conversations (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id),
  telegram_chat_id bigint not null,
  created_at timestamptz not null default now()
);

create table messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id),
  direction text not null check (direction in ('in', 'out')),
  author text not null check (author in ('customer', 'bot', 'staff')),
  kind text not null check (kind in ('text', 'file', 'photo', 'voice', 'button')),
  body text,
  file_name text,
  file_mime text,
  telegram_message_id bigint,
  created_at timestamptz not null default now()
);

create table orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id),
  conversation_id uuid not null references conversations(id),
  status order_status not null,
  source text not null check (source in ('text', 'pdf', 'xlsx', 'xls', 'photo', 'voice')),
  po_number text,
  version int not null default 1,
  currency text not null default 'USD',
  total numeric(12,2) not null,
  review_reasons text[] not null default '{}',
  expires_at timestamptz,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table order_lines (
  order_id uuid not null references orders(id),
  version int not null,
  line_no int not null,
  sku text not null references products(sku),
  quantity numeric(10,2) not null check (quantity > 0),
  unit_code text not null references units_of_measure(code),
  unit_price numeric(10,2) not null,
  line_total numeric(12,2) not null,
  primary key (order_id, version, line_no)
);

create table order_messages (
  order_id uuid not null references orders(id),
  message_id uuid not null references messages(id),
  primary key (order_id, message_id)
);

create table screening_log (
  id bigint generated always as identity primary key,
  telegram_user_id bigint not null,
  decision text not null check (decision in ('allow', 'rate_limited', 'abuse', 'spam', 'off_topic', 'injection')),
  reason text not null,
  latency_ms int not null,
  created_at timestamptz not null default now()
);

create table model_calls (
  id bigint generated always as identity primary key,
  order_id uuid references orders(id),
  model text not null,
  purpose text not null check (purpose in ('order_read', 'intent_check', 'voice')),
  input_tokens int not null,
  output_tokens int not null,
  latency_ms int not null,
  ok boolean not null,
  created_at timestamptz not null default now()
);

create index idx_products_unit_code on products(unit_code);
create index idx_tier_prices_tier_id on tier_prices(tier_id);
create index idx_tier_prices_sku on tier_prices(sku);
create index idx_customers_tier_id on customers(tier_id);
create index idx_conversations_customer_id on conversations(customer_id);
create index idx_messages_conversation_id on messages(conversation_id);
create index idx_orders_customer_id on orders(customer_id);
create index idx_orders_conversation_id on orders(conversation_id);
create index idx_order_lines_order_id on order_lines(order_id);
create index idx_order_lines_sku on order_lines(sku);
create index idx_order_lines_unit_code on order_lines(unit_code);
create index idx_order_messages_order_id on order_messages(order_id);
create index idx_order_messages_message_id on order_messages(message_id);
create index idx_model_calls_order_id on model_calls(order_id);
create index idx_orders_status on orders(status);
create index idx_orders_created_at on orders(created_at);
create index idx_messages_conversation_id_created_at on messages(conversation_id, created_at);

alter table tiers enable row level security;
alter table units_of_measure enable row level security;
alter table products enable row level security;
alter table tier_prices enable row level security;
alter table customers enable row level security;
alter table conversations enable row level security;
alter table messages enable row level security;
alter table orders enable row level security;
alter table order_lines enable row level security;
alter table order_messages enable row level security;
alter table screening_log enable row level security;
alter table model_calls enable row level security;

create policy authenticated_select_tiers on tiers for select to authenticated using (true);
create policy authenticated_select_units_of_measure on units_of_measure for select to authenticated using (true);
create policy authenticated_select_products on products for select to authenticated using (true);
create policy authenticated_select_tier_prices on tier_prices for select to authenticated using (true);
create policy authenticated_select_customers on customers for select to authenticated using (true);
create policy authenticated_select_conversations on conversations for select to authenticated using (true);
create policy authenticated_select_messages on messages for select to authenticated using (true);
create policy authenticated_select_orders on orders for select to authenticated using (true);
create policy authenticated_select_order_lines on order_lines for select to authenticated using (true);
create policy authenticated_select_order_messages on order_messages for select to authenticated using (true);
create policy authenticated_select_screening_log on screening_log for select to authenticated using (true);
create policy authenticated_select_model_calls on model_calls for select to authenticated using (true);

create policy authenticated_update_orders on orders for update to authenticated using (true) with check (true);
create policy authenticated_update_order_lines on order_lines for update to authenticated using (true) with check (true);

create policy authenticated_insert_messages on messages for insert to authenticated with check (true);
create policy authenticated_insert_order_lines on order_lines for insert to authenticated with check (true);

grant usage on schema public to anon, authenticated, service_role;

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

grant select on all tables in schema public to authenticated;
grant update on orders, order_lines to authenticated;
grant insert on messages, order_lines to authenticated;

grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;
