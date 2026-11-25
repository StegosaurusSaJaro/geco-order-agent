do $$
declare
  v_count bigint;
  v_msg_id uuid;
  v_other_order_id uuid;
  v_stock numeric(10,2);
  v_flag_1 bigint;
  v_flag_2 bigint;
  v_flag_3 bigint;
  v_flag_result text;
  v_flag_status text;
  v_flag_reviewed_at timestamptz;
begin
  select count(*) into v_count
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind in ('r', 'p')
    and c.relrowsecurity = false;
  if v_count > 0 then
    raise exception 'RLS not enabled on all public tables (count=%)', v_count;
  end if;

  select count(*) into v_count from tiers;
  if v_count <> 3 then
    raise exception 'Expected 3 tiers, got %', v_count;
  end if;

  select count(*) into v_count from products;
  if v_count <> 40 then
    raise exception 'Expected 40 products, got %', v_count;
  end if;

  select count(*) into v_count from tier_prices;
  if v_count <> 120 then
    raise exception 'Expected 120 tier_prices, got %', v_count;
  end if;

  select count(*) into v_count from customers;
  if v_count <> 8 then
    raise exception 'Expected 8 customers, got %', v_count;
  end if;

  select count(*) into v_count from orders;
  if v_count <> 40 then
    raise exception 'Expected 40 orders, got %', v_count;
  end if;

  select count(*) into v_count
  from tier_prices tp
  join products p on p.sku = tp.sku
  join tiers t on t.id = tp.tier_id
  where tp.unit_price <> round(p.list_price * (1 - t.discount_pct / 100.0), 2);
  if v_count > 0 then
    raise exception 'tier_prices.unit_price mismatch count=%', v_count;
  end if;

  select count(*) into v_count
  from orders o
  where o.total <> coalesce(
    (select sum(ol.line_total) from order_lines ol where ol.order_id = o.id and ol.version = o.version),
    0
  );
  if v_count > 0 then
    raise exception 'orders.total mismatch count=%', v_count;
  end if;

  select count(*) into v_count
  from order_lines ol
  join orders o on o.id = ol.order_id
  join customers c on c.id = o.customer_id
  left join tier_prices tp on tp.tier_id = c.tier_id and tp.sku = ol.sku
  where tp.unit_price is null or ol.unit_price <> tp.unit_price;
  if v_count > 0 then
    raise exception 'order_lines.unit_price mismatch count=%', v_count;
  end if;

  set local role anon;
  begin
    select count(*) into v_count from orders;
    raise exception 'Expected permission denied for anon on orders, got % rows', v_count;
  exception
    when insufficient_privilege then
      null;
  end;

  set local role authenticated;
  select count(*) into v_count from orders;
  if v_count <> 40 then
    raise exception 'Expected 40 orders for authenticated, got %', v_count;
  end if;

  set local role service_role;
  select count(*) into v_count from orders;
  if v_count <> 40 then
    raise exception 'Expected 40 orders for service_role, got %', v_count;
  end if;

  reset role;

  select count(*) into v_count
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  cross join (values ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'), ('TRUNCATE'), ('REFERENCES'), ('TRIGGER')) as p(priv)
  where n.nspname = 'public'
    and c.relkind in ('r', 'p')
    and (
      has_table_privilege('anon', c.oid, p.priv)
      or (p.priv in ('SELECT', 'INSERT', 'UPDATE', 'REFERENCES') and has_any_column_privilege('anon', c.oid, p.priv))
    );
  if v_count > 0 then
    raise exception 'anon has unexpected table or column privileges (count=%)', v_count;
  end if;

  select count(*) into v_count
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  cross join (values ('USAGE'), ('SELECT'), ('UPDATE')) as p(priv)
  where n.nspname = 'public'
    and c.relkind = 'S'
    and (
      has_sequence_privilege('anon', c.oid, p.priv)
      or has_sequence_privilege('authenticated', c.oid, p.priv)
    );
  if v_count > 0 then
    raise exception 'anon or authenticated has unexpected sequence privileges (count=%)', v_count;
  end if;

  select count(*) into v_count
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  cross join (values ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'), ('TRUNCATE'), ('REFERENCES'), ('TRIGGER')) as p(priv)
  where n.nspname = 'public'
    and c.relkind in ('r', 'p')
    and has_table_privilege('authenticated', c.oid, p.priv) <> (
      p.priv = 'SELECT'
      or (p.priv = 'UPDATE' and c.relname in ('orders', 'order_lines'))
      or (p.priv = 'INSERT' and c.relname in ('messages', 'order_lines', 'order_messages'))
    );
  if v_count > 0 then
    raise exception 'authenticated table privileges mismatch (count=%)', v_count;
  end if;

  select count(*) into v_count
  from orders
  where status = 'expired'
    and (expires_at is null or expires_at - created_at <> interval '24 hours');
  if v_count > 0 then
    raise exception 'expired orders must have expires_at - created_at = 24 hours (count=%)', v_count;
  end if;

  select count(*) into v_count
  from orders o
  where o.status = 'needs_review'
    and not exists (
      select 1
      from order_messages om_c
      join messages m_c on m_c.id = om_c.message_id
      where om_c.order_id = o.id
        and m_c.direction = 'in'
        and m_c.author = 'customer'
        and m_c.kind = 'button'
        and m_c.body = 'confirm'
        and m_c.created_at < (
          select max(m_b.created_at)
          from order_messages om_b
          join messages m_b on m_b.id = om_b.message_id
          where om_b.order_id = o.id
            and m_b.direction = 'out'
            and m_b.author = 'bot'
        )
    );
  if v_count > 0 then
    raise exception 'needs_review order missing customer confirm button before last bot message (count=%)', v_count;
  end if;

  select count(*) into v_count
  from orders o
  join customers c on c.id = o.customer_id
  where o.source in ('pdf', 'xlsx', 'xls')
    and (c.kind <> 'hotel' or o.po_number is null or length(trim(o.po_number)) = 0);
  if v_count > 0 then
    raise exception 'pdf/xlsx/xls order must belong to a hotel with po_number (count=%)', v_count;
  end if;

  if (select count(*) from orders where source = 'pdf') < 6
     or (select count(*) from orders where source = 'xlsx') < 3
     or (select count(*) from orders where source = 'xls') < 1
     or (select count(*) from orders where source = 'photo') < 1 then
    raise exception 'orders source counts below required minimums';
  end if;

  select count(*) into v_count
  from orders
  where confirmed_at is not null
    and updated_at < confirmed_at;
  if v_count > 0 then
    raise exception 'orders with confirmed_at must have updated_at >= confirmed_at (count=%)', v_count;
  end if;

  select count(*) into v_count
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'products'
    and column_name = 'stock_qty'
    and data_type = 'numeric'
    and numeric_precision = 10
    and numeric_scale = 2
    and is_nullable = 'NO';
  if v_count <> 1 then
    raise exception 'products.stock_qty column missing or wrong type (count=%)', v_count;
  end if;

  select count(*) into v_count from products where stock_qty <= 0;
  if v_count > 0 then
    raise exception 'Expected all products to have stock_qty > 0 after stock seed (count=%)', v_count;
  end if;

  select stock_qty into v_stock from products where sku = 'DRY-EGG-30';
  if v_stock is distinct from 5.00 then
    raise exception 'Expected DRY-EGG-30 stock_qty = 5.00, got %', v_stock;
  end if;

  begin
    update products set stock_qty = -1 where sku = 'DRY-EGG-30';
    raise exception 'Expected check_violation when setting negative stock_qty';
  exception
    when check_violation then
      null;
  end;

  begin
    update products set stock_qty = 'NaN'::numeric where sku = 'DRY-EGG-30';
    raise exception 'Expected check_violation when setting NaN stock_qty';
  exception
    when check_violation then
      null;
  end;

  begin
    update products set stock_qty = 'Infinity'::numeric where sku = 'DRY-EGG-30';
    raise exception 'Expected numeric overflow or check_violation when setting Infinity stock_qty';
  exception
    when check_violation or numeric_value_out_of_range then
      null;
  end;

  begin
    update products set stock_qty = '-Infinity'::numeric where sku = 'DRY-EGG-30';
    raise exception 'Expected numeric overflow or check_violation when setting -Infinity stock_qty';
  exception
    when check_violation or numeric_value_out_of_range then
      null;
  end;

  if not has_column_privilege('authenticated', 'products', 'stock_qty', 'UPDATE') then
    raise exception 'authenticated missing UPDATE column privilege on products.stock_qty';
  end if;

  select count(*) into v_count
  from unnest(array['sku', 'name', 'category', 'unit_code', 'list_price', 'aliases', 'active']) as cols(col)
  where has_column_privilege('authenticated', 'products', cols.col, 'UPDATE');
  if v_count > 0 then
    raise exception 'authenticated has unexpected UPDATE column privilege on products (count=%)', v_count;
  end if;

  if has_column_privilege('anon', 'products', 'stock_qty', 'UPDATE') then
    raise exception 'anon unexpectedly has UPDATE privilege on products.stock_qty';
  end if;

  begin
    insert into orders (customer_id, conversation_id, status, source, total)
    values ('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'draft', 'text', 0.00)
    returning id into v_other_order_id;

    set local role authenticated;

    update products
      set stock_qty = stock_qty - 1
      where sku = 'DRY-OAT-1L' and stock_qty >= 1;
    get diagnostics v_count = row_count;
    if v_count <> 1 then
      raise exception 'Expected authenticated stock_qty update to affect 1 row, got %', v_count;
    end if;

    update products set stock_qty = 0 where sku = 'DRY-OAT-1L';
    get diagnostics v_count = row_count;
    if v_count <> 1 then
      raise exception 'Expected authenticated stock_qty = 0 boundary to succeed, got %', v_count;
    end if;

    begin
      update products set list_price = 1.00 where sku = 'DRY-OAT-1L';
      raise exception 'Expected insufficient_privilege when authenticated updates products.list_price';
    exception
      when insufficient_privilege then
        null;
    end;

    begin
      update products set stock_qty = -1 where sku = 'DRY-OAT-1L';
      raise exception 'Expected negative stock_qty update by authenticated to fail';
    exception
      when check_violation or insufficient_privilege then
        null;
    end;

    begin
      update products set stock_qty = 'NaN'::numeric where sku = 'DRY-OAT-1L';
      raise exception 'Expected NaN stock_qty update by authenticated to fail';
    exception
      when check_violation or insufficient_privilege then
        null;
    end;

    begin
      update products set stock_qty = 'Infinity'::numeric where sku = 'DRY-OAT-1L';
      raise exception 'Expected Infinity stock_qty update by authenticated to fail';
    exception
      when check_violation or insufficient_privilege or numeric_value_out_of_range then
        null;
    end;

    begin
      delete from products where sku = 'DRY-OAT-1L';
      raise exception 'Expected insufficient_privilege when authenticated deletes from products';
    exception
      when insufficient_privilege then
        null;
    end;

    begin
      delete from orders where id = '30000000-0000-4000-8000-000000000001';
      raise exception 'Expected insufficient_privilege when authenticated deletes from orders';
    exception
      when insufficient_privilege then
        null;
    end;

    insert into messages (conversation_id, direction, author, kind, body)
    values ('20000000-0000-4000-8000-000000000001', 'out', 'staff', 'text', 'Test approval message')
    returning id into v_msg_id;

    insert into order_messages (order_id, message_id)
    values ('30000000-0000-4000-8000-000000000001', v_msg_id);
    get diagnostics v_count = row_count;
    if v_count <> 1 then
      raise exception 'Expected same-conversation order_messages insert to affect 1 row, got %', v_count;
    end if;

    begin
      insert into order_messages (order_id, message_id)
      values ('30000000-0000-4000-8000-000000000002', v_msg_id);
      raise exception 'Expected insufficient_privilege for cross-conversation order_messages insert';
    exception
      when insufficient_privilege then
        null;
    end;

    begin
      insert into order_messages (order_id, message_id)
      select '30000000-0000-4000-8000-000000000001', m.id
      from messages m
      where m.conversation_id = '20000000-0000-4000-8000-000000000001'
        and m.author = 'customer'
      limit 1;
      raise exception 'Expected insufficient_privilege when authenticated links non-staff message';
    exception
      when insufficient_privilege then
        null;
    end;

    begin
      insert into order_messages (order_id, message_id)
      values (v_other_order_id, v_msg_id);
      raise exception 'Expected insufficient_privilege when re-linking an already-linked message to another order in the same chat';
    exception
      when insufficient_privilege then
        null;
    end;

    raise exception using errcode = 'P9999', message = 'rollback step 0 test writes';
  exception
    when sqlstate 'P9999' then
      null;
  end;
  reset role;

  select count(*) into v_count
  from unnest(array['status', 'reviewed_at', 'reviewed_by']) as cols(col)
  where not has_column_privilege('authenticated', 'screening_log', cols.col, 'UPDATE');
  if v_count > 0 then
    raise exception 'authenticated missing UPDATE column privilege on screening_log (count=%)', v_count;
  end if;

  select count(*) into v_count
  from unnest(array['telegram_user_id', 'decision', 'reason', 'latency_ms', 'message_id', 'conversation_id']) as cols(col)
  where has_column_privilege('authenticated', 'screening_log', cols.col, 'UPDATE');
  if v_count > 0 then
    raise exception 'authenticated has unexpected UPDATE column privilege on screening_log (count=%)', v_count;
  end if;

  if has_any_column_privilege('anon', 'screening_log', 'UPDATE') then
    raise exception 'anon unexpectedly has UPDATE column privilege on screening_log';
  end if;

  begin
    insert into screening_log (telegram_user_id, decision, reason, latency_ms)
    values (999001, 'spam', 'test spam 1', 10)
    returning id into v_flag_1;

    insert into screening_log (telegram_user_id, decision, reason, latency_ms)
    values (999002, 'abuse', 'test abuse 2', 12)
    returning id into v_flag_2;

    insert into screening_log (telegram_user_id, decision, reason, latency_ms)
    values (999003, 'injection', 'test injection 3', 15)
    returning id into v_flag_3;

    set local role authenticated;

    v_flag_result := review_flag(v_flag_1, 'release');
    if v_flag_result <> 'released' then
      raise exception 'Expected review_flag release to return released, got %', v_flag_result;
    end if;

    select status, reviewed_at into v_flag_status, v_flag_reviewed_at
    from screening_log
    where id = v_flag_1;
    if v_flag_status <> 'released' or v_flag_reviewed_at is null then
      raise exception 'Expected screening_log status=released and reviewed_at not null, got status=% reviewed_at=%', v_flag_status, v_flag_reviewed_at;
    end if;

    v_flag_result := review_flag(v_flag_1, 'release');
    if v_flag_result <> 'handled' then
      raise exception 'Expected second review_flag call to return handled, got %', v_flag_result;
    end if;

    v_flag_result := review_flag(v_flag_2, 'dismiss');
    if v_flag_result <> 'dismissed' then
      raise exception 'Expected review_flag dismiss to return dismissed, got %', v_flag_result;
    end if;

    select status into v_flag_status
    from screening_log
    where id = v_flag_2;
    if v_flag_status <> 'dismissed' then
      raise exception 'Expected screening_log status=dismissed, got %', v_flag_status;
    end if;

    begin
      perform review_flag(v_flag_3, 'invalid');
      raise exception 'Expected invalid_parameter_value for invalid review_flag decision';
    exception
      when invalid_parameter_value then
        null;
    end;

    begin
      update screening_log set decision = 'allow' where id = v_flag_3;
      raise exception 'Expected insufficient_privilege when authenticated updates screening_log.decision';
    exception
      when insufficient_privilege then
        null;
    end;

    set local role anon;

    begin
      perform review_flag(v_flag_3, 'release');
      raise exception 'Expected insufficient_privilege when anon calls review_flag';
    exception
      when insufficient_privilege then
        null;
    end;

    raise exception using errcode = 'P9999', message = 'rollback flagged messages test writes';
  exception
    when sqlstate 'P9999' then
      null;
  end;
  reset role;
end
$$;
