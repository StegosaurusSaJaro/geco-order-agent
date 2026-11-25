grant insert on order_messages to authenticated;

create policy authenticated_insert_order_messages
  on order_messages
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from orders o
      join messages m on m.conversation_id = o.conversation_id
      where o.id = order_messages.order_id
        and m.id = order_messages.message_id
        and m.author = 'staff'
        and m.direction = 'out'
    )
    and not exists (
      select 1
      from order_messages om
      where om.message_id = order_messages.message_id
    )
  );
