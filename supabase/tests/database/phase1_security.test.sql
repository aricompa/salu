-- Phase 1 security tests. Run with: supabase test db
-- Each block switches identity the same way PostgREST does: a role plus JWT claims.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(33);

-- fixtures ---------------------------------------------------------------------
insert into auth.users (id, email, is_anonymous) values
  ('11111111-1111-1111-1111-111111111111', 'owner-a@example.com', false),
  ('22222222-2222-2222-2222-222222222222', 'owner-b@example.com', false),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', null, true),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', null, true),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', null, true);

create temp table ctx (k text primary key, v text);
grant all on ctx to anon, authenticated;

-- ============================ owner A sets up =====================================
set local role authenticated;
set local request.jwt.claims to '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated","is_anonymous":false}';

select lives_ok($$ insert into ctx values ('rest_a', public.create_restaurant('Casa Grande', 'casa-grande')::text) $$,
  'staff user can create a restaurant');
select is((select role::text from restaurant_members where user_id = auth.uid()), 'owner',
  'creator becomes owner');

insert into menu_categories (restaurant_id, name) select v::uuid, 'Mains' from ctx where k = 'rest_a';
insert into menu_items (restaurant_id, category_id, name, price_cents)
  select r.v::uuid, c.id, 'Grilled Salmon', 2400 from ctx r, menu_categories c where r.k = 'rest_a';
insert into menu_items (restaurant_id, name, price_cents, is_available)
  select v::uuid, 'Lobster Roll', 3200, false from ctx where k = 'rest_a';
insert into ctx select 'item_ok', id::text from menu_items where name = 'Grilled Salmon';
insert into ctx select 'item_86', id::text from menu_items where name = 'Lobster Roll';

select lives_ok($$ insert into dining_tables (restaurant_id, label, capacity) select v::uuid, 'A4', 4 from ctx where k = 'rest_a' $$,
  'owner can add a table');
select is((select char_length(qr_token) from dining_tables where label = 'A4'), 32,
  'qr_token is generated server-side (32 hex chars)');
insert into ctx select 'token', qr_token from dining_tables where label = 'A4';
select throws_ok($$ insert into dining_tables (restaurant_id, label, qr_token) select v::uuid, 'B1', 'chosen' from ctx where k = 'rest_a' $$,
  '42501', null, 'clients cannot choose a qr_token');

-- ============================ owner B (other restaurant) ==========================
set local request.jwt.claims to '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated","is_anonymous":false}';
select lives_ok($$ insert into ctx values ('rest_b', public.create_restaurant('Other Place', 'other-place')::text) $$,
  'second owner creates their own restaurant');
insert into menu_items (restaurant_id, name, price_cents) select v::uuid, 'Foreign Burger', 1500 from ctx where k = 'rest_b';
insert into ctx select 'item_b', id::text from menu_items where name = 'Foreign Burger';

select is((select count(*)::int from dining_tables), 0, 'owner B cannot see owner A tables');
select is((select count(*)::int from restaurant_settings where restaurant_id = (select v::uuid from ctx where k = 'rest_a')), 0,
  'owner B cannot see owner A settings');
select is_empty($$ update menu_items set price_cents = 1 where name = 'Grilled Salmon' returning id $$,
  'owner B cannot edit owner A menu');

-- ============================ anonymous diner 1 ===================================
set local request.jwt.claims to '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated","is_anonymous":true}';

select throws_ok($$ select public.create_restaurant('Sneaky', 'sneaky') $$, '42501', null,
  'anonymous diner cannot create a restaurant');
select is((select count(*)::int from dining_tables), 0, 'diner cannot read tables or QR tokens');
select is((select count(*)::int from restaurant_settings), 0, 'diner cannot read restaurant settings');
select ok((select count(*) from menu_items where restaurant_id = (select v::uuid from ctx where k = 'rest_a')) = 2,
  'diner can read the menu, including sold-out items');

select throws_ok($$ select * from public.join_table('not-a-real-token') $$, 'P0002', null,
  'unknown QR token is rejected');
select lives_ok($$ insert into ctx select 'session', session_id::text from public.join_table((select v from ctx where k = 'token'), 'Ari') $$,
  'diner joins the table from the QR token');

select throws_ok($$ insert into orders (restaurant_id, session_id, subtotal_cents, editable_until)
                    select (select v::uuid from ctx where k='rest_a'), (select v::uuid from ctx where k='session'), 0, now() $$,
  '42501', null, 'diner cannot insert orders directly');

select lives_ok($$ insert into ctx select 'order_1', public.place_order(
                    (select v::uuid from ctx where k = 'session'),
                    jsonb_build_array(jsonb_build_object('menu_item_id', (select v from ctx where k = 'item_ok'), 'quantity', 2)))::text $$,
  'seated diner can place an order');
select is((select subtotal_cents from orders where id = (select v::uuid from ctx where k = 'order_1')), 4800,
  'subtotal is computed from database prices');
select ok((select editable_until > submitted_at from orders where id = (select v::uuid from ctx where k = 'order_1')),
  'edit window is stamped from restaurant settings');

select throws_ok($$ select public.place_order((select v::uuid from ctx where k = 'session'),
                    jsonb_build_array(jsonb_build_object('menu_item_id', (select v from ctx where k = 'item_86'), 'quantity', 1))) $$,
  'P0001', null, 'sold-out item is rejected');
select throws_ok($$ select public.place_order((select v::uuid from ctx where k = 'session'),
                    jsonb_build_array(jsonb_build_object('menu_item_id', (select v from ctx where k = 'item_b'), 'quantity', 1))) $$,
  'P0001', null, 'item from another restaurant is rejected');
select throws_ok($$ select public.place_order((select v::uuid from ctx where k = 'session'),
                    jsonb_build_array(jsonb_build_object('menu_item_id', (select v from ctx where k = 'item_ok'), 'quantity', 500))) $$,
  'P0001', null, 'absurd quantity is rejected');

select is_empty($$ update orders set status = 'served' returning id $$, 'diner cannot change order status');

-- ============================ anonymous diner 2 (same table) ======================
set local request.jwt.claims to '{"sub":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","role":"authenticated","is_anonymous":true}';
select is((select session_id::text from public.join_table((select v from ctx where k = 'token'))),
          (select v from ctx where k = 'session'), 'second diner lands in the same open session');
select is((select count(*)::int from orders), 0, 'Phase 1: diners only see their own orders');

-- ============================ anonymous diner 3 (not seated) ======================
set local request.jwt.claims to '{"sub":"cccccccc-cccc-cccc-cccc-cccccccccccc","role":"authenticated","is_anonymous":true}';
select throws_ok($$ select public.place_order((select v::uuid from ctx where k = 'session'),
                    jsonb_build_array(jsonb_build_object('menu_item_id', (select v from ctx where k = 'item_ok'), 'quantity', 1))) $$,
  '42501', null, 'diner who never scanned cannot order to that table');

-- ============================ owner A runs service ================================
set local request.jwt.claims to '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated","is_anonymous":false}';
select is((select count(*)::int from orders), 1, 'owner sees orders for their restaurant');
select lives_ok($$ update orders set status = 'accepted' where id = (select v::uuid from ctx where k = 'order_1') $$,
  'owner can accept an order');
select throws_ok($$ update orders set status = 'submitted' where id = (select v::uuid from ctx where k = 'order_1') $$,
  'P0001', null, 'order state machine blocks invalid transitions');
select throws_ok($$ update orders set subtotal_cents = 1 where id = (select v::uuid from ctx where k = 'order_1') $$,
  '42501', null, 'staff cannot rewrite order totals');

select lives_ok($$ select public.rotate_table_qr((select id from dining_tables where label = 'A4')) $$,
  'owner can rotate a table QR');

-- ============================ old QR is dead ======================================
set local request.jwt.claims to '{"sub":"cccccccc-cccc-cccc-cccc-cccccccccccc","role":"authenticated","is_anonymous":true}';
select throws_ok($$ select * from public.join_table((select v from ctx where k = 'token')) $$, 'P0002', null,
  'rotated (old) QR token no longer works');

-- ============================ signed-out visitor ==================================
set local role anon;
set local request.jwt.claims to '{"role":"anon"}';
select throws_ok($$ select count(*) from orders $$, '42501', null, 'signed-out visitor cannot touch orders');

select * from finish();
rollback;
