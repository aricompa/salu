-- Prank protection (ruled 2026-09-30, Brief 04 task 2): staff seat a table before it takes
-- orders, so a photographed QR code is useless from home. On by default; owners and
-- managers can turn it off per restaurant. Proof of presence is a person tapping "Seat".

-- 1. The setting. Owners and managers edit it under the existing settings_manager_update
--    policy; this grant adds the column to what they may write.
alter table public.restaurant_settings
  add column require_staff_open boolean not null default true;
comment on column public.restaurant_settings.require_staff_open is
  'When true, join_table refuses a table with no open session: staff seat it with open_table_session().';
grant update (require_staff_open) on public.restaurant_settings to authenticated;

-- 2. Staff seat a table: get or create its single open session. Any member, floor staff
--    included; active tables only. Seating an already seated table returns its session.
create function public.open_table_session(p_table_id uuid)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_table   public.dining_tables%rowtype;
  v_session uuid;
begin
  select * into v_table from public.dining_tables t where t.id = p_table_id;
  if not found or not private.is_member(v_table.restaurant_id) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if not v_table.is_active then
    raise exception 'table is not active' using errcode = 'P0001', hint = 'invalid_table';
  end if;

  -- the no-op DO UPDATE makes RETURNING yield the existing open session's id
  insert into public.table_sessions as ts (restaurant_id, table_id)
  values (v_table.restaurant_id, v_table.id)
  on conflict (table_id) where status = 'open'
    do update set opened_at = ts.opened_at
  returning ts.id into v_session;
  return v_session;
end;
$$;
revoke all on function public.open_table_session(uuid) from public, anon;
grant execute on function public.open_table_session(uuid) to authenticated;

-- 3. join_table refuses an unseated table while the setting is on (hint table_not_open);
--    with it off, it opens the session itself, as before. Same signature, so the grants
--    from the core migration carry over.
create or replace function public.join_table(p_qr_token text, p_display_name text default null)
returns table (session_id uuid, restaurant_id uuid, restaurant_name text, restaurant_slug text, table_label text)
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid     uuid := (select auth.uid());
  v_table   public.dining_tables%rowtype;
  v_require boolean;
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

  -- fail closed: a restaurant without a settings row requires seating
  select coalesce(
    (select st.require_staff_open from public.restaurant_settings st
     where st.restaurant_id = v_table.restaurant_id),
    true)
  into v_require;

  if v_require then
    -- FOR SHARE: a concurrent close_table_session waits for this join (or vice versa)
    select ts.id into v_session from public.table_sessions ts
    where ts.table_id = v_table.id and ts.status = 'open'
    for share;
    if v_session is null then
      raise exception 'table not open' using errcode = 'P0001', hint = 'table_not_open';
    end if;
  else
    -- get or create the single open session for this table in one atomic statement
    insert into public.table_sessions as ts (restaurant_id, table_id)
    values (v_table.restaurant_id, v_table.id)
    on conflict (table_id) where status = 'open'
      do update set opened_at = ts.opened_at
    returning ts.id into v_session;
  end if;

  insert into public.session_participants as sp (session_id, user_id, display_name)
  values (v_session, v_uid, nullif(trim(p_display_name), ''))
  on conflict on constraint session_participants_pkey do update
    set display_name = coalesce(excluded.display_name, sp.display_name);

  return query
    select v_session, r.id, r.name, r.slug, v_table.label
    from public.restaurants r where r.id = v_table.restaurant_id;
end;
$$;
