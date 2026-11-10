-- Reset the demo between takes. Run in the Supabase SQL Editor.
-- Clears orders and audit log, restores stock and the default mandate.
truncate table po_lines, purchase_orders, events restart identity cascade;

update items set stock = 6   where sku = 'BEANS-ESP';
update items set stock = 14  where sku = 'MILK-WHL';
update items set stock = 20  where sku = 'MILK-OAT';
update items set stock = 180 where sku = 'CUP-12';
update items set stock = 220 where sku = 'LID-12';
update items set stock = 3   where sku = 'SYR-VAN';

update mandate set mode = 'manual', weekly_budget = 600, auto_approve_cap = 200,
  hard_block_cap = 600, max_qty_multiple = 2.5, max_price_spike_pct = 20,
  updated_at = now() where id = 1;
