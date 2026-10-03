-- Linked add-ons (ruled 2026-10-03). Priced add-ons stay menu items, so price, 86 and
-- editing work as for any item, but a diner picks them inside the item they go with, and
-- the order records which line each add-on belongs to.
--
-- Additive on purpose: the code before this change keeps working against it (no add-on is
-- flagged and no link exists until a restaurant sets them up, and place_order still takes
-- lines without add-ons), so the hosted project can apply it before the code merges.

-- 1. Items sold only as an add-on: hidden from the diner's menu list, never a line on
--    their own. Owners and managers set the flag through the existing item grants/RLS.
alter table public.menu_items
  add column addon_only boolean not null default false;
-- lets the link table check that both items belong to the restaurant it names
alter table public.menu_items
  add constraint menu_items_id_restaurant_key unique (id, restaurant_id);

grant insert (addon_only) on public.menu_items to authenticated;
grant update (addon_only) on public.menu_items to authenticated;

-- 2. Which add-ons go with which item. Configuration, not history: deleting either item
--    removes its links. A link joins an add-on-only item to one that isn't (checked on
--    insert below); a later flag change leaves links that the diner menu and place_order
--    both ignore, and the portal clears them when it saves the flag.
create table public.menu_item_addons (
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  item_id       uuid not null,
  addon_id      uuid not null,
  created_at    timestamptz not null default now(),
  primary key (item_id, addon_id),
  check (item_id <> addon_id),
  foreign key (item_id, restaurant_id)
    references public.menu_items (id, restaurant_id) on delete cascade,
  foreign key (addon_id, restaurant_id)
    references public.menu_items (id, restaurant_id) on delete cascade
);
create index menu_item_addons_addon_idx on public.menu_item_addons (addon_id);
create index menu_item_addons_restaurant_idx on public.menu_item_addons (restaurant_id);

alter table public.menu_item_addons enable row level security;

-- public read, like menu items: the diner menu needs it before anyone is seated
create policy item_addons_public_read on public.menu_item_addons
  for select to anon, authenticated using (true);
create policy item_addons_manager_insert on public.menu_item_addons
  for insert to authenticated
  with check (private.is_member(restaurant_id, array['owner', 'manager']::public.member_role[]));
create policy item_addons_manager_delete on public.menu_item_addons
  for delete to authenticated
  using (private.is_member(restaurant_id, array['owner', 'manager']::public.member_role[]));

-- rule 9: the database checks the pairing as well as zod and the portal
create function private.check_addon_link()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if not exists (select 1 from public.menu_items a where a.id = new.addon_id and a.addon_only)
  or exists (select 1 from public.menu_items i where i.id = new.item_id and i.addon_only) then
    raise exception 'an add-on must be add-on-only, and the item it goes with must not be'
      using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger menu_item_addons_pairing before insert on public.menu_item_addons
  for each row execute function private.check_addon_link();

grant select on public.menu_item_addons to anon, authenticated;
grant insert (restaurant_id, item_id, addon_id), delete on public.menu_item_addons to authenticated;
-- the server-side admin client keeps the same reach it has on every other table
grant select, insert, update, delete on public.menu_item_addons to service_role;

-- 3. An add-on line points at the line it belongs to, in the same order. The kitchen
--    ticket nests it there; its quantity follows that line's. No cascade: a line with
--    add-ons can't be deleted on its own (order history, rule 5); the check runs at the end
--    of the statement, so whatever removes a whole order removes both together.
alter table public.order_items
  add constraint order_items_id_order_key unique (id, order_id);
alter table public.order_items
  add column parent_id uuid,
  add constraint order_items_parent_fk foreign key (parent_id, order_id)
    references public.order_items (id, order_id),
  add constraint order_items_parent_not_self check (parent_id <> id);
create index order_items_parent_idx on public.order_items (parent_id) where parent_id is not null;

-- 4. place_order takes an optional `addon_ids` array on each line. Same signature, so its
--    grants (authenticated only) carry over, and a line without `addon_ids` orders as
--    before. Otherwise unchanged from 20261001014239, except: add-on-only items are refused
--    as lines of their own, and with up to 11 rows a line, the subtotal is summed as a
--    bigint and refused past what orders.subtotal_cents holds.
create or replace function public.place_order(p_session_id uuid, p_items jsonb, p_notes text default null)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid        uuid := (select auth.uid());
  v_session    public.table_sessions%rowtype;
  v_window     integer;
  v_order_id   uuid;
  v_requested  integer;
  v_line       record;
  v_parent_id  uuid;
  v_addons     uuid[];
  v_inserted   integer;
  v_subtotal   bigint;
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

  for v_line in
    select req.menu_item_id, req.quantity, req.notes, req.addon_ids
    from jsonb_to_recordset(p_items) as req(menu_item_id uuid, quantity integer, notes text, addon_ids jsonb)
  loop
    -- add-ons: absent, or an array of at most 10 distinct item ids
    v_addons := '{}';
    if v_line.addon_ids is not null and jsonb_typeof(v_line.addon_ids) <> 'null' then
      if jsonb_typeof(v_line.addon_ids) <> 'array' then
        raise exception 'add-ons must be an array' using errcode = '22023', hint = 'invalid_items';
      end if;
      begin
        select coalesce(array_agg(a.value::uuid), '{}') into v_addons
        from jsonb_array_elements_text(v_line.addon_ids) as a(value);
      exception when invalid_text_representation then
        raise exception 'add-ons must be item ids' using errcode = '22023', hint = 'invalid_items';
      end;
      if cardinality(v_addons) > 10
      or cardinality(v_addons) <> (select count(distinct a) from unnest(v_addons) as a) then
        raise exception 'at most 10 different add-ons per line' using errcode = '22023', hint = 'invalid_items';
      end if;
    end if;

    -- the line: priced and named by the database, scoped to this restaurant, available,
    -- in an active category, and not an add-on-only item
    v_parent_id := null;
    insert into public.order_items (order_id, menu_item_id, item_name, unit_price_cents, quantity, notes)
    select v_order_id, mi.id, mi.name, mi.price_cents, v_line.quantity, nullif(trim(v_line.notes), '')
    from public.menu_items mi
    join public.menu_categories mc
      on mc.id = mi.category_id
     and mc.restaurant_id = mi.restaurant_id
     and mc.is_active
    where mi.id = v_line.menu_item_id
      and mi.restaurant_id = v_session.restaurant_id
      and mi.is_available
      and not mi.addon_only
      and v_line.quantity between 1 and 50
      and coalesce(char_length(v_line.notes), 0) <= 200
    returning id into v_parent_id;

    if v_parent_id is null then
      raise exception 'one or more items are unavailable or invalid' using errcode = 'P0001', hint = 'item_unavailable';
    end if;

    -- its add-ons: each linked to this item, add-on-only, available, in an active
    -- category; one per unit of the line, so the quantity follows the line's
    if cardinality(v_addons) > 0 then
      insert into public.order_items (order_id, parent_id, menu_item_id, item_name, unit_price_cents, quantity)
      select v_order_id, v_parent_id, mi.id, mi.name, mi.price_cents, v_line.quantity
      from public.menu_items mi
      join public.menu_item_addons l
        on l.addon_id = mi.id
       and l.item_id = v_line.menu_item_id
       and l.restaurant_id = v_session.restaurant_id
      join public.menu_categories mc
        on mc.id = mi.category_id
       and mc.restaurant_id = mi.restaurant_id
       and mc.is_active
      where mi.id = any (v_addons)
        and mi.restaurant_id = v_session.restaurant_id
        and mi.is_available
        and mi.addon_only;
      get diagnostics v_inserted = row_count;

      if v_inserted <> cardinality(v_addons) then
        raise exception 'one or more items are unavailable or invalid' using errcode = 'P0001', hint = 'item_unavailable';
      end if;
    end if;
  end loop;

  select sum(oi.unit_price_cents::bigint * oi.quantity) into v_subtotal
  from public.order_items oi where oi.order_id = v_order_id;
  if v_subtotal > 2147483647 then
    raise exception 'order total too large' using errcode = '22023', hint = 'invalid_items';
  end if;
  update public.orders set subtotal_cents = v_subtotal where id = v_order_id;

  return v_order_id;
end;
$$;
