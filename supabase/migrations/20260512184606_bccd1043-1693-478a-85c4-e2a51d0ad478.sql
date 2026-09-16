
-- ============ meetings ============
create table if not exists public.meetings (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references auth.users(id) on delete cascade,
  source text not null check (source in ('studio','dm','profile','event','adhoc','circle')),
  project_id uuid null,
  conversation_id uuid null,
  event_id uuid null,
  circle_id uuid null,
  profile_booking_id uuid null,
  title text null,
  room_name text not null unique,
  room_url text not null,
  share_token text not null unique default replace(gen_random_uuid()::text,'-',''),
  scheduled_for timestamptz null,
  started_at timestamptz null,
  ended_at timestamptz null,
  max_participants int not null default 25,
  recording_enabled boolean not null default true,
  transcript_enabled boolean not null default true,
  knocking_enabled boolean not null default true,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists meetings_host_idx on public.meetings(host_id);
create index if not exists meetings_project_idx on public.meetings(project_id);
create index if not exists meetings_event_idx on public.meetings(event_id);
create index if not exists meetings_scheduled_idx on public.meetings(scheduled_for);

alter table public.meetings enable row level security;

-- ============ meeting_participants ============
create table if not exists public.meeting_participants (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  user_id uuid null references auth.users(id) on delete cascade,
  guest_token text null,
  guest_name text null,
  role text not null default 'attendee' check (role in ('host','cohost','attendee','guest')),
  status text not null default 'invited' check (status in ('invited','knocking','joined','left','denied','removed')),
  joined_at timestamptz null,
  left_at timestamptz null,
  created_at timestamptz not null default now(),
  unique (meeting_id, user_id),
  unique (meeting_id, guest_token)
);

create index if not exists meeting_participants_meeting_idx on public.meeting_participants(meeting_id);
create index if not exists meeting_participants_user_idx on public.meeting_participants(user_id);

alter table public.meeting_participants enable row level security;

-- ============ meeting_recordings ============
create table if not exists public.meeting_recordings (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  daily_recording_id text null unique,
  storage_path text null,
  duration_seconds int null,
  size_bytes bigint null,
  status text not null default 'processing' check (status in ('processing','ready','failed')),
  created_at timestamptz not null default now()
);

create index if not exists meeting_recordings_meeting_idx on public.meeting_recordings(meeting_id);
alter table public.meeting_recordings enable row level security;

-- ============ meeting_transcripts ============
create table if not exists public.meeting_transcripts (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  daily_transcript_id text null unique,
  segments jsonb null,
  full_text text null,
  status text not null default 'processing' check (status in ('processing','ready','failed')),
  created_at timestamptz not null default now()
);

create index if not exists meeting_transcripts_meeting_idx on public.meeting_transcripts(meeting_id);
alter table public.meeting_transcripts enable row level security;

-- ============ helpers ============
create or replace function public.is_meeting_member(_meeting_id uuid, _user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.meetings m where m.id = _meeting_id and m.host_id = _user_id
  ) or exists (
    select 1 from public.meeting_participants p
    where p.meeting_id = _meeting_id and p.user_id = _user_id
  );
$$;

create or replace function public.is_meeting_host(_meeting_id uuid, _user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.meetings where id = _meeting_id and host_id = _user_id);
$$;

-- ============ RLS: meetings ============
drop policy if exists "Hosts manage their meetings" on public.meetings;
create policy "Hosts manage their meetings" on public.meetings
  for all to authenticated using (host_id = auth.uid()) with check (host_id = auth.uid());

drop policy if exists "Members can view meetings" on public.meetings;
create policy "Members can view meetings" on public.meetings
  for select to authenticated using (public.is_meeting_member(id, auth.uid()));

-- ============ RLS: meeting_participants ============
drop policy if exists "Hosts manage participants" on public.meeting_participants;
create policy "Hosts manage participants" on public.meeting_participants
  for all to authenticated
  using (public.is_meeting_host(meeting_id, auth.uid()))
  with check (public.is_meeting_host(meeting_id, auth.uid()));

drop policy if exists "Members view participants" on public.meeting_participants;
create policy "Members view participants" on public.meeting_participants
  for select to authenticated
  using (public.is_meeting_member(meeting_id, auth.uid()));

drop policy if exists "User updates own participant row" on public.meeting_participants;
create policy "User updates own participant row" on public.meeting_participants
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ============ RLS: recordings + transcripts ============
drop policy if exists "Members view recordings" on public.meeting_recordings;
create policy "Members view recordings" on public.meeting_recordings
  for select to authenticated using (public.is_meeting_member(meeting_id, auth.uid()));

drop policy if exists "Hosts manage recordings" on public.meeting_recordings;
create policy "Hosts manage recordings" on public.meeting_recordings
  for all to authenticated
  using (public.is_meeting_host(meeting_id, auth.uid()))
  with check (public.is_meeting_host(meeting_id, auth.uid()));

drop policy if exists "Members view transcripts" on public.meeting_transcripts;
create policy "Members view transcripts" on public.meeting_transcripts
  for select to authenticated using (public.is_meeting_member(meeting_id, auth.uid()));

drop policy if exists "Hosts manage transcripts" on public.meeting_transcripts;
create policy "Hosts manage transcripts" on public.meeting_transcripts
  for all to authenticated
  using (public.is_meeting_host(meeting_id, auth.uid()))
  with check (public.is_meeting_host(meeting_id, auth.uid()));

-- ============ updated_at trigger ============
create or replace function public.touch_meetings_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists trg_meetings_touch on public.meetings;
create trigger trg_meetings_touch before update on public.meetings
  for each row execute function public.touch_meetings_updated_at();

-- ============ Realtime ============
alter publication supabase_realtime add table public.meeting_participants;
alter publication supabase_realtime add table public.meetings;

-- ============ Storage bucket: meeting-recordings (private) ============
insert into storage.buckets (id, name, public)
values ('meeting-recordings','meeting-recordings', false)
on conflict (id) do nothing;

drop policy if exists "Host reads own meeting recordings" on storage.objects;
create policy "Host reads own meeting recordings" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'meeting-recordings'
    and exists (
      select 1 from public.meetings m
      where m.host_id = auth.uid()
        and (storage.foldername(name))[1] = m.id::text
    )
  );

drop policy if exists "Members read meeting recordings" on storage.objects;
create policy "Members read meeting recordings" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'meeting-recordings'
    and exists (
      select 1 from public.meetings m
      where (storage.foldername(name))[1] = m.id::text
        and public.is_meeting_member(m.id, auth.uid())
    )
  );
