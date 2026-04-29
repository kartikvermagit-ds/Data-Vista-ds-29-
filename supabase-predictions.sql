create table if not exists public.student_predictions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid,
  student_id text not null,
  student_name text,
  predicted_grade text not null check (predicted_grade in ('A', 'B', 'C')),
  risk_label text not null check (risk_label in ('At Risk', 'Safe')),
  confidence numeric(5, 4) not null check (confidence >= 0 and confidence <= 1),
  trend text not null check (trend in ('Rising', 'Falling', 'Stable')),
  feature_importance jsonb not null default '{}'::jsonb,
  source_model text not null default 'random_forest_v1',
  created_at timestamptz not null default now()
);

create index if not exists student_predictions_student_id_idx
  on public.student_predictions (student_id, created_at desc);

alter table public.student_predictions enable row level security;

create policy "Teachers can read their own prediction results"
  on public.student_predictions
  for select
  using (auth.uid() = owner_id);

create policy "Teachers can insert their own prediction results"
  on public.student_predictions
  for insert
  with check (auth.uid() = owner_id);
