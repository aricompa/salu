-- Open decision 11 (ruled 2026-09-30, Brief 04 task 9): place_order refuses items in a
-- hidden category or with no category. Before this, hiding a category only took it off the
-- diner menu; a stale cart or a hand-made request could still order from it.
-- Same signature as the core migration, so its grants (authenticated only) carry over.
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

  -- prices and names come from the database, scoped to this restaurant, available items,
  -- and (new) items whose category exists and is active: an uncategorised item never matches
  insert into public.order_items (order_id, menu_item_id, item_name, unit_price_cents, quantity, notes)
  select v_order_id, mi.id, mi.name, mi.price_cents, req.quantity, nullif(trim(req.notes), '')
  from jsonb_to_recordset(p_items) as req(menu_item_id uuid, quantity integer, notes text)
  join public.menu_items mi
    on mi.id = req.menu_item_id
   and mi.restaurant_id = v_session.restaurant_id
   and mi.is_available
  join public.menu_categories mc
    on mc.id = mi.category_id
   and mc.restaurant_id = mi.restaurant_id
   and mc.is_active
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
