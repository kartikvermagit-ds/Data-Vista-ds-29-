create table if not exists public.teacher_states (
  owner_id uuid primary key references auth.users (id) on delete cascade,
  owner_email text,
  state jsonb not null,
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.teacher_states enable row level security;

drop policy if exists "Users can read own teacher state" on public.teacher_states;
create policy "Users can read own teacher state"
on public.teacher_states
for select
to authenticated
using (auth.uid() = owner_id);

drop policy if exists "Users can insert own teacher state" on public.teacher_states;
create policy "Users can insert own teacher state"
on public.teacher_states
for insert
to authenticated
with check (auth.uid() = owner_id);

drop policy if exists "Users can update own teacher state" on public.teacher_states;
create policy "Users can update own teacher state"
on public.teacher_states
for update
to authenticated
using (auth.uid() = owner_id)
with check (auth.uid() = owner_id);
