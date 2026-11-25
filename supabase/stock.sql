begin;

update products set stock_qty = 120.00 where sku = 'DRY-OAT-1L';
update products set stock_qty = 100.00 where sku = 'DRY-WHL-1L';
update products set stock_qty = 60.00 where sku = 'DRY-ALM-1L';
update products set stock_qty = 55.00 where sku = 'DRY-SOY-1L';
update products set stock_qty = 60.00 where sku = 'DRY-CRM-1L';
update products set stock_qty = 50.00 where sku = 'DRY-BTR-250';
update products set stock_qty = 5.00 where sku = 'DRY-EGG-30';
update products set stock_qty = 8.00 where sku = 'DRY-YOG-1K';

update products set stock_qty = 120.00 where sku = 'COF-ARB-1K';
update products set stock_qty = 50.00 where sku = 'COF-ETH-1K';
update products set stock_qty = 45.00 where sku = 'COF-DCF-1K';
update products set stock_qty = 80.00 where sku = 'COF-MAT-1K';
update products set stock_qty = 6.00 where sku = 'COF-CHA-1K';
update products set stock_qty = 40.00 where sku = 'COF-EAR-1K';
update products set stock_qty = 45.00 where sku = 'COF-COC-1K';
update products set stock_qty = 9.00 where sku = 'COF-CLD-1L';

update products set stock_qty = 80.00 where sku = 'DRG-FLR-5K';
update products set stock_qty = 75.00 where sku = 'DRG-SGR-5K';
update products set stock_qty = 50.00 where sku = 'DRG-BRS-5K';
update products set stock_qty = 45.00 where sku = 'DRG-OAT-5K';
update products set stock_qty = 60.00 where sku = 'DRG-PAS-5K';
update products set stock_qty = 55.00 where sku = 'DRG-RIC-5K';
update products set stock_qty = 10.00 where sku = 'DRG-ALM-1K';
update products set stock_qty = 70.00 where sku = 'DRG-CHOC-1K';

update products set stock_qty = 90.00 where sku = 'SAU-VAN-750';
update products set stock_qty = 85.00 where sku = 'SAU-CAR-750';
update products set stock_qty = 70.00 where sku = 'SAU-HAZ-750';
update products set stock_qty = 60.00 where sku = 'SAU-CHO-2L';
update products set stock_qty = 65.00 where sku = 'SAU-HNY-1L';
update products set stock_qty = 80.00 where sku = 'SAU-OLI-1L';
update products set stock_qty = 70.00 where sku = 'SAU-TOM-2K';
update products set stock_qty = 55.00 where sku = 'SAU-BAL-500';

update products set stock_qty = 140.00 where sku = 'PKG-CUP8-50';
update products set stock_qty = 150.00 where sku = 'PKG-CUP12-50';
update products set stock_qty = 150.00 where sku = 'PKG-LID-50';
update products set stock_qty = 120.00 where sku = 'PKG-ICUP-50';
update products set stock_qty = 120.00 where sku = 'PKG-ILID-50';
update products set stock_qty = 130.00 where sku = 'PKG-NAP-50';
update products set stock_qty = 100.00 where sku = 'PKG-BAG-50';
update products set stock_qty = 90.00 where sku = 'PKG-BOX-50';

do $$
declare
  v_total bigint;
  v_unseeded bigint;
  v_eggs numeric(10,2);
begin
  select count(*) into v_total from products;
  if v_total <> 40 then
    raise exception 'Expected 40 products in stock.sql, got %', v_total;
  end if;

  select count(*) into v_unseeded from products where stock_qty <= 0;
  if v_unseeded > 0 then
    raise exception 'Found % products with stock_qty <= 0 after stock seed', v_unseeded;
  end if;

  select stock_qty into v_eggs from products where sku = 'DRY-EGG-30';
  if v_eggs is distinct from 5.00 then
    raise exception 'Expected DRY-EGG-30 stock_qty = 5.00, got %', v_eggs;
  end if;
end
$$;

commit;
