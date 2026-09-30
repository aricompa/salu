-- Open decision 8 (ruled 2026-09-29): the database checks dietary tags and time zones,
-- so invariant 9's second half holds for the two fields Brief 02 made writable.

-- 1. Legacy short codes (the Phase 1 seed used V and GF) map to vocabulary values first,
--    so a database seeded before this migration can apply it.
update public.menu_items
set dietary_tags = (
  select coalesce(array_agg(distinct m.tag order by m.tag), '{}'::text[])
  from (
    select case t
             when 'V'  then 'vegetarian'
             when 'GF' then 'gluten-free'
             when 'VG' then 'vegan'
             when 'DF' then 'dairy-free'
             else t
           end as tag
    from unnest(dietary_tags) as t
  ) m
)
where dietary_tags && array['V', 'GF', 'VG', 'DF']::text[];

-- 2. Tags must come from the fixed vocabulary (src/lib/validation/menu.ts DIETARY_TAGS).
--    Any other value left in the data makes this statement fail loudly: fix it, then re-run.
alter table public.menu_items
  add constraint menu_items_dietary_tags_known check (
    dietary_tags <@ array['vegetarian', 'vegan', 'gluten-free', 'dairy-free', 'contains-nuts', 'spicy']::text[]
  );

-- 3. Time zones must be ones Postgres knows. A check constraint can't query, so a trigger.
create function private.check_restaurant_timezone()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (select 1 from pg_catalog.pg_timezone_names z where z.name = new.timezone) then
    raise exception 'unknown time zone' using errcode = '23514', hint = 'invalid_timezone';
  end if;
  return new;
end;
$$;
revoke all on function private.check_restaurant_timezone() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from public.restaurants r
             where not exists (select 1 from pg_catalog.pg_timezone_names z where z.name = r.timezone)) then
    raise exception 'a restaurant has an unknown time zone; fix it before applying this migration';
  end if;
end;
$$;

create trigger restaurants_timezone_known
  before insert or update of timezone on public.restaurants
  for each row execute function private.check_restaurant_timezone();
