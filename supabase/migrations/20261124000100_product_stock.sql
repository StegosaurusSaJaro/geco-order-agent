alter table products
  add column stock_qty numeric(10,2) not null default 0
    constraint products_stock_qty_nonneg check (
      stock_qty >= 0 and stock_qty < 'Infinity'::numeric
    );

grant update (stock_qty) on products to authenticated;

create policy authenticated_update_products
  on products
  for update
  to authenticated
  using (true)
  with check (
    stock_qty >= 0 and stock_qty < 'Infinity'::numeric
  );
