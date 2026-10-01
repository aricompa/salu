-- Brief 04 task 2: staff seat a table before it takes orders (prank protection, ruled
-- 2026-09-30). join_table refuses an unseated table while require_staff_open is on.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(20);

insert into auth.users (id, email, is_anonymous) values
  ('41111111-1111-1111-1111-111111111111', 'seat-owner-a@example.com', false),
  ('42222222-2222-2222-2222-222222222222', 'seat-owner-b@example.com', false),
  ('4ddddddd-dddd-dddd-dddd-dddddddddddd', 'seat-staff-a@example.com', false),
  ('4aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', null, true),
  ('4bbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', null, true);

create temp table ctx (k text primary key, v text);
grant all on ctx to anon, authenticated;

-- ============================ owner A sets up =====================================
set local role authenticated;
set local request.jwt.claims to '{"sub":"41111111-1111-1111-1111-111111111111","role":"authenticated","is_anonymous":false}';
insert into ctx values ('rest', public.create_restaurant('Seat Spot', 'seat-spot')::text);
insert into dining_tables (restaurant_id, label) select v::uuid, 'S1' from ctx where k = 'rest';
insert into dining_tables (restaurant_id, label, is_active) select v::uuid, 'S2', false from ctx where k = 'rest';
insert into ctx select 's1', t.id::text from dining_tables t, ctx r
  where r.k = 'rest' and t.restaurant_id = r.v::uuid and t.label = 'S1';
insert into ctx select 's1_token', t.qr_token from dining_tables t, ctx r
  where r.k = 'rest' and t.restaurant_id = r.v::uuid and t.label = 'S1';
insert into ctx select 's2', t.id::text from dining_tables t, ctx r
  where r.k = 'rest' and t.restaurant_id = r.v::uuid and t.label = 'S2';

select is((select require_staff_open from restaurant_settings where restaurant_id = (select v::uuid from ctx where k = 'rest')),
  true, 'a new restaurant requires staff to seat tables');

reset role;
insert into restaurant_members (restaurant_id, user_id, role)
  select v::uuid, '4ddddddd-dddd-dddd-dddd-dddddddddddd', 'staff' from ctx where k = 'rest';
set local role authenticated;

-- ============================ grants =================================================
select ok(not has_function_privilege('anon', 'public.open_table_session(uuid)', 'execute'),
  'signed-out visitors cannot call open_table_session');
select ok(has_function_privilege('authenticated', 'public.open_table_session(uuid)', 'execute'),
  'signed-in users can call open_table_session (membership is checked inside)');
select ok(not has_function_privilege('anon', 'public.join_table(text, text)', 'execute'),
  'join_table keeps its grants after being redefined');

-- ============================ a diner at an unseated table ==========================
set local request.jwt.claims to '{"sub":"4aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated","is_anonymous":true}';
select throws_ok($$ select * from public.join_table((select v from ctx where k = 's1_token')) $$,
  'P0001', 'table not open', 'a diner cannot join a table staff have not seated');
select is((select count(*)::int from session_participants), 0, 'the refused diner was not added to any session');
select throws_ok($$ select public.open_table_session((select v::uuid from ctx where k = 's1')) $$,
  '42501', null, 'a diner cannot seat their own table');

-- ============================ owner B (other restaurant) ==========================
set local request.jwt.claims to '{"sub":"42222222-2222-2222-2222-222222222222","role":"authenticated","is_anonymous":false}';
insert into ctx values ('rest_b', public.create_restaurant('Seat Rival', 'seat-rival')::text);
select throws_ok($$ select public.open_table_session((select v::uuid from ctx where k = 's1')) $$,
  '42501', null, 'another restaurant''s owner cannot seat the table');
select results_eq($$ with u as (update restaurant_settings set require_staff_open = false
                     where restaurant_id = (select v::uuid from ctx where k = 'rest') returning 1)
                     select count(*)::int from u $$, $$ values (0) $$,
  'another restaurant''s owner cannot turn seating off (0 rows)');

-- ============================ floor staff of A seat the table ======================
set local request.jwt.claims to '{"sub":"4ddddddd-dddd-dddd-dddd-dddddddddddd","role":"authenticated","is_anonymous":false}';
select lives_ok($$ insert into ctx select 'session', public.open_table_session((select v::uuid from ctx where k = 's1'))::text $$,
  'floor staff can seat a table');
select is((select public.open_table_session((select v::uuid from ctx where k = 's1'))::text), (select v from ctx where k = 'session'),
  'seating a seated table returns its open session');
select throws_ok($$ select public.open_table_session((select v::uuid from ctx where k = 's2')) $$,
  'P0001', 'table is not active', 'a deactivated table cannot be seated');
select results_eq($$ with u as (update restaurant_settings set require_staff_open = false
                     where restaurant_id = (select v::uuid from ctx where k = 'rest') returning 1)
                     select count(*)::int from u $$, $$ values (0) $$,
  'floor staff cannot turn seating off (0 rows)');

-- ============================ the diner can now join ================================
set local request.jwt.claims to '{"sub":"4aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated","is_anonymous":true}';
select is((select session_id::text from public.join_table((select v from ctx where k = 's1_token'), 'Ari')),
  (select v from ctx where k = 'session'), 'once seated, a diner joins the session staff opened');
select results_eq($$ with u as (update restaurant_settings set require_staff_open = false returning 1)
                     select count(*)::int from u $$, $$ values (0) $$,
  'a diner cannot turn seating off (0 rows)');

-- ============================ closing means seating again ===========================
set local request.jwt.claims to '{"sub":"41111111-1111-1111-1111-111111111111","role":"authenticated","is_anonymous":false}';
select lives_ok($$ select public.close_table_session((select v::uuid from ctx where k = 'session')) $$,
  'the owner closes the table');

set local request.jwt.claims to '{"sub":"4bbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","role":"authenticated","is_anonymous":true}';
select throws_ok($$ select * from public.join_table((select v from ctx where k = 's1_token')) $$,
  'P0001', 'table not open', 'after staff close a table, it must be seated again');

-- ============================ with the setting off, joining opens the table =========
set local request.jwt.claims to '{"sub":"41111111-1111-1111-1111-111111111111","role":"authenticated","is_anonymous":false}';
select results_eq($$ with u as (update restaurant_settings set require_staff_open = false
                     where restaurant_id = (select v::uuid from ctx where k = 'rest') returning 1)
                     select count(*)::int from u $$, $$ values (1) $$,
  'the owner can turn seating off');

set local request.jwt.claims to '{"sub":"4bbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","role":"authenticated","is_anonymous":true}';
select lives_ok($$ insert into ctx select 'session_2', session_id::text from public.join_table((select v from ctx where k = 's1_token')) $$,
  'with seating off, a diner opens the table by scanning, as before');
select isnt((select v from ctx where k = 'session_2'), (select v from ctx where k = 'session'),
  'the scan opened a new session, not the closed one');

select * from finish();
rollback;
