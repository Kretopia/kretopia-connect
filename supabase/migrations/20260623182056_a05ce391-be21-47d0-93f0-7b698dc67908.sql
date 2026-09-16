create table if not exists public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  agent_kind text not null,
  trigger text not null,
  input_summary text,
  output_summary text,
  status text not null default 'ok',
  duration_ms integer,
  user_id uuid references auth.users(id) on delete set null,
  project_id uuid,
  created_at timestamptz not null default now()
);

grant select, insert on public.agent_runs to authenticated;
grant select, insert on public.agent_runs to anon;
grant all on public.agent_runs to service_role;

alter table public.agent_runs enable row level security;

create policy "agent_runs public read"
  on public.agent_runs for select
  to anon, authenticated
  using (true);

create policy "agent_runs anyone insert"
  on public.agent_runs for insert
  to anon, authenticated
  with check (true);

create policy "agent_runs service all"
  on public.agent_runs for all
  to service_role
  using (true) with check (true);

create index if not exists agent_runs_recent_idx on public.agent_runs (created_at desc);
create index if not exists agent_runs_kind_idx on public.agent_runs (agent_kind, created_at desc);