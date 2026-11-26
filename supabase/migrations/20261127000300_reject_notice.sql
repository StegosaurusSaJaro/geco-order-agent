alter table orders
  add column rejected_by_staff_at timestamptz,
  add column reject_notice_sent_at timestamptz;

create or replace function public.review_order(p_order_id uuid, p_decision text)
returns text
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_needed bigint;
  v_deducted bigint;
begin
  if p_decision not in ('approve', 'reject') then
    raise exception using errcode = '22023', message = 'invalid review decision';
  end if;

  perform 1
  from orders
  where id = p_order_id and status = 'needs_review'
  for update;

  if not found then
    return 'handled';
  end if;

  if p_decision = 'reject' then
    update orders
    set status = 'cancelled', rejected_by_staff_at = now(), updated_at = now()
    where id = p_order_id and status = 'needs_review';
    return 'rejected';
  end if;

  begin
    select count(distinct sku) into v_needed
    from order_lines
    where order_id = p_order_id and version = 1;

    update products p
    set stock_qty = p.stock_qty - l.qty
    from (
      select sku, sum(quantity) as qty
      from order_lines
      where order_id = p_order_id and version = 1
      group by sku
    ) l
    where p.sku = l.sku and p.stock_qty >= l.qty;

    get diagnostics v_deducted = row_count;
    if v_deducted < v_needed then
      raise exception using errcode = 'P0001', message = 'short';
    end if;

    update orders
    set status = 'confirmed', confirmed_at = now(), updated_at = now()
    where id = p_order_id and status = 'needs_review';
  exception
    when sqlstate 'P0001' then
      return 'short';
  end;

  return 'approved';
end;
$$;

revoke all on function public.review_order(uuid, text) from public;
revoke all on function public.review_order(uuid, text) from anon;
grant execute on function public.review_order(uuid, text) to authenticated;
