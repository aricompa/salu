-- Linked add-ons (ruled 2026-10-03): who can link add-ons to items, and how place_order
-- prices and records them under their line.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(42);

insert into auth.users (id, email, is_anonymous) values
  ('61111111-1111-1111-1111-111111111111', 'addon-owner@example.com', false),
  ('62222222-2222-2222-2222-222222222222', 'addon-staff@example.com', false),
  ('63333333-3333-3333-3333-333333333333', 'other-owner@example.com', false),
  ('6aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', null, true),
  ('6bbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', null, true);

create temp table ctx (k text primary key, v text);
grant all on ctx to anon, authenticated;

-- ============================ owner sets up a menu with add-ons ======================
set local role authenticated;
set local request.jwt.claims to '{"sub":"61111111-1111-1111-1111-111111111111","role":"authenticated","is_anonymous":false}';
insert into ctx values ('rest', public.create_restaurant('Addon Diner', 'addon-diner')::text);
insert into menu_categories (restaurant_id, name, is_active) select v::uuid, 'Burgers', true from ctx where k = 'rest';
insert into menu_categories (restaurant_id, name, is_active) select v::uuid, 'Add-ons', true from ctx where k = 'rest';
insert into menu_categories (restaurant_id, name, is_active) select v::uuid, 'Old add-ons', false from ctx where k = 'rest';
-- scope lookups to this restaurant: menus are publicly readable and seed.sql has its own
insert into ctx select 'cat_' || lower(replace(c.name, ' ', '_')), c.id::text from menu_categories c, ctx r
  where r.k = 'rest' and c.restaurant_id = r.v::uuid;

insert into menu_items (restaurant_id, category_id, name, price_cents, addon_only)
  select r.v::uuid, c.v::uuid, x.name, x.price, x.addon_only
  from ctx r, ctx c,
       (values ('Smash Burger', 1500, false, 'cat_burgers'),
               ('Veggie Burger', 1700, false, 'cat_burgers'),
               ('Add Patty', 600, true, 'cat_add-ons'),
               ('Add Bacon', 300, true, 'cat_add-ons'),
               ('Add Truffle', 900, true, 'cat_old_add-ons'),
               -- an add-on at first, so it can be linked; un-flagged below (a stale link)
               ('Side Fries', 500, true, 'cat_add-ons')) as x(name, price, addon_only, cat)
  where r.k = 'rest' and c.k = x.cat;
insert into ctx select lower(replace(m.name, ' ', '_')), m.id::text from menu_items m, ctx r
  where r.k = 'rest' and m.restaurant_id = r.v::uuid;

-- a floor staff member (rule 5: staff 86 items, never edit the menu)
reset role;
insert into restaurant_members (restaurant_id, user_id, role)
  select v::uuid, '62222222-2222-2222-2222-222222222222', 'staff' from ctx where k = 'rest';
set local role authenticated;

select ok((select relrowsecurity from pg_class where oid = 'public.menu_item_addons'::regclass),
  'menu_item_addons has RLS on');
select ok(not has_table_privilege('anon', 'public.menu_item_addons', 'insert')
      and not has_table_privilege('anon', 'public.menu_item_addons', 'delete'),
  'anon cannot write links');
select ok(not has_table_privilege('authenticated', 'public.menu_item_addons', 'update'),
  'nobody updates a link in place (delete and insert instead)');

select lives_ok($$
  insert into menu_item_addons (restaurant_id, item_id, addon_id)
  select r.v::uuid, i.v::uuid, a.v::uuid from ctx r, ctx i, ctx a
  where r.k = 'rest' and i.k = 'smash_burger' and a.k in ('add_patty', 'add_bacon', 'add_truffle', 'side_fries') $$,
  'the owner links add-ons to an item');
select throws_ok($$
  insert into menu_item_addons (restaurant_id, item_id, addon_id)
  select r.v::uuid, i.v::uuid, i.v::uuid from ctx r, ctx i where r.k = 'rest' and i.k = 'smash_burger' $$,
  '23514', null, 'an item cannot be its own add-on');
with changed as (
  update menu_items set addon_only = false where id = (select v::uuid from ctx where k = 'side_fries') returning 1
) select is((select count(*)::int from changed), 1, 'the owner can change whether an item is add-on-only');
select throws_ok($$
  insert into menu_item_addons (restaurant_id, item_id, addon_id)
  select r.v::uuid, i.v::uuid, a.v::uuid from ctx r, ctx i, ctx a
  where r.k = 'rest' and i.k = 'veggie_burger' and a.k = 'side_fries' $$,
  '23514', 'an add-on must be add-on-only, and the item it goes with must not be',
  'the database refuses a link to an item that is not add-on-only');
select throws_ok($$
  insert into menu_item_addons (restaurant_id, item_id, addon_id)
  select r.v::uuid, i.v::uuid, a.v::uuid from ctx r, ctx i, ctx a
  where r.k = 'rest' and i.k = 'add_patty' and a.k = 'add_bacon' $$,
  '23514', 'an add-on must be add-on-only, and the item it goes with must not be',
  'the database refuses add-ons on an add-on-only item');
insert into menu_item_addons (restaurant_id, item_id, addon_id)
  select r.v::uuid, i.v::uuid, a.v::uuid from ctx r, ctx i, ctx a
  where r.k = 'rest' and i.k = 'veggie_burger' and a.k = 'add_bacon';
with gone as (
  delete from menu_item_addons
  where item_id = (select v::uuid from ctx where k = 'veggie_burger')
    and addon_id = (select v::uuid from ctx where k = 'add_bacon')
  returning 1
) select is((select count(*)::int from gone), 1, 'the owner can unlink an add-on');

-- an order big enough to pass what orders.subtotal_cents holds: 30 lines x 50 x $11,000
insert into menu_items (restaurant_id, category_id, name, price_cents)
  select r.v::uuid, c.v::uuid, 'Gold Burger', 1000000 from ctx r, ctx c where r.k = 'rest' and c.k = 'cat_burgers';
insert into menu_items (restaurant_id, category_id, name, price_cents, addon_only)
  select r.v::uuid, c.v::uuid, 'Gold Leaf ' || n, 1000000, true
  from ctx r, ctx c, generate_series(1, 10) as n where r.k = 'rest' and c.k = 'cat_add-ons';
insert into ctx select 'gold_burger', m.id::text from menu_items m, ctx r
  where r.k = 'rest' and m.restaurant_id = r.v::uuid and m.name = 'Gold Burger';
insert into ctx select 'gold_leaves', jsonb_agg(m.id)::text from menu_items m, ctx r
  where r.k = 'rest' and m.restaurant_id = r.v::uuid and m.name like 'Gold Leaf %';
insert into menu_item_addons (restaurant_id, item_id, addon_id)
  select m.restaurant_id, (select v::uuid from ctx where k = 'gold_burger'), m.id
  from menu_items m, ctx r where r.k = 'rest' and m.restaurant_id = r.v::uuid and m.name like 'Gold Leaf %';

-- ============================ floor staff cannot change links =======================
set local request.jwt.claims to '{"sub":"62222222-2222-2222-2222-222222222222","role":"authenticated","is_anonymous":false}';
select throws_ok($$
  insert into menu_item_addons (restaurant_id, item_id, addon_id)
  select r.v::uuid, i.v::uuid, a.v::uuid from ctx r, ctx i, ctx a
  where r.k = 'rest' and i.k = 'veggie_burger' and a.k = 'add_patty' $$,
  '42501', null, 'floor staff cannot link an add-on');
select is((select count(*)::int from menu_item_addons
           where item_id = (select v::uuid from ctx where k = 'smash_burger')), 4,
  'positive control: floor staff can read the links');
with gone as (
  delete from menu_item_addons where item_id = (select v::uuid from ctx where k = 'smash_burger') returning 1
) select is((select count(*)::int from gone), 0, 'floor staff cannot unlink an add-on (0 rows)');
with changed as (
  update menu_items set addon_only = true where id = (select v::uuid from ctx where k = 'veggie_burger') returning 1
) select is((select count(*)::int from changed), 0, 'floor staff cannot make an item add-on-only (0 rows)');

-- ============================ another restaurant cannot touch them =================
set local request.jwt.claims to '{"sub":"63333333-3333-3333-3333-333333333333","role":"authenticated","is_anonymous":false}';
insert into ctx values ('other', public.create_restaurant('Other Grill', 'other-grill')::text);
insert into menu_categories (restaurant_id, name, is_active) select v::uuid, 'Extras', true from ctx where k = 'other';
insert into menu_items (restaurant_id, category_id, name, price_cents, addon_only)
  select r.v::uuid, c.id, 'Other Cheese', 100, true from ctx r, menu_categories c
  where r.k = 'other' and c.restaurant_id = r.v::uuid;
insert into menu_items (restaurant_id, category_id, name, price_cents)
  select r.v::uuid, c.id, 'Other Burger', 1200 from ctx r, menu_categories c
  where r.k = 'other' and c.restaurant_id = r.v::uuid;
insert into ctx select lower(replace(m.name, ' ', '_')), m.id::text from menu_items m, ctx r
  where r.k = 'other' and m.restaurant_id = r.v::uuid;

select throws_ok($$
  insert into menu_item_addons (restaurant_id, item_id, addon_id)
  select r.v::uuid, i.v::uuid, a.v::uuid from ctx r, ctx i, ctx a
  where r.k = 'rest' and i.k = 'veggie_burger' and a.k = 'add_patty' $$,
  '42501', null, 'another restaurant''s owner cannot link add-ons here');
select throws_ok($$
  insert into menu_item_addons (restaurant_id, item_id, addon_id)
  select r.v::uuid, i.v::uuid, a.v::uuid from ctx r, ctx i, ctx a
  where r.k = 'other' and i.k = 'other_burger' and a.k = 'add_patty' $$,
  '23503', null, 'a link cannot reach another restaurant''s item');
with gone as (
  delete from menu_item_addons where item_id = (select v::uuid from ctx where k = 'smash_burger') returning 1
) select is((select count(*)::int from gone), 0, 'another restaurant''s owner cannot unlink (0 rows)');

-- ============================ anyone can read links (the diner menu) ===============
set local role anon;
set local request.jwt.claims to '{"role":"anon"}';
select is((select count(*)::int from menu_item_addons
           where item_id = (select v::uuid from ctx where k = 'smash_burger')), 4,
  'anon reads links, as it reads the menu');
set local role authenticated;

-- ============================ seat a table; the diner orders ========================
set local request.jwt.claims to '{"sub":"61111111-1111-1111-1111-111111111111","role":"authenticated","is_anonymous":false}';
insert into dining_tables (restaurant_id, label) select v::uuid, 'A1' from ctx where k = 'rest';
insert into ctx select 'token', t.qr_token from dining_tables t, ctx r
  where r.k = 'rest' and t.restaurant_id = r.v::uuid and t.label = 'A1';
select public.open_table_session(t.id) from dining_tables t, ctx r
  where r.k = 'rest' and t.restaurant_id = r.v::uuid and t.label = 'A1';

set local request.jwt.claims to '{"sub":"6aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated","is_anonymous":true}';
insert into ctx select 'session', session_id::text from public.join_table((select v from ctx where k = 'token'));

select ok(not has_function_privilege('anon', 'public.place_order(uuid, jsonb, text)', 'execute'),
  'place_order keeps its grants after being redefined');

-- a burger x2 with patty and bacon; the client sends a price, which is ignored
insert into ctx select 'order1', public.place_order((select v::uuid from ctx where k = 'session'),
  jsonb_build_array(jsonb_build_object(
    'menu_item_id', (select v from ctx where k = 'smash_burger'), 'quantity', 2, 'price_cents', 1,
    'addon_ids', jsonb_build_array((select v from ctx where k = 'add_patty'), (select v from ctx where k = 'add_bacon')))))::text;

select is((select count(*)::int from order_items where order_id = (select v::uuid from ctx where k = 'order1')), 3,
  'an item with two add-ons is three lines');
select is((select subtotal_cents from orders where id = (select v::uuid from ctx where k = 'order1')), 2 * (1500 + 600 + 300),
  'the subtotal counts each add-on once per burger, at database prices');
select results_eq($$
  select a.item_name, a.unit_price_cents, a.quantity
  from order_items a join order_items p on p.id = a.parent_id
  where p.order_id = (select v::uuid from ctx where k = 'order1') and p.item_name = 'Smash Burger'
  order by a.item_name $$,
  $$ values ('Add Bacon'::text, 300, 2), ('Add Patty'::text, 600, 2) $$,
  'add-ons point at their burger, priced and named by the database, quantity following the burger');
select is((select count(*)::int from order_items
           where order_id = (select v::uuid from ctx where k = 'order1') and parent_id is null), 1,
  'only the burger is a line of its own');

select lives_ok($$ select public.place_order((select v::uuid from ctx where k = 'session'),
                    jsonb_build_array(jsonb_build_object('menu_item_id', (select v from ctx where k = 'veggie_burger'), 'quantity', 1))) $$,
  'a line without addon_ids orders as before');
select lives_ok($$ select public.place_order((select v::uuid from ctx where k = 'session'),
                    jsonb_build_array(jsonb_build_object('menu_item_id', (select v from ctx where k = 'veggie_burger'), 'quantity', 1,
                      'addon_ids', '[]'::jsonb))) $$,
  'an empty addon_ids list orders the item alone');

-- ============================ what place_order refuses ==============================
select throws_ok($$ select public.place_order((select v::uuid from ctx where k = 'session'),
                    jsonb_build_array(jsonb_build_object('menu_item_id', (select v from ctx where k = 'veggie_burger'), 'quantity', 1,
                      'addon_ids', jsonb_build_array((select v from ctx where k = 'add_patty'))))) $$,
  'P0001', 'one or more items are unavailable or invalid', 'an add-on not linked to this item is refused');
select throws_ok($$ select public.place_order((select v::uuid from ctx where k = 'session'),
                    jsonb_build_array(jsonb_build_object('menu_item_id', (select v from ctx where k = 'add_patty'), 'quantity', 1))) $$,
  'P0001', 'one or more items are unavailable or invalid', 'an add-on-only item cannot be ordered on its own');
select throws_ok($$ select public.place_order((select v::uuid from ctx where k = 'session'),
                    jsonb_build_array(jsonb_build_object('menu_item_id', (select v from ctx where k = 'smash_burger'), 'quantity', 1,
                      'addon_ids', jsonb_build_array((select v from ctx where k = 'side_fries'))))) $$,
  'P0001', 'one or more items are unavailable or invalid', 'a linked item that is not add-on-only is refused as an add-on');
select throws_ok($$ select public.place_order((select v::uuid from ctx where k = 'session'),
                    jsonb_build_array(jsonb_build_object('menu_item_id', (select v from ctx where k = 'smash_burger'), 'quantity', 1,
                      'addon_ids', jsonb_build_array((select v from ctx where k = 'add_truffle'))))) $$,
  'P0001', 'one or more items are unavailable or invalid', 'an add-on in a hidden category is refused');
select throws_ok($$ select public.place_order((select v::uuid from ctx where k = 'session'),
                    jsonb_build_array(jsonb_build_object('menu_item_id', (select v from ctx where k = 'smash_burger'), 'quantity', 1,
                      'addon_ids', jsonb_build_array((select v from ctx where k = 'add_patty'), (select v from ctx where k = 'add_patty'))))) $$,
  '22023', 'at most 10 different add-ons per line', 'the same add-on twice on one line is refused');
select throws_ok($$ select public.place_order((select v::uuid from ctx where k = 'session'),
                    jsonb_build_array(jsonb_build_object('menu_item_id', (select v from ctx where k = 'smash_burger'), 'quantity', 1,
                      'addon_ids', (select jsonb_agg(gen_random_uuid()) from generate_series(1, 11))))) $$,
  '22023', 'at most 10 different add-ons per line', 'more than 10 add-ons on one line is refused');
select throws_ok($$ select public.place_order((select v::uuid from ctx where k = 'session'),
                    jsonb_build_array(jsonb_build_object('menu_item_id', (select v from ctx where k = 'smash_burger'), 'quantity', 1,
                      'addon_ids', jsonb_build_array('not-an-id')))) $$,
  '22023', 'add-ons must be item ids', 'an add-on that is not an id is refused');
select throws_ok($$ select public.place_order((select v::uuid from ctx where k = 'session'),
                    jsonb_build_array(jsonb_build_object('menu_item_id', (select v from ctx where k = 'smash_burger'), 'quantity', 1,
                      'addon_ids', (select v from ctx where k = 'add_patty')))) $$,
  '22023', 'add-ons must be an array', 'add-ons that are not a list are refused');
select throws_ok($$ select public.place_order((select v::uuid from ctx where k = 'session'),
                    jsonb_build_array(jsonb_build_object('menu_item_id', (select v from ctx where k = 'smash_burger'), 'quantity', 1,
                      'addon_ids', jsonb_build_array((select v from ctx where k = 'other_cheese'))))) $$,
  'P0001', 'one or more items are unavailable or invalid', 'another restaurant''s add-on is refused');

-- sold out: floor staff 86 the patty
set local request.jwt.claims to '{"sub":"62222222-2222-2222-2222-222222222222","role":"authenticated","is_anonymous":false}';
select public.set_item_availability((select v::uuid from ctx where k = 'add_patty'), false);
set local request.jwt.claims to '{"sub":"6aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated","is_anonymous":true}';
select throws_ok($$ select public.place_order((select v::uuid from ctx where k = 'session'),
                    jsonb_build_array(
                      jsonb_build_object('menu_item_id', (select v from ctx where k = 'veggie_burger'), 'quantity', 1),
                      jsonb_build_object('menu_item_id', (select v from ctx where k = 'smash_burger'), 'quantity', 1,
                        'addon_ids', jsonb_build_array((select v from ctx where k = 'add_patty'))))) $$,
  'P0001', 'one or more items are unavailable or invalid', 'a sold-out add-on refuses the whole order');
select is((select count(*)::int from orders where session_id = (select v::uuid from ctx where k = 'session')), 3,
  'refused orders leave nothing behind (only the three that went through)');

-- ============================ who sees the add-on lines =============================
select is((select count(*)::int from order_items where order_id = (select v::uuid from ctx where k = 'order1')), 3,
  'the diner sees their own add-on lines');
set local request.jwt.claims to '{"sub":"6bbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","role":"authenticated","is_anonymous":true}';
select is((select count(*)::int from order_items where order_id = (select v::uuid from ctx where k = 'order1')), 0,
  'another diner sees none of them');

-- ============================ the schema keeps add-ons in their order ===============
reset role;
insert into ctx select 'order2', o.id::text from orders o
  where o.session_id = (select v::uuid from ctx where k = 'session') and o.id <> (select v::uuid from ctx where k = 'order1')
  limit 1;
select throws_ok($$
  insert into order_items (order_id, parent_id, menu_item_id, item_name, unit_price_cents, quantity)
  select (select v::uuid from ctx where k = 'order2'), p.id, null, 'Stray Patty', 600, 1
  from order_items p where p.order_id = (select v::uuid from ctx where k = 'order1') and p.parent_id is null $$,
  '23503', null, 'an add-on line cannot point at a line in another order');

select throws_ok($$
  delete from order_items
  where order_id = (select v::uuid from ctx where k = 'order1') and item_name = 'Smash Burger' $$,
  '23503', null, 'a line with add-ons cannot be deleted on its own (no cascade)');

-- deleting an item removes its links, not order history
delete from menu_items where id = (select v::uuid from ctx where k = 'add_bacon');
select is((select count(*)::int from menu_item_addons where addon_id = (select v::uuid from ctx where k = 'add_bacon')), 0,
  'deleting an add-on removes its links');
select is((select count(*)::int from order_items
           where order_id = (select v::uuid from ctx where k = 'order1') and item_name = 'Add Bacon'), 1,
  'the order keeps its add-on line after the item is deleted');

set local role authenticated;
set local request.jwt.claims to '{"sub":"6aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated","is_anonymous":true}';
select throws_ok($$ select public.place_order((select v::uuid from ctx where k = 'session'),
                    (select jsonb_agg(jsonb_build_object('menu_item_id', (select v from ctx where k = 'gold_burger'),
                                                         'quantity', 50,
                                                         'addon_ids', (select v::jsonb from ctx where k = 'gold_leaves')))
                     from generate_series(1, 30))) $$,
  '22023', 'order total too large', 'an order past what the subtotal holds is refused, not overflowed');

select * from finish();
rollback;
