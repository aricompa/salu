-- =============================================================================
-- Salu Phase 1: core schema (restaurant portal + QR scan -> menu -> order)
-- =============================================================================
-- Security model (read before changing anything):
--   * Staff are permanent Supabase Auth users. Staff access flows only through
--     public.restaurant_members, which is only written by create_restaurant().
--   * Diners are Supabase ANONYMOUS users (JWT claim is_anonymous = true),
--     created silently on QR scan. No email, no password, no app download.
--   * Diners never read dining_tables or QR tokens. They join a table only
--     through public.join_table(qr_token).
--   * Orders are only created through public.place_order(). Prices come from
--     menu_items in the database. The client never sends a price.
--   * Every table has RLS enabled, explicit minimum grants, and no default
--     grants. Column-level grants restrict what authenticated users may write.
--   * SECURITY DEFINER helpers live in schema "private", which is NOT exposed
--     through the Data API. Every definer function pins search_path = ''.
-- =============================================================================

-- 0. Exposure is opt-in: stop Supabase's legacy auto-grants on new objects.
--    "revoke all" also covers TRUNCATE/REFERENCES/TRIGGER (TRUNCATE ignores RLS).
alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke all on functions from anon, authenticated, service_role;
-- PUBLIC's EXECUTE on new functions is a global default; it can't be revoked per schema.
alter default privileges for role postgres
  revoke execute on functions from public;

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

-- 1. Types --------------------------------------------------------------------
create type public.member_role    as enum ('owner', 'manager', 'staff');
create type public.session_status as enum ('open', 'closed');
create type public.order_status   as enum ('submitted', 'accepted', 'preparing', 'ready', 'served', 'cancelled');

-- 2. Tables -------------------------------------------------------------------
create table public.restaurants (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 120),
  slug        text not null unique
              check (char_length(slug) between 2 and 60 and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  timezone    text not null default 'America/New_York',
  currency    text not null default 'usd' check (currency ~ '^[a-z]{3}$'),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
comment on table public.restaurants is 'Public restaurant identity. Operational config lives in restaurant_settings (members only).';

create table public.restaurant_settings (
  restaurant_id              uuid primary key references public.restaurants (id) on delete cascade,
  order_edit_window_mins     integer not null default 5  check (order_edit_window_mins between 0 and 30),
  order_addition_cutoff_mins integer not null default 20 check (order_addition_cutoff_mins between 0 and 240),
  updated_at                 timestamptz not null default now()
);

create table public.restaurant_members (
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  user_id       uuid not null references auth.users (id) on delete cascade,
  role          public.member_role not null default 'staff',
  created_at    timestamptz not null default now(),
  primary key (restaurant_id, user_id)
);
create index restaurant_members_user_idx on public.restaurant_members (user_id);

create table public.dining_tables (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  label         text not null check (char_length(label) between 1 and 40),
  capacity      integer check (capacity between 1 and 100),
  qr_token      text not null unique,          -- set by trigger, never by clients
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  unique (restaurant_id, label),
  unique (id, restaurant_id)
);
comment on column public.dining_tables.qr_token is 'Stable token printed in the table QR (/t/<token>). Rotate with rotate_table_qr() to invalidate a printed code.';

create table public.table_sessions (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null,
  table_id      uuid not null,
  status        public.session_status not null default 'open',
  opened_at     timestamptz not null default now(),
  closed_at     timestamptz,
  -- restrict: a table with history can't be deleted (it would erase orders); deactivate it instead
  foreign key (table_id, restaurant_id) references public.dining_tables (id, restaurant_id) on delete restrict,
  unique (id, restaurant_id),
  check ((status = 'closed') = (closed_at is not null))
);
create unique index table_sessions_one_open_per_table on public.table_sessions (table_id) where status = 'open';
create index table_sessions_restaurant_idx on public.table_sessions (restaurant_id, opened_at desc);

create table public.session_participants (
  session_id    uuid not null references public.table_sessions (id) on delete cascade,
  user_id       uuid not null references auth.users (id) on delete cascade,
  display_name  text check (char_length(display_name) between 1 and 40),
  joined_at     timestamptz not null default now(),
  primary key (session_id, user_id)
);
create index session_participants_user_idx on public.session_participants (user_id);

create table public.menu_categories (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  name          text not null check (char_length(name) between 1 and 60),
  sort_order    integer not null default 0,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (id, restaurant_id)
);
create index menu_categories_restaurant_idx on public.menu_categories (restaurant_id, sort_order);

create table public.menu_items (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  category_id   uuid,
  name          text not null check (char_length(name) between 1 and 120),
  description   text check (char_length(description) <= 500),
  price_cents   integer not null check (price_cents between 0 and 1000000),
  is_available  boolean not null default true,
  image_path    text check (char_length(image_path) <= 300),
  dietary_tags  text[] not null default '{}',
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  -- a category must belong to the same restaurant as the item
  foreign key (category_id, restaurant_id)
    references public.menu_categories (id, restaurant_id) on delete set null (category_id)
);
create index menu_items_restaurant_idx on public.menu_items (restaurant_id, category_id, sort_order);

create table public.orders (
  id              uuid primary key default gen_random_uuid(),
  restaurant_id   uuid not null,
  session_id      uuid not null,
  placed_by       uuid references auth.users (id) on delete set null,  -- anon users may be purged later; keep the order
  status          public.order_status not null default 'submitted',
  notes           text check (char_length(notes) <= 500),
  subtotal_cents  integer not null check (subtotal_cents >= 0),
  submitted_at    timestamptz not null default now(),
  editable_until  timestamptz not null,
  accepted_at     timestamptz,
  ready_at        timestamptz,
  served_at       timestamptz,
  cancelled_at    timestamptz,
  -- restrict: orders are financial records and are never hard-deleted
  foreign key (session_id, restaurant_id) references public.table_sessions (id, restaurant_id) on delete restrict
);
create index orders_restaurant_feed_idx on public.orders (restaurant_id, submitted_at desc);
create index orders_session_idx on public.orders (session_id);
create index orders_placed_by_idx on public.orders (placed_by);

create table public.order_items (
  id                uuid primary key default gen_random_uuid(),
  order_id          uuid not null references public.orders (id) on delete cascade,
  menu_item_id      uuid references public.menu_items (id) on delete set null,
  item_name         text not null,           -- snapshot at order time
  unit_price_cents  integer not null check (unit_price_cents >= 0),  -- snapshot at order time
  quantity          integer not null check (quantity between 1 and 50),
  notes             text check (char_length(notes) <= 200)
);
create index order_items_order_idx on public.order_items (order_id);

-- 3. Private helpers (SECURITY DEFINER, not exposed via the Data API) ----------
create function private.is_member(p_restaurant_id uuid, p_roles public.member_role[] default null)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.restaurant_members m
    where m.restaurant_id = p_restaurant_id
      and m.user_id = (select auth.uid())
      and (p_roles is null or m.role = any (p_roles))
  );
$$;

create function private.is_participant(p_session_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.session_participants p
    where p.session_id = p_session_id and p.user_id = (select auth.uid())
  );
$$;

create function private.is_anonymous()
returns boolean
language sql stable set search_path = ''
as $$
  -- fail closed: a token without the claim is treated as anonymous
  select coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, true);
$$;

revoke all on function private.is_member(uuid, public.member_role[]) from public, anon;
revoke all on function private.is_participant(uuid) from public, anon;
revoke all on function private.is_anonymous() from public, anon;
grant execute on function private.is_member(uuid, public.member_role[]) to authenticated;
grant execute on function private.is_participant(uuid) to authenticated;
grant execute on function private.is_anonymous() to authenticated;

-- 4. Triggers -------------------------------------------------------------------
create function private.touch_updated_at()
returns trigger language plpgsql set search_path = ''
as $$ begin new.updated_at := now(); return new; end; $$;

create trigger restaurants_touch before update on public.restaurants
  for each row execute function private.touch_updated_at();
create trigger restaurant_settings_touch before update on public.restaurant_settings
  for each row execute function private.touch_updated_at();
create trigger menu_categories_touch before update on public.menu_categories
  for each row execute function private.touch_updated_at();
create trigger menu_items_touch before update on public.menu_items
  for each row execute function private.touch_updated_at();

-- QR token: 122 bits from gen_random_uuid() (pg_strong_random), always server-set.
create function private.set_qr_token()
returns trigger language plpgsql set search_path = ''
as $$
begin
  new.qr_token := replace(gen_random_uuid()::text, '-', '');
  return new;
end;
$$;
create trigger dining_tables_qr_token before insert on public.dining_tables
  for each row execute function private.set_qr_token();

-- Order state machine. Column grants already limit staff updates to "status".
create function private.enforce_order_transition()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if new.status = old.status then
    return new;
  end if;

  if not (
       (old.status = 'submitted' and new.status in ('accepted', 'cancelled'))
    or (old.status = 'accepted'  and new.status in ('preparing', 'ready', 'cancelled'))
    or (old.status = 'preparing' and new.status in ('ready', 'cancelled'))
    or (old.status = 'ready'     and new.status = 'served')
  ) then
    raise exception 'invalid order transition % -> %', old.status, new.status
      using errcode = 'P0001', hint = 'invalid_transition';
  end if;

  case new.status
    when 'accepted'  then new.accepted_at  := now();
    when 'ready'     then new.ready_at     := now();
    when 'served'    then new.served_at    := now();
    when 'cancelled' then new.cancelled_at := now();
    else null;
  end case;
  return new;
end;
$$;
create trigger orders_transition before update of status on public.orders
  for each row execute function private.enforce_order_transition();

-- 5. RPCs (the only write paths for sessions and orders) ---------------------------

-- Staff onboarding: creates restaurant + settings + owner membership atomically.
create function public.create_restaurant(p_name text, p_slug text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_id  uuid;
begin
  if v_uid is null or private.is_anonymous() then
    raise exception 'staff account required' using errcode = '42501';
  end if;

  -- slug-squatting guard; raise when a real multi-location customer needs more
  if (select count(*) from public.restaurant_members m
      where m.user_id = v_uid and m.role = 'owner') >= 5 then
    raise exception 'restaurant limit reached' using errcode = 'P0001', hint = 'restaurant_limit';
  end if;

  insert into public.restaurants (name, slug) values (trim(p_name), lower(trim(p_slug)))
  returning id into v_id;
  insert into public.restaurant_settings (restaurant_id) values (v_id);
  insert into public.restaurant_members (restaurant_id, user_id, role) values (v_id, v_uid, 'owner');
  return v_id;
end;
$$;

-- Diner entry point: QR scan -> join (or open) the table's session.
create function public.join_table(p_qr_token text, p_display_name text default null)
returns table (session_id uuid, restaurant_id uuid, restaurant_name text, restaurant_slug text, table_label text)
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid     uuid := (select auth.uid());
  v_table   public.dining_tables%rowtype;
  v_session uuid;
begin
  if v_uid is null then
    raise exception 'sign-in required' using errcode = '42501';
  end if;

  select * into v_table from public.dining_tables t
  where t.qr_token = p_qr_token and t.is_active;
  if not found then
    raise exception 'table not found' using errcode = 'P0002', hint = 'invalid_table';
  end if;

  -- get or create the single open session for this table in one atomic statement
  -- (the no-op DO UPDATE makes RETURNING yield the existing row's id)
  insert into public.table_sessions as ts (restaurant_id, table_id)
  values (v_table.restaurant_id, v_table.id)
  on conflict (table_id) where status = 'open'
    do update set opened_at = ts.opened_at
  returning ts.id into v_session;

  insert into public.session_participants as sp (session_id, user_id, display_name)
  values (v_session, v_uid, nullif(trim(p_display_name), ''))
  on conflict on constraint session_participants_pkey do update
    set display_name = coalesce(excluded.display_name, sp.display_name);

  return query
    select v_session, r.id, r.name, r.slug, v_table.label
    from public.restaurants r where r.id = v_table.restaurant_id;
end;
$$;

-- Place an order. p_items: [{"menu_item_id": uuid, "quantity": int, "notes": text?}, ...]
create function public.place_order(p_session_id uuid, p_items jsonb, p_notes text default null)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid        uuid := (select auth.uid());
  v_session    public.table_sessions%rowtype;
  v_window     integer;
  v_order_id   uuid;
  v_requested  integer;
  v_inserted   integer;
  v_subtotal   integer;
begin
  if v_uid is null then
    raise exception 'sign-in required' using errcode = '42501';
  end if;

  -- FOR SHARE: a concurrent close_table_session waits for this order (or vice versa)
  select * into v_session from public.table_sessions s where s.id = p_session_id for share;
  if not found or not private.is_participant(p_session_id) then
    raise exception 'not seated at this table' using errcode = '42501', hint = 'not_participant';
  end if;
  if v_session.status <> 'open' then
    raise exception 'table session is closed' using errcode = 'P0001', hint = 'session_closed';
  end if;

  if jsonb_typeof(p_items) <> 'array' then
    raise exception 'items must be an array' using errcode = '22023', hint = 'invalid_items';
  end if;
  v_requested := jsonb_array_length(p_items);
  if v_requested < 1 or v_requested > 30 then
    raise exception 'order must have 1-30 lines' using errcode = '22023', hint = 'invalid_items';
  end if;

  -- abuse guards (serialized per diner so concurrent calls can't slip past the count):
  --   max 5 orders per diner per 2 minutes; max 40 orders per table session per 15 minutes
  perform pg_advisory_xact_lock(hashtext('place_order:' || v_uid::text));
  if (select count(*) from public.orders o
      where o.placed_by = v_uid and o.submitted_at > now() - interval '2 minutes') >= 5
  or (select count(*) from public.orders o
      where o.session_id = p_session_id and o.submitted_at > now() - interval '15 minutes') >= 40 then
    raise exception 'too many orders, slow down' using errcode = 'P0001', hint = 'rate_limited';
  end if;

  select st.order_edit_window_mins into v_window
  from public.restaurant_settings st where st.restaurant_id = v_session.restaurant_id;

  insert into public.orders (restaurant_id, session_id, placed_by, notes, subtotal_cents, editable_until)
  values (v_session.restaurant_id, v_session.id, v_uid, nullif(trim(p_notes), ''), 0,
          now() + make_interval(mins => coalesce(v_window, 5)))
  returning id into v_order_id;

  -- prices and names come from the database, scoped to this restaurant and available items
  insert into public.order_items (order_id, menu_item_id, item_name, unit_price_cents, quantity, notes)
  select v_order_id, mi.id, mi.name, mi.price_cents, req.quantity, nullif(trim(req.notes), '')
  from jsonb_to_recordset(p_items) as req(menu_item_id uuid, quantity integer, notes text)
  join public.menu_items mi
    on mi.id = req.menu_item_id
   and mi.restaurant_id = v_session.restaurant_id
   and mi.is_available
  where req.quantity between 1 and 50
    and coalesce(char_length(req.notes), 0) <= 200;
  get diagnostics v_inserted = row_count;

  if v_inserted <> v_requested then
    raise exception 'one or more items are unavailable or invalid' using errcode = 'P0001', hint = 'item_unavailable';
  end if;

  select sum(oi.unit_price_cents * oi.quantity) into v_subtotal
  from public.order_items oi where oi.order_id = v_order_id;
  update public.orders set subtotal_cents = v_subtotal where id = v_order_id;

  return v_order_id;
end;
$$;

create function public.close_table_session(p_session_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare v_restaurant uuid;
begin
  select s.restaurant_id into v_restaurant from public.table_sessions s where s.id = p_session_id;
  if v_restaurant is null or not private.is_member(v_restaurant) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  update public.table_sessions set status = 'closed', closed_at = now()
  where id = p_session_id and status = 'open';
end;
$$;

create function public.rotate_table_qr(p_table_id uuid)
returns text
language plpgsql security definer set search_path = ''
as $$
declare v_restaurant uuid; v_token text;
begin
  select t.restaurant_id into v_restaurant from public.dining_tables t where t.id = p_table_id;
  if v_restaurant is null or not private.is_member(v_restaurant, array['owner', 'manager']::public.member_role[]) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  v_token := replace(gen_random_uuid()::text, '-', '');
  update public.dining_tables set qr_token = v_token where id = p_table_id;
  return v_token;
end;
$$;

-- Any member (incl. floor staff) can 86 / un-86 an item. Price and name edits stay owner/manager-only.
create function public.set_item_availability(p_item_id uuid, p_available boolean)
returns void
language plpgsql security definer set search_path = ''
as $$
declare v_restaurant uuid;
begin
  select mi.restaurant_id into v_restaurant from public.menu_items mi where mi.id = p_item_id;
  if v_restaurant is null or not private.is_member(v_restaurant) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  update public.menu_items set is_available = p_available where id = p_item_id;
end;
$$;

revoke all on function public.set_item_availability(uuid, boolean)     from public, anon;
grant execute on function public.set_item_availability(uuid, boolean)  to authenticated;
revoke all on function public.create_restaurant(text, text)            from public, anon;
revoke all on function public.join_table(text, text)                   from public, anon;
revoke all on function public.place_order(uuid, jsonb, text)           from public, anon;
revoke all on function public.close_table_session(uuid)                from public, anon;
revoke all on function public.rotate_table_qr(uuid)                    from public, anon;
grant execute on function public.create_restaurant(text, text)         to authenticated;
grant execute on function public.join_table(text, text)                to authenticated;
grant execute on function public.place_order(uuid, jsonb, text)        to authenticated;
grant execute on function public.close_table_session(uuid)             to authenticated;
grant execute on function public.rotate_table_qr(uuid)                 to authenticated;

-- 6. Row Level Security -----------------------------------------------------------
alter table public.restaurants           enable row level security;
alter table public.restaurant_settings   enable row level security;
alter table public.restaurant_members    enable row level security;
alter table public.dining_tables         enable row level security;
alter table public.table_sessions        enable row level security;
alter table public.session_participants  enable row level security;
alter table public.menu_categories       enable row level security;
alter table public.menu_items            enable row level security;
alter table public.orders                enable row level security;
alter table public.order_items           enable row level security;

-- restaurants: public identity is readable; owners/managers edit
create policy restaurants_public_read on public.restaurants
  for select to anon, authenticated using (true);
create policy restaurants_manager_update on public.restaurants
  for update to authenticated
  using (private.is_member(id, array['owner', 'manager']::public.member_role[]))
  with check (private.is_member(id, array['owner', 'manager']::public.member_role[]));

-- restaurant_settings: members read, owners/managers edit
create policy settings_member_read on public.restaurant_settings
  for select to authenticated using (private.is_member(restaurant_id));
create policy settings_manager_update on public.restaurant_settings
  for update to authenticated
  using (private.is_member(restaurant_id, array['owner', 'manager']::public.member_role[]))
  with check (private.is_member(restaurant_id, array['owner', 'manager']::public.member_role[]));

-- restaurant_members: members see their colleagues (writes via RPC only)
create policy members_member_read on public.restaurant_members
  for select to authenticated using (private.is_member(restaurant_id));

-- dining_tables: staff only. Diners never see tokens.
create policy tables_member_read on public.dining_tables
  for select to authenticated using (private.is_member(restaurant_id));
create policy tables_manager_insert on public.dining_tables
  for insert to authenticated
  with check (private.is_member(restaurant_id, array['owner', 'manager']::public.member_role[]));
create policy tables_manager_update on public.dining_tables
  for update to authenticated
  using (private.is_member(restaurant_id, array['owner', 'manager']::public.member_role[]))
  with check (private.is_member(restaurant_id, array['owner', 'manager']::public.member_role[]));
create policy tables_manager_delete on public.dining_tables
  for delete to authenticated
  using (private.is_member(restaurant_id, array['owner', 'manager']::public.member_role[]));

-- table_sessions: staff of the restaurant, or diners seated in the session
create policy sessions_read on public.table_sessions
  for select to authenticated
  using (private.is_member(restaurant_id) or private.is_participant(id));

-- session_participants: yourself, or staff of the restaurant
create policy participants_read on public.session_participants
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or exists (select 1 from public.table_sessions s
               where s.id = session_id and private.is_member(s.restaurant_id))
  );
create policy participants_self_update on public.session_participants
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- menu: public read of active categories and all items (unavailable items render as sold out)
create policy categories_public_read on public.menu_categories
  for select to anon, authenticated using (is_active);
create policy categories_member_read on public.menu_categories
  for select to authenticated using (private.is_member(restaurant_id));
create policy categories_manager_insert on public.menu_categories
  for insert to authenticated
  with check (private.is_member(restaurant_id, array['owner', 'manager']::public.member_role[]));
create policy categories_manager_update on public.menu_categories
  for update to authenticated
  using (private.is_member(restaurant_id, array['owner', 'manager']::public.member_role[]))
  with check (private.is_member(restaurant_id, array['owner', 'manager']::public.member_role[]));
create policy categories_manager_delete on public.menu_categories
  for delete to authenticated
  using (private.is_member(restaurant_id, array['owner', 'manager']::public.member_role[]));

create policy items_public_read on public.menu_items
  for select to anon, authenticated using (true);
create policy items_manager_insert on public.menu_items
  for insert to authenticated
  with check (private.is_member(restaurant_id, array['owner', 'manager']::public.member_role[]));
-- owners/managers edit items; floor staff 86 items through set_item_availability()
create policy items_manager_update on public.menu_items
  for update to authenticated
  using (private.is_member(restaurant_id, array['owner', 'manager']::public.member_role[]))
  with check (private.is_member(restaurant_id, array['owner', 'manager']::public.member_role[]));
create policy items_manager_delete on public.menu_items
  for delete to authenticated
  using (private.is_member(restaurant_id, array['owner', 'manager']::public.member_role[]));

-- orders: staff of the restaurant, or the diner who placed it (Phase 1: own orders only)
create policy orders_read on public.orders
  for select to authenticated
  using (private.is_member(restaurant_id) or placed_by = (select auth.uid()));
create policy orders_member_update on public.orders
  for update to authenticated
  using (private.is_member(restaurant_id))
  with check (private.is_member(restaurant_id));

create policy order_items_read on public.order_items
  for select to authenticated
  using (exists (
    select 1 from public.orders o
    where o.id = order_id
      and (private.is_member(o.restaurant_id) or o.placed_by = (select auth.uid()))
  ));

-- 7. Grants (minimum; column-level where clients write) ------------------------------
revoke all on all tables in schema public from anon, authenticated;

grant select on public.restaurants, public.menu_categories, public.menu_items to anon, authenticated;
grant update (name, timezone, currency) on public.restaurants to authenticated;

grant select on public.restaurant_settings to authenticated;
grant update (order_edit_window_mins, order_addition_cutoff_mins) on public.restaurant_settings to authenticated;

grant select on public.restaurant_members to authenticated;

grant select, delete on public.dining_tables to authenticated;
grant insert (restaurant_id, label, capacity, is_active) on public.dining_tables to authenticated;
grant update (label, capacity, is_active) on public.dining_tables to authenticated;

grant select on public.table_sessions to authenticated;

grant select on public.session_participants to authenticated;
grant update (display_name) on public.session_participants to authenticated;

grant delete on public.menu_categories to authenticated;
grant insert (restaurant_id, name, sort_order, is_active) on public.menu_categories to authenticated;
grant update (name, sort_order, is_active) on public.menu_categories to authenticated;

grant delete on public.menu_items to authenticated;
grant insert (restaurant_id, category_id, name, description, price_cents, is_available, image_path, dietary_tags, sort_order)
  on public.menu_items to authenticated;
grant update (category_id, name, description, price_cents, is_available, image_path, dietary_tags, sort_order)
  on public.menu_items to authenticated;

grant select on public.orders to authenticated;
grant update (status) on public.orders to authenticated;

grant select on public.order_items to authenticated;

-- server-side admin client (secret key) for future webhooks/jobs; bypasses RLS by design
grant select, insert, update, delete on all tables in schema public to service_role;

-- 8. Realtime: staff order feed + diner order status (RLS filters rows per subscriber) ---
alter publication supabase_realtime add table public.orders;
