begin;

create table public.gapmark_reports (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('issued', 'reviewed')),
  service text not null check (char_length(service) between 1 and 80),
  commitment text not null check (commitment ~ '^[0-9]{1,77}$'),
  verdict text not null check (verdict in ('PASS', 'BREACH', 'INSUFFICIENT')),
  window_start timestamptz not null,
  bundle jsonb not null check (jsonb_typeof(bundle) = 'object' and octet_length(bundle::text) <= 32000),
  created_at timestamptz not null default now(),
  unique (id, owner_id, kind),
  unique (owner_id, kind, commitment)
);

create table public.gapmark_report_shares (
  report_id uuid not null,
  issuer_id uuid not null,
  issuer_kind text not null default 'issued' check (issuer_kind = 'issued'),
  recipient_email text not null check (
    recipient_email = lower(btrim(recipient_email)) and
    char_length(recipient_email) between 3 and 254 and
    recipient_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  ),
  created_at timestamptz not null default now(),
  primary key (report_id, recipient_email),
  foreign key (report_id, issuer_id, issuer_kind) references public.gapmark_reports(id, owner_id, kind) on delete cascade
);

create index gapmark_reports_recent on public.gapmark_reports (owner_id, created_at desc);
create index gapmark_shares_inbox on public.gapmark_report_shares (recipient_email, report_id);
create index gapmark_shares_issuer on public.gapmark_report_shares (issuer_id, report_id);

alter table public.gapmark_reports enable row level security;
alter table public.gapmark_report_shares enable row level security;

revoke all on public.gapmark_reports, public.gapmark_report_shares from public, anon, authenticated;
grant select, insert, delete on public.gapmark_reports, public.gapmark_report_shares to authenticated;

create policy "Read own reports and reports shared to your email"
  on public.gapmark_reports for select to authenticated using (
    owner_id = (select auth.uid()) or exists (
      select 1 from public.gapmark_report_shares as access
      where access.report_id = gapmark_reports.id
        and access.recipient_email = lower((select auth.jwt() ->> 'email'))
    )
  );
create policy "Save your own reports"
  on public.gapmark_reports for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "Delete your own reports"
  on public.gapmark_reports for delete to authenticated using (owner_id = (select auth.uid()));

create policy "Read your own grants and inbox entries"
  on public.gapmark_report_shares for select to authenticated using (
    issuer_id = (select auth.uid()) or recipient_email = lower((select auth.jwt() ->> 'email'))
  );
create policy "Grant access to your own reports"
  on public.gapmark_report_shares for insert to authenticated with check (issuer_id = (select auth.uid()));
create policy "Revoke access to your own reports"
  on public.gapmark_report_shares for delete to authenticated using (issuer_id = (select auth.uid()));

commit;
