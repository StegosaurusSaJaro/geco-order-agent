alter table public.screening_log
  add column message_id uuid references messages(id),
  add column conversation_id uuid references conversations(id),
  add column status text not null default 'held' check (status in ('held', 'released', 'dismissed', 'processed')),
  add column reviewed_at timestamptz,
  add column reviewed_by uuid;

create or replace function public.review_flag(p_id bigint, p_decision text)
returns text
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_next_status text;
begin
  if p_decision is null or p_decision not in ('release', 'dismiss') then
    raise exception using errcode = '22023', message = 'invalid review decision';
  end if;

  perform 1
  from screening_log
  where id = p_id and status = 'held'
  for update;

  if not found then
    return 'handled';
  end if;

  v_next_status := case when p_decision = 'release' then 'released' else 'dismissed' end;

  update screening_log
  set status = v_next_status,
      reviewed_at = now(),
      reviewed_by = auth.uid()
  where id = p_id and status = 'held';

  return v_next_status;
end;
$$;

grant update (status, reviewed_at, reviewed_by) on public.screening_log to authenticated;

create policy authenticated_update_screening_log
  on public.screening_log
  for update
  to authenticated
  using (status = 'held')
  with check (status in ('released', 'dismissed'));

revoke all on function public.review_flag(bigint, text) from public;
revoke all on function public.review_flag(bigint, text) from anon;
grant execute on function public.review_flag(bigint, text) to authenticated;

alter publication supabase_realtime add table public.screening_log;
