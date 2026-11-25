insert into tiers (id, code, name, discount_pct) values
  (1, 'cafe', 'Café', 0.00),
  (2, 'restaurant_group', 'Restaurant Group', 5.00),
  (3, 'hotel_chain', 'Hotel Chain', 10.00);

insert into units_of_measure (code, name, base_qty) values
  ('BTL', 'Bottle', 1),
  ('CTN12', 'Carton of 12', 12),
  ('BAG1KG', '1 kg Bag', 1),
  ('SACK5KG', '5 kg Sack', 5),
  ('TRAY30', 'Tray of 30', 30),
  ('PACK50', 'Pack of 50', 50),
  ('CASE6', 'Case of 6', 6);

insert into products (sku, name, category, unit_code, list_price, aliases) values
  ('DRY-OAT-1L', 'Oat Milk 1L', 'dairy', 'CTN12', 28.50, ARRAY['oat milk', 'oatly', 'barista oat']),
  ('DRY-WHL-1L', 'Full Cream Fresh Milk 1L', 'dairy', 'CTN12', 21.60, ARRAY['whole milk', 'fresh milk']),
  ('DRY-ALM-1L', 'Barista Almond Milk 1L', 'dairy', 'CTN12', 29.40, ARRAY['almond milk', 'barista almond']),
  ('DRY-SOY-1L', 'Barista Soy Milk 1L', 'dairy', 'CTN12', 24.00, ARRAY['soy milk', 'soya']),
  ('DRY-CRM-1L', 'Whipping Cream 35% 1L', 'dairy', 'CTN12', 42.00, ARRAY['whipping cream', 'heavy cream']),
  ('DRY-BTR-250', 'Unsalted Cultured Butter 250g', 'dairy', 'CASE6', 22.80, ARRAY['butter', 'unsalted butter']),
  ('DRY-EGG-30', 'Free-Range Large Eggs', 'dairy', 'TRAY30', 9.60, ARRAY['eggs', 'egg tray']),
  ('DRY-YOG-1K', 'Greek Strained Yogurt 1kg', 'dairy', 'CASE6', 31.20, ARRAY['greek yogurt', 'yogurt']),
  ('COF-ARB-1K', 'House Espresso Arabica Beans', 'coffee_tea', 'BAG1KG', 24.00, ARRAY['arabica beans', 'espresso beans', 'house blend']),
  ('COF-ETH-1K', 'Single Origin Ethiopia Yirgacheffe', 'coffee_tea', 'BAG1KG', 29.50, ARRAY['ethiopia beans', 'yirgacheffe', 'filter beans']),
  ('COF-DCF-1K', 'Swiss Water Decaf Espresso Beans', 'coffee_tea', 'BAG1KG', 26.00, ARRAY['decaf', 'decaf beans']),
  ('COF-MAT-1K', 'Ceremonial Uji Matcha Powder', 'coffee_tea', 'BAG1KG', 68.00, ARRAY['matcha', 'matcha powder']),
  ('COF-CHA-1K', 'Spiced Masala Chai Concentrate 1L', 'coffee_tea', 'CASE6', 36.00, ARRAY['chai', 'chai concentrate']),
  ('COF-EAR-1K', 'Loose Leaf Earl Grey Tea', 'coffee_tea', 'BAG1KG', 22.50, ARRAY['earl grey', 'black tea']),
  ('COF-COC-1K', 'Dutch-Process Dark Cocoa Powder', 'coffee_tea', 'BAG1KG', 18.50, ARRAY['cocoa powder', 'chocolate powder']),
  ('COF-CLD-1L', 'Cold Brew Coffee Concentrate 1L', 'coffee_tea', 'CASE6', 44.40, ARRAY['cold brew', 'cold brew concentrate']),
  ('DRG-FLR-5K', 'Unbleached Bread Flour', 'dry_goods', 'SACK5KG', 11.50, ARRAY['bread flour', 'flour 5kg']),
  ('DRG-SGR-5K', 'Fine Caster Sugar', 'dry_goods', 'SACK5KG', 10.20, ARRAY['caster sugar', 'white sugar']),
  ('DRG-BRS-5K', 'Muscovado Brown Sugar', 'dry_goods', 'SACK5KG', 13.80, ARRAY['brown sugar', 'muscovado']),
  ('DRG-OAT-5K', 'Rolled Jumbo Oats', 'dry_goods', 'SACK5KG', 14.50, ARRAY['rolled oats', 'oats']),
  ('DRG-PAS-5K', 'Artisanal Penne Rigate Pasta', 'dry_goods', 'SACK5KG', 16.00, ARRAY['penne', 'pasta']),
  ('DRG-RIC-5K', 'Arborio Risotto Rice', 'dry_goods', 'SACK5KG', 19.50, ARRAY['arborio rice', 'risotto rice']),
  ('DRG-ALM-1K', 'Blanched Almond Meal', 'dry_goods', 'BAG1KG', 15.40, ARRAY['almond meal', 'almond flour']),
  ('DRG-CHOC-1K', '70% Dark Couverture Chocolate Drops', 'dry_goods', 'BAG1KG', 21.00, ARRAY['dark chocolate', 'couverture', 'chocolate drops']),
  ('SAU-VAN-750', 'Madagascar Vanilla Syrup 750ml', 'sauces', 'BTL', 11.50, ARRAY['vanilla syrup', 'vanilla']),
  ('SAU-CAR-750', 'Salted Caramel Syrup 750ml', 'sauces', 'BTL', 11.50, ARRAY['caramel syrup', 'salted caramel']),
  ('SAU-HAZ-750', 'Roasted Hazelnut Syrup 750ml', 'sauces', 'BTL', 11.50, ARRAY['hazelnut syrup', 'hazelnut']),
  ('SAU-CHO-2L', 'Rich Dark Chocolate Sauce 2L', 'sauces', 'CASE6', 54.00, ARRAY['chocolate sauce', 'mocha sauce']),
  ('SAU-HNY-1L', 'Wildflower Blossom Honey 1L', 'sauces', 'BTL', 14.80, ARRAY['honey', 'wildflower honey']),
  ('SAU-OLI-1L', 'Extra Virgin Olive Oil 1L', 'sauces', 'CASE6', 78.00, ARRAY['olive oil', 'evoo']),
  ('SAU-TOM-2K', 'San Marzano Crushed Tomatoes', 'sauces', 'CASE6', 33.00, ARRAY['crushed tomatoes', 'tomato sauce']),
  ('SAU-BAL-500', 'Aged Modena Balsamic Glaze 500ml', 'sauces', 'BTL', 13.20, ARRAY['balsamic glaze', 'balsamic']),
  ('PKG-CUP8-50', 'Kraft Double-Wall Hot Cup 8oz', 'packaging', 'PACK50', 6.50, ARRAY['8oz cups', 'hot cups 8oz']),
  ('PKG-CUP12-50', 'Kraft Double-Wall Hot Cup 12oz', 'packaging', 'PACK50', 7.80, ARRAY['12oz cups', 'hot cups 12oz']),
  ('PKG-LID-50', 'Sip-Through Hot Cup Lid (8/12oz)', 'packaging', 'PACK50', 4.20, ARRAY['hot lids', 'cup lids']),
  ('PKG-ICUP-50', 'Clear PLA Cold Cup 16oz', 'packaging', 'PACK50', 8.40, ARRAY['cold cups', '16oz iced cups']),
  ('PKG-ILID-50', 'Flat Strawless Cold Cup Lid 16oz', 'packaging', 'PACK50', 4.50, ARRAY['cold lids', 'iced cup lids']),
  ('PKG-NAP-50', 'Unbleached Kraft Cocktail Napkins', 'packaging', 'PACK50', 3.20, ARRAY['napkins', 'kraft napkins']),
  ('PKG-BAG-50', 'Kraft Takeaway Carrier Bag Medium', 'packaging', 'PACK50', 9.00, ARRAY['paper bags', 'takeaway bags']),
  ('PKG-BOX-50', 'Compostable Clamshell Meal Box', 'packaging', 'PACK50', 14.50, ARRAY['meal box', 'takeaway box', 'clamshell']);

insert into tier_prices (tier_id, sku, unit_price)
select t.id, p.sku, round(p.list_price * (1 - t.discount_pct / 100.0), 2)
from tiers t
cross join products p;

insert into customers (id, name, kind, tier_id, telegram_user_id, created_at) values
  ('10000000-0000-4000-8000-000000000001', 'Kapé Corner', 'cafe', 1, null, now() - interval '60 days'),
  ('10000000-0000-4000-8000-000000000002', 'Third Wave Roastery', 'cafe', 1, -100001, now() - interval '55 days'),
  ('10000000-0000-4000-8000-000000000003', 'Morning Ritual Espresso', 'cafe', 1, -100002, now() - interval '50 days'),
  ('10000000-0000-4000-8000-000000000004', 'Bistro Verde Group', 'restaurant', 2, -100003, now() - interval '48 days'),
  ('10000000-0000-4000-8000-000000000005', 'Saffron & Salt Kitchens', 'restaurant', 2, -100004, now() - interval '45 days'),
  ('10000000-0000-4000-8000-000000000006', 'Harborfront Dining Co.', 'restaurant', 2, -100005, now() - interval '42 days'),
  ('10000000-0000-4000-8000-000000000007', 'Harbourline Hotel Manila', 'hotel', 3, null, now() - interval '40 days'),
  ('10000000-0000-4000-8000-000000000008', 'Crestview Grand Hotels', 'hotel', 3, -100006, now() - interval '38 days');

insert into conversations (id, customer_id, telegram_chat_id, created_at) values
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', -200001, now() - interval '29 days'),
  ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', -200002, now() - interval '23 days'),
  ('20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', -200003, now() - interval '17 days'),
  ('20000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000001', -200004, now() - interval '10 days'),
  ('20000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000001', -200005, now() - interval '3 days'),
  ('20000000-0000-4000-8000-000000000006', '10000000-0000-4000-8000-000000000002', -200006, now() - interval '28 days'),
  ('20000000-0000-4000-8000-000000000007', '10000000-0000-4000-8000-000000000002', -200007, now() - interval '22 days'),
  ('20000000-0000-4000-8000-000000000008', '10000000-0000-4000-8000-000000000002', -200008, now() - interval '15 days'),
  ('20000000-0000-4000-8000-000000000009', '10000000-0000-4000-8000-000000000002', -200009, now() - interval '9 days'),
  ('20000000-0000-4000-8000-000000000010', '10000000-0000-4000-8000-000000000002', -200010, now() - interval '2 days'),
  ('20000000-0000-4000-8000-000000000011', '10000000-0000-4000-8000-000000000003', -200011, now() - interval '27 days'),
  ('20000000-0000-4000-8000-000000000012', '10000000-0000-4000-8000-000000000003', -200012, now() - interval '21 days'),
  ('20000000-0000-4000-8000-000000000013', '10000000-0000-4000-8000-000000000003', -200013, now() - interval '14 days'),
  ('20000000-0000-4000-8000-000000000014', '10000000-0000-4000-8000-000000000003', -200014, now() - interval '8 days'),
  ('20000000-0000-4000-8000-000000000015', '10000000-0000-4000-8000-000000000003', -200015, now() - interval '1 day'),
  ('20000000-0000-4000-8000-000000000016', '10000000-0000-4000-8000-000000000004', -200016, now() - interval '26 days'),
  ('20000000-0000-4000-8000-000000000017', '10000000-0000-4000-8000-000000000004', -200017, now() - interval '20 days'),
  ('20000000-0000-4000-8000-000000000018', '10000000-0000-4000-8000-000000000004', -200018, now() - interval '13 days'),
  ('20000000-0000-4000-8000-000000000019', '10000000-0000-4000-8000-000000000004', -200019, now() - interval '7 days'),
  ('20000000-0000-4000-8000-000000000020', '10000000-0000-4000-8000-000000000004', -200020, now() - interval '2 days'),
  ('20000000-0000-4000-8000-000000000021', '10000000-0000-4000-8000-000000000005', -200021, now() - interval '25 days'),
  ('20000000-0000-4000-8000-000000000022', '10000000-0000-4000-8000-000000000005', -200022, now() - interval '19 days'),
  ('20000000-0000-4000-8000-000000000023', '10000000-0000-4000-8000-000000000005', -200023, now() - interval '12 days'),
  ('20000000-0000-4000-8000-000000000024', '10000000-0000-4000-8000-000000000005', -200024, now() - interval '6 days'),
  ('20000000-0000-4000-8000-000000000025', '10000000-0000-4000-8000-000000000005', -200025, now() - interval '1 day'),
  ('20000000-0000-4000-8000-000000000026', '10000000-0000-4000-8000-000000000006', -200026, now() - interval '24 days'),
  ('20000000-0000-4000-8000-000000000027', '10000000-0000-4000-8000-000000000006', -200027, now() - interval '18 days'),
  ('20000000-0000-4000-8000-000000000028', '10000000-0000-4000-8000-000000000006', -200028, now() - interval '11 days'),
  ('20000000-0000-4000-8000-000000000029', '10000000-0000-4000-8000-000000000006', -200029, now() - interval '5 days'),
  ('20000000-0000-4000-8000-000000000030', '10000000-0000-4000-8000-000000000006', -200030, now() - interval '1 day'),
  ('20000000-0000-4000-8000-000000000031', '10000000-0000-4000-8000-000000000007', -200031, now() - interval '28 days'),
  ('20000000-0000-4000-8000-000000000032', '10000000-0000-4000-8000-000000000007', -200032, now() - interval '21 days'),
  ('20000000-0000-4000-8000-000000000033', '10000000-0000-4000-8000-000000000007', -200033, now() - interval '14 days'),
  ('20000000-0000-4000-8000-000000000034', '10000000-0000-4000-8000-000000000007', -200034, now() - interval '7 days'),
  ('20000000-0000-4000-8000-000000000035', '10000000-0000-4000-8000-000000000007', -200035, now() - interval '2 days'),
  ('20000000-0000-4000-8000-000000000036', '10000000-0000-4000-8000-000000000008', -200036, now() - interval '26 days'),
  ('20000000-0000-4000-8000-000000000037', '10000000-0000-4000-8000-000000000008', -200037, now() - interval '19 days'),
  ('20000000-0000-4000-8000-000000000038', '10000000-0000-4000-8000-000000000008', -200038, now() - interval '12 days'),
  ('20000000-0000-4000-8000-000000000039', '10000000-0000-4000-8000-000000000008', -200039, now() - interval '4 days'),
  ('20000000-0000-4000-8000-000000000040', '10000000-0000-4000-8000-000000000008', -200040, now() - interval '1 day');

insert into orders (id, customer_id, conversation_id, status, source, po_number, version, currency, total, review_reasons, expires_at, confirmed_at, created_at, updated_at) values
  ('30000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'fulfilled', 'text', null, 1, 'USD', 0.00, '{}', null, now() - interval '29 days' + interval '5 minutes', now() - interval '29 days', now() - interval '28 days'),
  ('30000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002', 'fulfilled', 'text', null, 1, 'USD', 0.00, '{}', null, now() - interval '23 days' + interval '4 minutes', now() - interval '23 days', now() - interval '22 days'),
  ('30000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000003', 'confirmed', 'photo', null, 1, 'USD', 0.00, '{}', null, now() - interval '17 days' + interval '6 minutes', now() - interval '17 days', now() - interval '17 days' + interval '6 minutes'),
  ('30000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000004', 'confirmed', 'text', null, 1, 'USD', 0.00, '{}', null, now() - interval '10 days' + interval '3 minutes', now() - interval '10 days', now() - interval '10 days' + interval '3 minutes'),
  ('30000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000005', 'confirmed', 'text', null, 1, 'USD', 0.00, '{}', null, now() - interval '3 days' + interval '5 minutes', now() - interval '3 days', now() - interval '3 days' + interval '5 minutes'),

  ('30000000-0000-4000-8000-000000000006', '10000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000006', 'fulfilled', 'text', null, 1, 'USD', 0.00, '{}', null, now() - interval '28 days' + interval '4 minutes', now() - interval '28 days', now() - interval '27 days'),
  ('30000000-0000-4000-8000-000000000007', '10000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000007', 'fulfilled', 'text', null, 1, 'USD', 0.00, '{}', null, now() - interval '22 days' + interval '5 minutes', now() - interval '22 days', now() - interval '21 days'),
  ('30000000-0000-4000-8000-000000000008', '10000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000008', 'cancelled', 'text', null, 1, 'USD', 0.00, '{}', null, null, now() - interval '15 days', now() - interval '15 days'),
  ('30000000-0000-4000-8000-000000000009', '10000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000009', 'confirmed', 'text', null, 1, 'USD', 0.00, '{}', null, now() - interval '9 days' + interval '3 minutes', now() - interval '9 days', now() - interval '9 days' + interval '3 minutes'),
  ('30000000-0000-4000-8000-000000000010', '10000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000010', 'confirmed', 'text', null, 1, 'USD', 0.00, '{}', null, now() - interval '2 days' + interval '4 minutes', now() - interval '2 days', now() - interval '2 days' + interval '4 minutes'),

  ('30000000-0000-4000-8000-000000000011', '10000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000011', 'fulfilled', 'text', null, 1, 'USD', 0.00, '{}', null, now() - interval '27 days' + interval '4 minutes', now() - interval '27 days', now() - interval '26 days'),
  ('30000000-0000-4000-8000-000000000012', '10000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000012', 'fulfilled', 'text', null, 1, 'USD', 0.00, '{}', null, now() - interval '21 days' + interval '5 minutes', now() - interval '21 days', now() - interval '20 days'),
  ('30000000-0000-4000-8000-000000000013', '10000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000013', 'expired', 'text', null, 1, 'USD', 0.00, '{}', now() - interval '14 days' + interval '24 hours', null, now() - interval '14 days', now() - interval '14 days' + interval '24 hours'),
  ('30000000-0000-4000-8000-000000000014', '10000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000014', 'confirmed', 'photo', null, 1, 'USD', 0.00, '{}', null, now() - interval '8 days' + interval '6 minutes', now() - interval '8 days', now() - interval '8 days' + interval '6 minutes'),
  ('30000000-0000-4000-8000-000000000015', '10000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000015', 'confirmed', 'text', null, 1, 'USD', 0.00, '{}', null, now() - interval '1 day' + interval '3 minutes', now() - interval '1 day', now() - interval '1 day' + interval '3 minutes'),

  ('30000000-0000-4000-8000-000000000016', '10000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000016', 'fulfilled', 'text', null, 1, 'USD', 0.00, '{}', null, now() - interval '26 days' + interval '5 minutes', now() - interval '26 days', now() - interval '25 days'),
  ('30000000-0000-4000-8000-000000000017', '10000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000017', 'fulfilled', 'text', null, 1, 'USD', 0.00, '{}', null, now() - interval '20 days' + interval '4 minutes', now() - interval '20 days', now() - interval '19 days'),
  ('30000000-0000-4000-8000-000000000018', '10000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000018', 'confirmed', 'text', null, 1, 'USD', 0.00, '{}', null, now() - interval '13 days' + interval '6 minutes', now() - interval '13 days', now() - interval '13 days' + interval '6 minutes'),
  ('30000000-0000-4000-8000-000000000019', '10000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000019', 'needs_review', 'text', null, 1, 'USD', 0.00, ARRAY['over_threshold'], null, null, now() - interval '7 days', now() - interval '7 days'),
  ('30000000-0000-4000-8000-000000000020', '10000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000020', 'confirmed', 'text', null, 1, 'USD', 0.00, '{}', null, now() - interval '2 days' + interval '4 minutes', now() - interval '2 days', now() - interval '2 days' + interval '4 minutes'),

  ('30000000-0000-4000-8000-000000000021', '10000000-0000-4000-8000-000000000005', '20000000-0000-4000-8000-000000000021', 'fulfilled', 'text', null, 1, 'USD', 0.00, '{}', null, now() - interval '25 days' + interval '5 minutes', now() - interval '25 days', now() - interval '24 days'),
  ('30000000-0000-4000-8000-000000000022', '10000000-0000-4000-8000-000000000005', '20000000-0000-4000-8000-000000000022', 'fulfilled', 'text', null, 1, 'USD', 0.00, '{}', null, now() - interval '19 days' + interval '5 minutes', now() - interval '19 days', now() - interval '18 days'),
  ('30000000-0000-4000-8000-000000000023', '10000000-0000-4000-8000-000000000005', '20000000-0000-4000-8000-000000000023', 'confirmed', 'text', null, 1, 'USD', 0.00, '{}', null, now() - interval '12 days' + interval '4 minutes', now() - interval '12 days', now() - interval '12 days' + interval '4 minutes'),
  ('30000000-0000-4000-8000-000000000024', '10000000-0000-4000-8000-000000000005', '20000000-0000-4000-8000-000000000024', 'cancelled', 'text', null, 1, 'USD', 0.00, '{}', null, null, now() - interval '6 days', now() - interval '6 days'),
  ('30000000-0000-4000-8000-000000000025', '10000000-0000-4000-8000-000000000005', '20000000-0000-4000-8000-000000000025', 'confirmed', 'text', null, 1, 'USD', 0.00, '{}', null, now() - interval '1 day' + interval '4 minutes', now() - interval '1 day', now() - interval '1 day' + interval '4 minutes'),

  ('30000000-0000-4000-8000-000000000026', '10000000-0000-4000-8000-000000000006', '20000000-0000-4000-8000-000000000026', 'fulfilled', 'text', null, 1, 'USD', 0.00, '{}', null, now() - interval '24 days' + interval '5 minutes', now() - interval '24 days', now() - interval '23 days'),
  ('30000000-0000-4000-8000-000000000027', '10000000-0000-4000-8000-000000000006', '20000000-0000-4000-8000-000000000027', 'fulfilled', 'text', null, 1, 'USD', 0.00, '{}', null, now() - interval '18 days' + interval '6 minutes', now() - interval '18 days', now() - interval '17 days'),
  ('30000000-0000-4000-8000-000000000028', '10000000-0000-4000-8000-000000000006', '20000000-0000-4000-8000-000000000028', 'confirmed', 'text', null, 1, 'USD', 0.00, '{}', null, now() - interval '11 days' + interval '3 minutes', now() - interval '11 days', now() - interval '11 days' + interval '3 minutes'),
  ('30000000-0000-4000-8000-000000000029', '10000000-0000-4000-8000-000000000006', '20000000-0000-4000-8000-000000000029', 'needs_review', 'text', null, 1, 'USD', 0.00, ARRAY['price_mismatch'], null, null, now() - interval '5 days', now() - interval '5 days'),
  ('30000000-0000-4000-8000-000000000030', '10000000-0000-4000-8000-000000000006', '20000000-0000-4000-8000-000000000030', 'confirmed', 'text', null, 1, 'USD', 0.00, '{}', null, now() - interval '1 day' + interval '5 minutes', now() - interval '1 day', now() - interval '1 day' + interval '5 minutes'),

  ('30000000-0000-4000-8000-000000000031', '10000000-0000-4000-8000-000000000007', '20000000-0000-4000-8000-000000000031', 'fulfilled', 'pdf', 'PO-HHL-1001', 1, 'USD', 0.00, '{}', null, now() - interval '28 days' + interval '5 minutes', now() - interval '28 days', now() - interval '27 days'),
  ('30000000-0000-4000-8000-000000000032', '10000000-0000-4000-8000-000000000007', '20000000-0000-4000-8000-000000000032', 'fulfilled', 'pdf', 'PO-HHL-1002', 1, 'USD', 0.00, '{}', null, now() - interval '21 days' + interval '4 minutes', now() - interval '21 days', now() - interval '20 days'),
  ('30000000-0000-4000-8000-000000000033', '10000000-0000-4000-8000-000000000007', '20000000-0000-4000-8000-000000000033', 'confirmed', 'xlsx', 'PO-HHL-1003', 1, 'USD', 0.00, '{}', null, now() - interval '14 days' + interval '6 minutes', now() - interval '14 days', now() - interval '14 days' + interval '6 minutes'),
  ('30000000-0000-4000-8000-000000000034', '10000000-0000-4000-8000-000000000007', '20000000-0000-4000-8000-000000000034', 'needs_review', 'pdf', 'PO-HHL-1004', 1, 'USD', 0.00, ARRAY['over_threshold'], null, null, now() - interval '7 days', now() - interval '7 days'),
  ('30000000-0000-4000-8000-000000000035', '10000000-0000-4000-8000-000000000007', '20000000-0000-4000-8000-000000000035', 'confirmed', 'xlsx', 'PO-HHL-1005', 1, 'USD', 0.00, '{}', null, now() - interval '2 days' + interval '4 minutes', now() - interval '2 days', now() - interval '2 days' + interval '4 minutes'),

  ('30000000-0000-4000-8000-000000000036', '10000000-0000-4000-8000-000000000008', '20000000-0000-4000-8000-000000000036', 'fulfilled', 'pdf', 'PO-CGH-2001', 1, 'USD', 0.00, '{}', null, now() - interval '26 days' + interval '5 minutes', now() - interval '26 days', now() - interval '25 days'),
  ('30000000-0000-4000-8000-000000000037', '10000000-0000-4000-8000-000000000008', '20000000-0000-4000-8000-000000000037', 'fulfilled', 'pdf', 'PO-CGH-2002', 1, 'USD', 0.00, '{}', null, now() - interval '19 days' + interval '4 minutes', now() - interval '19 days', now() - interval '18 days'),
  ('30000000-0000-4000-8000-000000000038', '10000000-0000-4000-8000-000000000008', '20000000-0000-4000-8000-000000000038', 'confirmed', 'pdf', 'PO-CGH-2003', 1, 'USD', 0.00, '{}', null, now() - interval '12 days' + interval '5 minutes', now() - interval '12 days', now() - interval '12 days' + interval '5 minutes'),
  ('30000000-0000-4000-8000-000000000039', '10000000-0000-4000-8000-000000000008', '20000000-0000-4000-8000-000000000039', 'confirmed', 'xlsx', 'PO-CGH-2004', 1, 'USD', 0.00, '{}', null, now() - interval '4 days' + interval '4 minutes', now() - interval '4 days', now() - interval '4 days' + interval '4 minutes'),
  ('30000000-0000-4000-8000-000000000040', '10000000-0000-4000-8000-000000000008', '20000000-0000-4000-8000-000000000040', 'confirmed', 'xls', 'PO-CGH-2005', 1, 'USD', 0.00, '{}', null, now() - interval '1 day' + interval '3 minutes', now() - interval '1 day', now() - interval '1 day' + interval '3 minutes');

insert into order_lines (order_id, version, line_no, sku, quantity, unit_code, unit_price, line_total)
select
  v.order_id,
  1,
  v.line_no,
  v.sku,
  v.quantity,
  p.unit_code,
  tp.unit_price,
  round(v.quantity * tp.unit_price, 2)
from (
  values
    ('30000000-0000-4000-8000-000000000001'::uuid, 1, 'DRY-OAT-1L', 4.00),
    ('30000000-0000-4000-8000-000000000001'::uuid, 2, 'COF-ARB-1K', 5.00),
    ('30000000-0000-4000-8000-000000000002'::uuid, 1, 'DRY-WHL-1L', 6.00),
    ('30000000-0000-4000-8000-000000000002'::uuid, 2, 'PKG-CUP12-50', 4.00),
    ('30000000-0000-4000-8000-000000000002'::uuid, 3, 'PKG-LID-50', 4.00),
    ('30000000-0000-4000-8000-000000000003'::uuid, 1, 'SAU-VAN-750', 6.00),
    ('30000000-0000-4000-8000-000000000003'::uuid, 2, 'SAU-CAR-750', 4.00),
    ('30000000-0000-4000-8000-000000000004'::uuid, 1, 'COF-MAT-1K', 2.00),
    ('30000000-0000-4000-8000-000000000004'::uuid, 2, 'DRY-OAT-1L', 3.00),
    ('30000000-0000-4000-8000-000000000005'::uuid, 1, 'COF-ARB-1K', 6.00),
    ('30000000-0000-4000-8000-000000000005'::uuid, 2, 'PKG-CUP8-50', 5.00),

    ('30000000-0000-4000-8000-000000000006'::uuid, 1, 'COF-ETH-1K', 6.00),
    ('30000000-0000-4000-8000-000000000006'::uuid, 2, 'COF-DCF-1K', 3.00),
    ('30000000-0000-4000-8000-000000000007'::uuid, 1, 'DRY-OAT-1L', 5.00),
    ('30000000-0000-4000-8000-000000000007'::uuid, 2, 'DRY-ALM-1L', 3.00),
    ('30000000-0000-4000-8000-000000000008'::uuid, 1, 'PKG-ICUP-50', 8.00),
    ('30000000-0000-4000-8000-000000000008'::uuid, 2, 'PKG-ILID-50', 8.00),
    ('30000000-0000-4000-8000-000000000009'::uuid, 1, 'COF-CLD-1L', 2.00),
    ('30000000-0000-4000-8000-000000000009'::uuid, 2, 'COF-EAR-1K', 2.00),
    ('30000000-0000-4000-8000-000000000010'::uuid, 1, 'COF-ARB-1K', 8.00),
    ('30000000-0000-4000-8000-000000000010'::uuid, 2, 'DRG-SGR-5K', 2.00),

    ('30000000-0000-4000-8000-000000000011'::uuid, 1, 'DRY-SOY-1L', 4.00),
    ('30000000-0000-4000-8000-000000000011'::uuid, 2, 'COF-CHA-1K', 2.00),
    ('30000000-0000-4000-8000-000000000012'::uuid, 1, 'SAU-CHO-2L', 2.00),
    ('30000000-0000-4000-8000-000000000012'::uuid, 2, 'COF-COC-1K', 4.00),
    ('30000000-0000-4000-8000-000000000013'::uuid, 1, 'DRY-OAT-1L', 3.00),
    ('30000000-0000-4000-8000-000000000013'::uuid, 2, 'PKG-NAP-50', 6.00),
    ('30000000-0000-4000-8000-000000000014'::uuid, 1, 'DRG-FLR-5K', 4.00),
    ('30000000-0000-4000-8000-000000000014'::uuid, 2, 'DRY-BTR-250', 3.00),
    ('30000000-0000-4000-8000-000000000015'::uuid, 1, 'COF-ARB-1K', 4.00),
    ('30000000-0000-4000-8000-000000000015'::uuid, 2, 'SAU-HAZ-750', 4.00),

    ('30000000-0000-4000-8000-000000000016'::uuid, 1, 'DRG-PAS-5K', 8.00),
    ('30000000-0000-4000-8000-000000000016'::uuid, 2, 'SAU-TOM-2K', 6.00),
    ('30000000-0000-4000-8000-000000000016'::uuid, 3, 'SAU-OLI-1L', 3.00),
    ('30000000-0000-4000-8000-000000000017'::uuid, 1, 'DRY-CRM-1L', 4.00),
    ('30000000-0000-4000-8000-000000000017'::uuid, 2, 'DRY-EGG-30', 10.00),
    ('30000000-0000-4000-8000-000000000018'::uuid, 1, 'DRG-RIC-5K', 6.00),
    ('30000000-0000-4000-8000-000000000018'::uuid, 2, 'SAU-BAL-500', 8.00),
    ('30000000-0000-4000-8000-000000000019'::uuid, 1, 'SAU-OLI-1L', 20.00),
    ('30000000-0000-4000-8000-000000000019'::uuid, 2, 'COF-ARB-1K', 30.00),
    ('30000000-0000-4000-8000-000000000020'::uuid, 1, 'PKG-BOX-50', 10.00),
    ('30000000-0000-4000-8000-000000000020'::uuid, 2, 'PKG-BAG-50', 8.00),

    ('30000000-0000-4000-8000-000000000021'::uuid, 1, 'DRY-BTR-250', 6.00),
    ('30000000-0000-4000-8000-000000000021'::uuid, 2, 'DRG-FLR-5K', 8.00),
    ('30000000-0000-4000-8000-000000000022'::uuid, 1, 'SAU-TOM-2K', 8.00),
    ('30000000-0000-4000-8000-000000000022'::uuid, 2, 'DRG-PAS-5K', 10.00),
    ('30000000-0000-4000-8000-000000000023'::uuid, 1, 'DRY-YOG-1K', 4.00),
    ('30000000-0000-4000-8000-000000000023'::uuid, 2, 'SAU-HNY-1L', 6.00),
    ('30000000-0000-4000-8000-000000000024'::uuid, 1, 'DRG-OAT-5K', 5.00),
    ('30000000-0000-4000-8000-000000000024'::uuid, 2, 'DRG-BRS-5K', 5.00),
    ('30000000-0000-4000-8000-000000000025'::uuid, 1, 'COF-ARB-1K', 8.00),
    ('30000000-0000-4000-8000-000000000025'::uuid, 2, 'DRY-OAT-1L', 6.00),

    ('30000000-0000-4000-8000-000000000026'::uuid, 1, 'DRY-WHL-1L', 8.00),
    ('30000000-0000-4000-8000-000000000026'::uuid, 2, 'DRY-EGG-30', 12.00),
    ('30000000-0000-4000-8000-000000000027'::uuid, 1, 'DRG-CHOC-1K', 10.00),
    ('30000000-0000-4000-8000-000000000027'::uuid, 2, 'DRG-ALM-1K', 6.00),
    ('30000000-0000-4000-8000-000000000028'::uuid, 1, 'PKG-BOX-50', 12.00),
    ('30000000-0000-4000-8000-000000000028'::uuid, 2, 'PKG-NAP-50', 10.00),
    ('30000000-0000-4000-8000-000000000029'::uuid, 1, 'SAU-OLI-1L', 4.00),
    ('30000000-0000-4000-8000-000000000029'::uuid, 2, 'SAU-TOM-2K', 6.00),
    ('30000000-0000-4000-8000-000000000030'::uuid, 1, 'COF-ARB-1K', 6.00),
    ('30000000-0000-4000-8000-000000000030'::uuid, 2, 'DRY-CRM-1L', 3.00),

    ('30000000-0000-4000-8000-000000000031'::uuid, 1, 'COF-ARB-1K', 15.00),
    ('30000000-0000-4000-8000-000000000031'::uuid, 2, 'DRY-OAT-1L', 10.00),
    ('30000000-0000-4000-8000-000000000031'::uuid, 3, 'DRY-WHL-1L', 12.00),
    ('30000000-0000-4000-8000-000000000032'::uuid, 1, 'DRY-EGG-30', 20.00),
    ('30000000-0000-4000-8000-000000000032'::uuid, 2, 'DRY-BTR-250', 10.00),
    ('30000000-0000-4000-8000-000000000032'::uuid, 3, 'DRY-YOG-1K', 8.00),
    ('30000000-0000-4000-8000-000000000033'::uuid, 1, 'PKG-CUP12-50', 15.00),
    ('30000000-0000-4000-8000-000000000033'::uuid, 2, 'PKG-LID-50', 15.00),
    ('30000000-0000-4000-8000-000000000034'::uuid, 1, 'COF-MAT-1K', 20.00),
    ('30000000-0000-4000-8000-000000000034'::uuid, 2, 'SAU-OLI-1L', 15.00),
    ('30000000-0000-4000-8000-000000000035'::uuid, 1, 'COF-EAR-1K', 8.00),
    ('30000000-0000-4000-8000-000000000035'::uuid, 2, 'SAU-HNY-1L', 10.00),

    ('30000000-0000-4000-8000-000000000036'::uuid, 1, 'DRG-RIC-5K', 12.00),
    ('30000000-0000-4000-8000-000000000036'::uuid, 2, 'SAU-OLI-1L', 6.00),
    ('30000000-0000-4000-8000-000000000036'::uuid, 3, 'SAU-TOM-2K', 10.00),
    ('30000000-0000-4000-8000-000000000037'::uuid, 1, 'COF-ARB-1K', 12.00),
    ('30000000-0000-4000-8000-000000000037'::uuid, 2, 'COF-DCF-1K', 6.00),
    ('30000000-0000-4000-8000-000000000038'::uuid, 1, 'DRY-CRM-1L', 8.00),
    ('30000000-0000-4000-8000-000000000038'::uuid, 2, 'DRG-CHOC-1K', 10.00),
    ('30000000-0000-4000-8000-000000000039'::uuid, 1, 'PKG-BOX-50', 20.00),
    ('30000000-0000-4000-8000-000000000039'::uuid, 2, 'PKG-BAG-50', 15.00),
    ('30000000-0000-4000-8000-000000000040'::uuid, 1, 'DRY-OAT-1L', 10.00),
    ('30000000-0000-4000-8000-000000000040'::uuid, 2, 'DRY-WHL-1L', 14.00)
) as v(order_id, line_no, sku, quantity)
join orders o on o.id = v.order_id
join customers c on c.id = o.customer_id
join products p on p.sku = v.sku
join tier_prices tp on tp.tier_id = c.tier_id and tp.sku = p.sku;

update orders o
set total = (
  select coalesce(sum(ol.line_total), 0.00)
  from order_lines ol
  where ol.order_id = o.id
    and ol.version = 1
);

with order_seq as (
  select
    o.id as order_id,
    o.conversation_id,
    o.status,
    o.source,
    o.po_number,
    o.created_at,
    row_number() over (order by o.id) as n
  from orders o
),
msg_in as (
  insert into messages (conversation_id, direction, author, kind, body, file_name, file_mime, telegram_message_id, created_at)
  select
    os.conversation_id,
    'in',
    'customer',
    case
      when os.source in ('pdf', 'xlsx', 'xls') then 'file'
      when os.source = 'photo' then 'photo'
      else 'text'
    end,
    case
      when os.source in ('pdf', 'xlsx', 'xls') then 'Please process attached order sheet' || coalesce(' (' || os.po_number || ')', '')
      when os.source = 'photo' then 'Here is a photo of our handwritten prep list'
      else 'Hi, please send our usual restock order' || coalesce(' under ' || os.po_number, '')
    end,
    case
      when os.source = 'pdf' then 'order-' || os.n || '.pdf'
      when os.source = 'xlsx' then 'order-' || os.n || '.xlsx'
      when os.source = 'xls' then 'order-' || os.n || '.xls'
      when os.source = 'photo' then 'prep-list-' || os.n || '.jpg'
      else null
    end,
    case
      when os.source = 'pdf' then 'application/pdf'
      when os.source = 'xlsx' then 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      when os.source = 'xls' then 'application/vnd.ms-excel'
      when os.source = 'photo' then 'image/jpeg'
      else null
    end,
    500000 + os.n * 10 + 1,
    os.created_at
  from order_seq os
  returning id, conversation_id
),
msg_bot as (
  insert into messages (conversation_id, direction, author, kind, body, file_name, file_mime, telegram_message_id, created_at)
  select
    os.conversation_id,
    'out',
    'bot',
    'text',
    'Draft order prepared. Please confirm to lock in pricing and delivery.',
    null,
    null,
    500000 + os.n * 10 + 2,
    os.created_at + interval '1 minute'
  from order_seq os
  returning id, conversation_id
),
msg_confirm as (
  insert into messages (conversation_id, direction, author, kind, body, file_name, file_mime, telegram_message_id, created_at)
  select
    os.conversation_id,
    'in',
    'customer',
    case when os.status in ('confirmed', 'fulfilled', 'needs_review') then 'button' else 'text' end,
    case
      when os.status in ('confirmed', 'fulfilled', 'needs_review') then 'confirm'
      when os.status = 'cancelled' then 'Cancel this order please.'
      else 'No response before expiry.'
    end,
    null,
    null,
    500000 + os.n * 10 + 3,
    os.created_at + interval '3 minutes'
  from order_seq os
  where os.status <> 'expired'
  returning id, conversation_id
),
msg_followup as (
  insert into messages (conversation_id, direction, author, kind, body, file_name, file_mime, telegram_message_id, created_at)
  select
    os.conversation_id,
    'out',
    'bot',
    'text',
    'Your order is held for review and a team member will follow up shortly.',
    null,
    null,
    500000 + os.n * 10 + 4,
    os.created_at + interval '4 minutes'
  from order_seq os
  where os.status = 'needs_review'
  returning id, conversation_id
)
insert into order_messages (order_id, message_id)
select os.order_id, m.id
from order_seq os
join (
  select id, conversation_id from msg_in
  union all
  select id, conversation_id from msg_bot
  union all
  select id, conversation_id from msg_confirm
  union all
  select id, conversation_id from msg_followup
) m on m.conversation_id = os.conversation_id;
