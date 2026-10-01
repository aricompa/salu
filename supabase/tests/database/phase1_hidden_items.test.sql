-- Brief 04 task 9 (open decision 11, ruled 2026-09-30): place_order refuses items in a
-- hidden category or with no category, not only sold-out ones.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(8);

insert into auth.users (id, email, is_anonymous) values
  ('51111111-1111-1111-1111-111111111111', 'hidden-owner@example.com', false),
  ('5aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', null, true);

create temp table ctx (k text primary key, v text);
grant all on ctx to anon, authenticated;

-- ============================ owner sets up and seats a table =======================
set local role authenticated;
set local request.jwt.claims to '{"sub":"51111111-1111-1111-1111-111111111111","role":"authenticated","is_anonymous":false}';
insert into ctx values ('rest', public.create_restaurant('Hidden Kitchen', 'hidden-kitchen')::text);
insert into menu_categories (restaurant_id, name, is_active) select v::uuid, 'Mains', true from ctx where k = 'rest';
insert into menu_categories (restaurant_id, name, is_active) select v::uuid, 'Staff meal', false from ctx where k = 'rest';
insert into ctx select 'cat_staff', c.id::text from menu_categories c, ctx r
  where r.k = 'rest' and c.restaurant_id = r.v::uuid and c.name = 'Staff meal';
insert into menu_items (restaurant_id, category_id, name, price_cents)
  select r.v::uuid, c.id, 'Hidden Salmon', 2400 from ctx r, menu_categories c
  where r.k = 'rest' and c.restaurant_id = r.v::uuid and c.name = 'Mains';
insert into menu_items (restaurant_id, category_id, name, price_cents)
  select r.v::uuid, c.v::uuid, 'Secret Burger', 900 from ctx r, ctx c where r.k = 'rest' and c.k = 'cat_staff';
insert into menu_items (restaurant_id, category_id, name, price_cents)
  select v::uuid, null, 'Loose Fries', 600 from ctx where k = 'rest';
-- scope lookups to this restaurant: menus are publicly readable and seed.sql has its own
insert into ctx select 'salmon', m.id::text from menu_items m, ctx r
  where r.k = 'rest' and m.restaurant_id = r.v::uuid and m.name = 'Hidden Salmon';
insert into ctx select 'burger', m.id::text from menu_items m, ctx r
  where r.k = 'rest' and m.restaurant_id = r.v::uuid and m.name = 'Secret Burger';
insert into ctx select 'fries', m.id::text from menu_items m, ctx r
  where r.k = 'rest' and m.restaurant_id = r.v::uuid and m.name = 'Loose Fries';
insert into dining_tables (restaurant_id, label) select v::uuid, 'H1' from ctx where k = 'rest';
insert into ctx select 'token', t.qr_token from dining_tables t, ctx r
  where r.k = 'rest' and t.restaurant_id = r.v::uuid and t.label = 'H1';
insert into ctx select 'seated', public.open_table_session(t.id)::text from dining_tables t, ctx r
  where r.k = 'rest' and t.restaurant_id = r.v::uuid and t.label = 'H1';

select ok(not has_function_privilege('anon', 'public.place_order(uuid, jsonb, text)', 'execute'),
  'place_order keeps its grants after being redefined');

-- ============================ the diner orders ======================================
set local request.jwt.claims to '{"sub":"5aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated","is_anonymous":true}';
insert into ctx select 'session', session_id::text from public.join_table((select v from ctx where k = 'token'));

select lives_ok($$ select public.place_order((select v::uuid from ctx where k = 'session'),
                    jsonb_build_array(jsonb_build_object('menu_item_id', (select v from ctx where k = 'salmon'), 'quantity', 1))) $$,
  'positive control: an item in an active category can be ordered');
select throws_ok($$ select public.place_order((select v::uuid from ctx where k = 'session'),
                    jsonb_build_array(jsonb_build_object('menu_item_id', (select v from ctx where k = 'burger'), 'quantity', 1))) $$,
  'P0001', 'one or more items are unavailable or invalid', 'an item in a hidden category is refused');
select throws_ok($$ select public.place_order((select v::uuid from ctx where k = 'session'),
                    jsonb_build_array(jsonb_build_object('menu_item_id', (select v from ctx where k = 'fries'), 'quantity', 1))) $$,
  'P0001', 'one or more items are unavailable or invalid', 'an item with no category is refused');
select throws_ok($$ select public.place_order((select v::uuid from ctx where k = 'session'),
                    jsonb_build_array(
                      jsonb_build_object('menu_item_id', (select v from ctx where k = 'salmon'), 'quantity', 1),
                      jsonb_build_object('menu_item_id', (select v from ctx where k = 'burger'), 'quantity', 1))) $$,
  'P0001', 'one or more items are unavailable or invalid', 'one hidden item refuses the whole order');
select is((select count(*)::int from orders), 1, 'refused orders leave nothing behind (only the control order)');

-- ============================ un-hiding the category makes it orderable ============
set local request.jwt.claims to '{"sub":"51111111-1111-1111-1111-111111111111","role":"authenticated","is_anonymous":false}';
update menu_categories set is_active = true where id = (select v::uuid from ctx where k = 'cat_staff');

set local request.jwt.claims to '{"sub":"5aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated","is_anonymous":true}';
select lives_ok($$ select public.place_order((select v::uuid from ctx where k = 'session'),
                    jsonb_build_array(jsonb_build_object('menu_item_id', (select v from ctx where k = 'burger'), 'quantity', 1))) $$,
  'once its category is shown again, the item can be ordered');

-- ============================ hiding it again refuses it again ======================
set local request.jwt.claims to '{"sub":"51111111-1111-1111-1111-111111111111","role":"authenticated","is_anonymous":false}';
update menu_categories set is_active = false where id = (select v::uuid from ctx where k = 'cat_staff');

set local request.jwt.claims to '{"sub":"5aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated","is_anonymous":true}';
select throws_ok($$ select public.place_order((select v::uuid from ctx where k = 'session'),
                    jsonb_build_array(jsonb_build_object('menu_item_id', (select v from ctx where k = 'burger'), 'quantity', 1))) $$,
  'P0001', 'one or more items are unavailable or invalid', 'an item ordered before is refused once its category is hidden');

select * from finish();
rollback;
