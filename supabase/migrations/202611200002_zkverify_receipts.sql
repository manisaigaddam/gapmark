begin;

alter table public.gapmark_reports add column zkverify_receipt jsonb
  check (zkverify_receipt is null or (
    jsonb_typeof(zkverify_receipt) = 'object' and octet_length(zkverify_receipt::text) <= 4000
  ));

grant update (zkverify_receipt) on public.gapmark_reports to authenticated;

create policy "Attach a receipt to your own report"
  on public.gapmark_reports for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

commit;
