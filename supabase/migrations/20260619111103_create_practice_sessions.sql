-- S-03: first application table — persist completed practice sessions.
-- Queryable score/metadata columns for the history list + a JSONB payload
-- ({ questions, answers }) for revisit. Sessions are immutable (no UPDATE policy).

create table public.practice_sessions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  provider    text not null,
  exam        text not null,
  correct     integer not null,
  total       integer not null,
  percentage  integer not null,
  payload     jsonb not null, -- { questions: Question[], answers: AnswerRecord[] }
  created_at  timestamptz not null default now()
);

-- History list reads the newest sessions for one user.
create index practice_sessions_user_created_idx
  on public.practice_sessions (user_id, created_at desc);

alter table public.practice_sessions enable row level security;

-- Granular, per-operation, owner-scoped policies (no UPDATE: sessions are immutable).
create policy "own_sessions_select" on public.practice_sessions
  for select to authenticated using (auth.uid() = user_id);

create policy "own_sessions_insert" on public.practice_sessions
  for insert to authenticated with check (auth.uid() = user_id);

create policy "own_sessions_delete" on public.practice_sessions
  for delete to authenticated using (auth.uid() = user_id);
