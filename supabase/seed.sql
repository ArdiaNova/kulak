-- Kulak seed data. Run once in the Supabase SQL Editor, after schema.sql.
insert into mandate (id) values (1) on conflict (id) do nothing;

insert into items (sku, name, unit, stock, reorder_point, avg_daily_use) values
  ('BEANS-ESP', 'Espresso beans (house blend)', 'kg',     6,   8,   1.8),
  ('MILK-WHL',  'Whole milk',                   'L',     14,  30,   9),
  ('MILK-OAT',  'Oat milk',                     'L',     20,  12,   3),
  ('CUP-12',    'Paper cups 12oz',              'pcs',  180, 400, 120),
  ('LID-12',    'Cup lids 12oz',                'pcs',  220, 400, 120),
  ('SYR-VAN',   'Vanilla syrup 750ml',          'bottle', 3,   4,   0.5)
on conflict (sku) do nothing;

insert into suppliers (name, approved, notes) values
  ('Bean & Co Roasters',   true,  'Specialty roaster'),
  ('CheapBeans Trading',   false, 'Cheapest beans, NOT on the approved list'),
  ('FreshDairy Supply',    true,  'Daily dairy delivery'),
  ('PackRight Packaging',  true,  'Cups and lids, slower delivery'),
  ('QuickCup Wholesale',   true,  'Cups and lids, faster but pricier')
on conflict (name) do nothing;

insert into supplier_quotes (supplier_id, item_id, unit_price, last_paid_price, moq, lead_days)
select s.id, i.id, q.unit_price, q.last_paid, q.moq, q.lead
from (values
  ('Bean & Co Roasters',  'BEANS-ESP', 14.500, 12.000,   5, 3),
  ('Bean & Co Roasters',  'SYR-VAN',    6.200,  6.000,   2, 3),
  ('CheapBeans Trading',  'BEANS-ESP', 11.200, null,     5, 2),
  ('FreshDairy Supply',   'MILK-WHL',   1.150,  1.120,  20, 1),
  ('FreshDairy Supply',   'MILK-OAT',   2.100,  2.100,  12, 1),
  ('PackRight Packaging', 'CUP-12',     0.095,  0.094, 500, 4),
  ('PackRight Packaging', 'LID-12',     0.050,  0.050, 500, 4),
  ('QuickCup Wholesale',  'CUP-12',     0.105,  null,  200, 1),
  ('QuickCup Wholesale',  'LID-12',     0.055,  null,  200, 1)
) as q(supplier, sku, unit_price, last_paid, moq, lead)
join suppliers s on s.name = q.supplier
join items i on i.sku = q.sku
on conflict (supplier_id, item_id) do nothing;
