-- Local demo data. Fake but realistic; no real personal data.
-- Runs as the postgres role on `supabase db reset`, so it bypasses RLS on purpose.
-- No users are seeded: staff sign up through the app, diners are anonymous.

insert into public.restaurants (id, name, slug, timezone, currency)
values ('00000000-0000-4000-8000-000000000001', 'Demo Bistro', 'demo-bistro', 'America/New_York', 'usd');

insert into public.restaurant_settings (restaurant_id)
values ('00000000-0000-4000-8000-000000000001');

insert into public.menu_categories (id, restaurant_id, name, sort_order) values
  ('00000000-0000-4000-8000-0000000000c1', '00000000-0000-4000-8000-000000000001', 'Starters', 1),
  ('00000000-0000-4000-8000-0000000000c2', '00000000-0000-4000-8000-000000000001', 'Mains',    2),
  ('00000000-0000-4000-8000-0000000000c3', '00000000-0000-4000-8000-000000000001', 'Drinks',   3);

insert into public.menu_items
  (restaurant_id, category_id, name, description, price_cents, is_available, dietary_tags, sort_order)
values
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000000c1',
   'Crispy Brussels Sprouts', 'Honey, chili, lime.', 1100, true, '{vegetarian,gluten-free}', 1),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000000c1',
   'Burrata', 'Heirloom tomato, basil oil, grilled sourdough.', 1600, true, '{vegetarian}', 2),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000000c1',
   'Tuna Crudo', 'Citrus, jalapeño, crispy shallot.', 1800, true, '{gluten-free}', 3),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000000c1',
   'Soup of the Day', 'Ask your server what''s on today.', 900, true, '{}', 4),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000000c2',
   'Bistro Burger', 'Dry-aged beef, aged cheddar, house pickles, fries.', 2200, true, '{}', 1),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000000c2',
   'Lobster Roll', 'Warm butter, toasted brioche, chips.', 3400, false, '{}', 2),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000000c2',
   'Roast Half Chicken', 'Salsa verde, charred lemon, potatoes.', 2600, true, '{gluten-free}', 3),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000000c2',
   'Mushroom Risotto', 'Parmesan, thyme, truffle butter.', 2400, true, '{vegetarian,gluten-free}', 4),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000000c3',
   'House Lemonade', 'Fresh-squeezed.', 500, true, '{vegetarian,gluten-free}', 1),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000000c3',
   'Cold Brew', 'Single origin, 16 oz.', 600, true, '{vegetarian,gluten-free}', 2),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000000c3',
   'Sparkling Water', '750 ml bottle.', 700, true, '{vegetarian,gluten-free}', 3),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000000c3',
   'Local IPA', 'Rotating draft, 16 oz.', 900, true, '{vegetarian}', 4);

-- One linked add-on (ruled 2026-10-03): sold only inside the burger, never on its own.
insert into public.menu_items
  (restaurant_id, category_id, name, description, price_cents, is_available, dietary_tags, sort_order, addon_only)
values
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000000c2',
   'Add Bacon', null, 300, true, '{}', 5, true);
insert into public.menu_item_addons (restaurant_id, item_id, addon_id)
select b.restaurant_id, b.id, a.id
from public.menu_items b, public.menu_items a
where b.restaurant_id = '00000000-0000-4000-8000-000000000001' and b.name = 'Bistro Burger'
  and a.restaurant_id = b.restaurant_id and a.name = 'Add Bacon';

-- qr_token is set by trigger; never supply it.
insert into public.dining_tables (restaurant_id, label, capacity) values
  ('00000000-0000-4000-8000-000000000001', 'A1', 2),
  ('00000000-0000-4000-8000-000000000001', 'A2', 2),
  ('00000000-0000-4000-8000-000000000001', 'B1', 4),
  ('00000000-0000-4000-8000-000000000001', 'B2', 6);
