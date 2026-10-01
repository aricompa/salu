-- Brief 02 portal tests: the writes the menu, tables and settings pages rely on.
-- RLS does not raise on an UPDATE or DELETE it filters out; the statement just changes
-- 0 rows. So "cannot change" tests count affected rows instead of expecting an error.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(25);

insert into auth.users (id, email, is_anonymous) values
  ('31111111-1111-1111-1111-111111111111', 'portal-owner-a@example.com', false),
  ('32222222-2222-2222-2222-222222222222', 'portal-owner-b@example.com', false),
  ('3ddddddd-dddd-dddd-dddd-dddddddddddd', 'portal-staff-a@example.com', false),
  ('3eeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', null, true);

create temp table ctx (k text primary key, v text);
grant all on ctx to anon, authenticated;

-- ============================ owner A sets up =====================================
set local role authenticated;
set local request.jwt.claims to '{"sub":"31111111-1111-1111-1111-111111111111","role":"authenticated","is_anonymous":false}';

select lives_ok($$ insert into ctx values ('rest', public.create_restaurant('Portal Grill', 'portal-grill')::text) $$,
  'owner creates a restaurant');

insert into menu_categories (restaurant_id, name) select v::uuid, 'Mains' from ctx where k = 'rest';
insert into menu_categories (restaurant_id, name) select v::uuid, 'Empty' from ctx where k = 'rest';
-- scope every lookup to this restaurant: seed.sql has its own menu, and menus are public
insert into ctx select 'cat_mains', c.id::text from menu_categories c, ctx r
  where r.k = 'rest' and c.restaurant_id = r.v::uuid and c.name = 'Mains';
insert into ctx select 'cat_empty', c.id::text from menu_categories c, ctx r
  where r.k = 'rest' and c.restaurant_id = r.v::uuid and c.name = 'Empty';
insert into menu_items (restaurant_id, category_id, name, price_cents)
  select r.v::uuid, c.v::uuid, 'Portal Salmon', 2400 from ctx r, ctx c where r.k = 'rest' and c.k = 'cat_mains';
insert into menu_items (restaurant_id, category_id, name, price_cents)
  select r.v::uuid, c.v::uuid, 'Portal Fries', 600 from ctx r, ctx c where r.k = 'rest' and c.k = 'cat_mains';
insert into ctx select 'salmon', m.id::text from menu_items m, ctx r
  where r.k = 'rest' and m.restaurant_id = r.v::uuid and m.name = 'Portal Salmon';
insert into ctx select 'fries', m.id::text from menu_items m, ctx r
  where r.k = 'rest' and m.restaurant_id = r.v::uuid and m.name = 'Portal Fries';
insert into dining_tables (restaurant_id, label) select v::uuid, 'P1' from ctx where k = 'rest';
insert into dining_tables (restaurant_id, label) select v::uuid, 'P2' from ctx where k = 'rest';
insert into ctx select 'p1', t.id::text from dining_tables t, ctx r
  where r.k = 'rest' and t.restaurant_id = r.v::uuid and t.label = 'P1';
insert into ctx select 'p2_token', t.qr_token from dining_tables t, ctx r
  where r.k = 'rest' and t.restaurant_id = r.v::uuid and t.label = 'P2';
-- staff seat P2 before a diner joins it (Brief 04 prank protection, on by default)
insert into ctx select 'p2_seated', public.open_table_session(t.id)::text from dining_tables t, ctx r
  where r.k = 'rest' and t.restaurant_id = r.v::uuid and t.label = 'P2';

reset role;
insert into restaurant_members (restaurant_id, user_id, role)
  select v::uuid, '3ddddddd-dddd-dddd-dddd-dddddddddddd', 'staff' from ctx where k = 'rest';

-- ============================ floor staff: read and 86 only =======================
set local role authenticated;
set local request.jwt.claims to '{"sub":"3ddddddd-dddd-dddd-dddd-dddddddddddd","role":"authenticated","is_anonymous":false}';

select throws_ok($$ insert into menu_categories (restaurant_id, name) select v::uuid, 'Staff Special' from ctx where k = 'rest' $$,
  '42501', null, 'floor staff cannot add a category');
select throws_ok($$ insert into dining_tables (restaurant_id, label) select v::uuid, 'S1' from ctx where k = 'rest' $$,
  '42501', null, 'floor staff cannot add a table');
select results_eq($$ with u as (update menu_categories set name = 'Renamed' where id = (select v::uuid from ctx where k = 'cat_mains') returning 1)
                     select count(*)::int from u $$, $$ values (0) $$,
  'floor staff cannot rename a category (0 rows)');
select results_eq($$ with u as (update restaurant_settings set order_edit_window_mins = 30 where restaurant_id = (select v::uuid from ctx where k = 'rest') returning 1)
                     select count(*)::int from u $$, $$ values (0) $$,
  'floor staff cannot change order settings (0 rows)');
select results_eq($$ with u as (update restaurants set name = 'Staff Place', timezone = 'UTC' where id = (select v::uuid from ctx where k = 'rest') returning 1)
                     select count(*)::int from u $$, $$ values (0) $$,
  'floor staff cannot rename the restaurant or change its time zone (0 rows)');
select results_eq($$ with u as (update dining_tables set is_active = false where id = (select v::uuid from ctx where k = 'p1') returning 1)
                     select count(*)::int from u $$, $$ values (0) $$,
  'floor staff cannot deactivate a table (0 rows)');
select results_eq($$ with u as (delete from menu_items where id = (select v::uuid from ctx where k = 'fries') returning 1)
                     select count(*)::int from u $$, $$ values (0) $$,
  'floor staff cannot delete an item (0 rows)');
select throws_ok($$ select public.rotate_table_qr((select v::uuid from ctx where k = 'p1')) $$,
  '42501', null, 'floor staff cannot rotate a QR code');
select is((select count(*)::int from dining_tables where restaurant_id = (select v::uuid from ctx where k = 'rest')), 2,
  'floor staff can read their tables (positive control for the 0-row tests)');

-- ============================ owner A: the portal's writes ========================
set local request.jwt.claims to '{"sub":"31111111-1111-1111-1111-111111111111","role":"authenticated","is_anonymous":false}';

select throws_ok($$ update restaurant_settings set order_edit_window_mins = 31 where restaurant_id = (select v::uuid from ctx where k = 'rest') $$,
  '23514', null, 'an edit window above 30 minutes is refused by the database');
select throws_ok($$ update restaurant_settings set order_addition_cutoff_mins = 241 where restaurant_id = (select v::uuid from ctx where k = 'rest') $$,
  '23514', null, 'an add-on cutoff above 240 minutes is refused by the database');
select results_eq($$ update restaurant_settings set order_edit_window_mins = 10 where restaurant_id = (select v::uuid from ctx where k = 'rest')
                     returning order_edit_window_mins $$, $$ values (10) $$,
  'owner can change the edit window');
select results_eq($$ update restaurants set name = 'Portal Grill & Bar', timezone = 'America/Chicago' where id = (select v::uuid from ctx where k = 'rest')
                     returning name, timezone $$, $$ values ('Portal Grill & Bar'::text, 'America/Chicago'::text) $$,
  'owner can change the name and time zone');
select results_eq($$ update dining_tables set is_active = false where id = (select v::uuid from ctx where k = 'p1') returning is_active $$,
  $$ values (false) $$, 'owner can deactivate a table');
select throws_ok($$ insert into dining_tables (restaurant_id, label) select v::uuid, 'P1' from ctx where k = 'rest' $$,
  '23505', null, 'table labels are unique within a restaurant');
select results_eq($$ with d as (delete from menu_categories where id = (select v::uuid from ctx where k = 'cat_empty') returning 1)
                     select count(*)::int from d $$, $$ values (1) $$,
  'owner can delete an empty category');

-- ============================ owner B cannot reach restaurant A ====================
set local request.jwt.claims to '{"sub":"32222222-2222-2222-2222-222222222222","role":"authenticated","is_anonymous":false}';

select lives_ok($$ select public.create_restaurant('Portal Rival', 'portal-rival') $$,
  'a second owner creates their own restaurant');
select results_eq($$ with u as (update restaurant_settings set order_edit_window_mins = 0 where restaurant_id = (select v::uuid from ctx where k = 'rest') returning 1)
                     select count(*)::int from u $$, $$ values (0) $$,
  'owner B cannot change owner A order settings (0 rows)');
select results_eq($$ with u as (update menu_items set price_cents = 1 where id = (select v::uuid from ctx where k = 'salmon') returning 1)
                     select count(*)::int from u $$, $$ values (0) $$,
  'owner B cannot reprice owner A items (0 rows)');
select throws_ok($$ select public.rotate_table_qr((select v::uuid from ctx where k = 'p1')) $$,
  '42501', null, 'owner B cannot rotate owner A QR codes');
select throws_ok($$ select public.set_item_availability((select v::uuid from ctx where k = 'salmon'), false) $$,
  '42501', null, 'owner B cannot 86 owner A items');

-- ============================ deleting an item keeps order history =================
set local request.jwt.claims to '{"sub":"3eeeeeee-eeee-eeee-eeee-eeeeeeeeeeee","role":"authenticated","is_anonymous":true}';
select lives_ok($$ insert into ctx select 'order', public.place_order(
                     (select session_id from public.join_table((select v from ctx where k = 'p2_token'))),
                     jsonb_build_array(jsonb_build_object('menu_item_id', (select v from ctx where k = 'salmon'), 'quantity', 1)))::text $$,
  'a diner orders the salmon');

set local request.jwt.claims to '{"sub":"31111111-1111-1111-1111-111111111111","role":"authenticated","is_anonymous":false}';
select results_eq($$ with d as (delete from menu_items where id = (select v::uuid from ctx where k = 'salmon') returning 1)
                     select count(*)::int from d $$, $$ values (1) $$,
  'owner can delete an item that has been ordered');
select results_eq($$ select item_name, unit_price_cents, menu_item_id is null from order_items
                     where order_id = (select v::uuid from ctx where k = 'order') $$,
  $$ values ('Portal Salmon'::text, 2400, true) $$,
  'the order keeps its name and price snapshot after the item is deleted');

select * from finish();
rollback;
