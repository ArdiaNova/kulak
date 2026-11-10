-- Kulak schema. Run once in the Supabase SQL Editor.
create extension if not exists "pgcrypto";

create table if not exists items (
  id uuid primary key default gen_random_uuid(),
  sku text unique not null,
  name text not null,
  unit text not null,
  stock numeric not null default 0,
  reorder_point numeric not null,
  avg_daily_use numeric not null,
  created_at timestamptz default now()
);

create table if not exists suppliers (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  approved boolean not null default true,
  notes text
);

create table if not exists supplier_quotes (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references suppliers(id) on delete cascade,
  item_id uuid not null references items(id) on delete cascade,
  unit_price numeric(12,3) not null,
  last_paid_price numeric(12,3),
  moq numeric not null default 1,
  lead_days int not null default 2,
  unique (supplier_id, item_id)
);

create table if not exists mandate (
  id int primary key default 1 check (id = 1),
  mode text not null default 'manual' check (mode in ('manual','auto')),
  currency text not null default 'USD',
  weekly_budget numeric(12,2) not null default 600,
  auto_approve_cap numeric(12,2) not null default 200,
  hard_block_cap numeric(12,2) not null default 600,
  max_qty_multiple numeric not null default 2.5,
  max_price_spike_pct numeric not null default 20,
  updated_at timestamptz default now()
);

create table if not exists purchase_orders (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references suppliers(id),
  status text not null default 'drafted' check (status in
    ('drafted','pending_approval','approved','paying','paid','delivered','denied','rejected','payment_failed')),
  total numeric(12,2) not null,
  currency text not null default 'USD',
  rationale text,
  guard_decision text,
  guard_reasons jsonb not null default '[]'::jsonb,
  created_by text not null default 'agent',
  payout_batch_id text,
  payout_item_status text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists po_lines (
  id uuid primary key default gen_random_uuid(),
  po_id uuid not null references purchase_orders(id) on delete cascade,
  item_id uuid not null references items(id),
  qty numeric not null,
  unit_price numeric(12,3) not null
);

create table if not exists events (
  id bigint generated always as identity primary key,
  ts timestamptz default now(),
  actor text not null check (actor in ('agent','guard','human','paypal','system')),
  type text not null,
  po_id uuid,
  detail jsonb not null default '{}'::jsonb
);

-- The app uses the service-role key (bypasses RLS). Enabling RLS with no policies
-- means the public anon key cannot read or write anything.
alter table items enable row level security;
alter table suppliers enable row level security;
alter table supplier_quotes enable row level security;
alter table mandate enable row level security;
alter table purchase_orders enable row level security;
alter table po_lines enable row level security;
alter table events enable row level security;
