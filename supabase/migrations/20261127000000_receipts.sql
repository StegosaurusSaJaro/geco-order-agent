alter table orders add column receipt_sent_at timestamptz;
update orders set receipt_sent_at = now() where status in ('confirmed', 'fulfilled');
