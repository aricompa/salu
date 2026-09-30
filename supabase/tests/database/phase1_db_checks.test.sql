-- Open decision 8: the database refuses unknown dietary tags and unknown time zones.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(10);

insert into auth.users (id, email, is_anonymous) values
  ('41111111-1111-1111-1111-111111111111', 'checks-owner@example.com', false);
create temp table ctx (k text primary key, v text);
grant all on ctx to authenticated;

set local role authenticated;
set local request.jwt.claims to '{"sub":"41111111-1111-1111-1111-111111111111","role":"authenticated","is_anonymous":false}';

select lives_ok($$ insert into ctx values ('rest', public.create_restaurant('Checks Cafe', 'checks-cafe')::text) $$,
  'owner creates a restaurant (default zone passes the trigger)');

-- time zones
select throws_ok($$ update restaurants set timezone = 'Mars/Olympus' where id = (select v::uuid from ctx where k = 'rest') $$,
  '23514', null, 'an unknown time zone is refused');
select throws_ok($$ update restaurants set timezone = '' where id = (select v::uuid from ctx where k = 'rest') $$,
  '23514', null, 'an empty time zone is refused');
select results_eq($$ update restaurants set timezone = 'Asia/Tokyo' where id = (select v::uuid from ctx where k = 'rest') returning timezone $$,
  $$ values ('Asia/Tokyo'::text) $$, 'a real time zone is accepted');
select results_eq($$ update restaurants set timezone = 'UTC' where id = (select v::uuid from ctx where k = 'rest') returning timezone $$,
  $$ values ('UTC'::text) $$, 'an alias Postgres knows (UTC) is accepted');

-- dietary tags
select throws_ok($$ insert into menu_items (restaurant_id, name, price_cents, dietary_tags)
                   select v::uuid, 'Keto Bowl', 1200, '{keto}' from ctx where k = 'rest' $$,
  '23514', null, 'a tag outside the vocabulary is refused');
select throws_ok($$ insert into menu_items (restaurant_id, name, price_cents, dietary_tags)
                   select v::uuid, 'Old Salad', 900, '{V}' from ctx where k = 'rest' $$,
  '23514', null, 'a legacy short code (V) is refused');
select lives_ok($$ insert into menu_items (restaurant_id, name, price_cents, dietary_tags)
                  select v::uuid, 'Chili Tofu', 1400, '{vegan,spicy}' from ctx where k = 'rest' $$,
  'vocabulary tags are accepted');

reset role;
select is((select count(*)::int from menu_items where not dietary_tags <@
             array['vegetarian','vegan','gluten-free','dairy-free','contains-nuts','spicy']::text[]), 0,
  'no row anywhere (seed included) holds a tag outside the vocabulary');
select ok(not has_function_privilege('authenticated', 'private.check_restaurant_timezone()', 'execute')
      and not has_function_privilege('anon', 'private.check_restaurant_timezone()', 'execute'),
  'API roles cannot call the time zone trigger function directly');

select * from finish();
rollback;
