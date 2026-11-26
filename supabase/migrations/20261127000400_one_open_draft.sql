with ranked as (
  select
    id,
    row_number() over (
      partition by customer_id, conversation_id
      order by created_at desc, id desc
    ) as rn
  from orders
  where status = 'draft'
)
update orders o
set status = 'cancelled', updated_at = now()
from ranked r
where o.id = r.id and r.rn > 1;

create unique index orders_one_open_draft
  on orders (customer_id, conversation_id)
  where status = 'draft';
