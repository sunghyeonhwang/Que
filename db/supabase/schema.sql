-- Que — Supabase(Postgres) 스키마
-- 기준: packages/core/src/domain.ts (zod 스키마가 source of truth)
-- 적용: Supabase Dashboard > SQL Editor 또는 `supabase db push`
-- 참고: 서버(Next.js API)가 service_role 키로만 접근하는 전제라 RLS는 사용하지 않는다.
--       클라이언트 직접 접근을 열게 되면 그때 RLS를 설계한다 (docs/deploy-vercel-supabase.md).
-- 주의: projects.name / milestones.title / calendar_events.title / tasks.description 의
--       길이 check는 현재 core에 대응하는 생성 mutation이 없어 코드 검증이 없다 —
--       해당 mutation을 추가할 때 core 상한(절단 또는 거부)을 함께 구현할 것.
--       (action_items.title / tasks.title 은 core에서 200자 절단으로 보장됨)

create table if not exists users (
  id          text primary key,
  name        text not null,
  role        text not null check (role in ('admin', 'member')),
  avatar_color text not null,
  created_at  timestamptz not null default now()
);

create table if not exists projects (
  id         text primary key,
  name       text not null check (char_length(name) <= 200),
  owner_id   text not null references users(id),
  status     text not null check (status in ('active', 'archived')),
  created_at timestamptz not null default now()
);

create table if not exists milestones (
  id              text primary key,
  project_id      text not null references projects(id),
  title           text not null check (char_length(title) <= 200),
  due_at          timestamptz not null,
  risk_status     text not null check (risk_status in ('on_track', 'at_risk', 'late')),
  last_changed_by text references users(id),
  last_changed_at timestamptz
);

create table if not exists tasks (
  id                  text primary key,
  title               text not null check (char_length(title) <= 200),
  owner_id            text not null references users(id),
  assignee_id         text not null references users(id),
  project_id          text references projects(id),
  start_at            timestamptz,
  end_at              timestamptz,
  status              text not null check (status in
    ('scheduled','in_progress','done','needs_reschedule','on_hold','issue','cancelled','merged')),
  priority            text not null default 'normal' check (priority in ('low','normal','high')),
  description         text check (char_length(description) <= 2000),
  estimated_hours     numeric check (estimated_hours > 0),
  source              text not null check (source in ('manual','natural_language','action_item')),
  visibility          text not null default 'team' check (visibility in ('team','private')),
  merged_into_task_id text,
  last_changed_by     text references users(id),
  last_changed_at     timestamptz,
  created_at          timestamptz not null default now()
);

create table if not exists calendar_events (
  id                   text primary key,
  source               text not null check (source in ('company','que')),
  title                text not null check (char_length(title) <= 200),
  owner_id             text not null references users(id),
  start_at             timestamptz not null,
  end_at               timestamptz not null,
  attendee_ids         text[] not null default '{}',
  visibility           text not null default 'team' check (visibility in ('team','private')),
  external_calendar_id text,
  last_changed_by      text references users(id),
  last_changed_at      timestamptz,
  check (start_at <= end_at)
);

create table if not exists meeting_notes (
  id                text primary key,
  title             text not null check (char_length(title) <= 200),
  project_id        text references projects(id),
  meeting_at        timestamptz not null,
  attendee_ids      text[] not null default '{}',
  uploader_id       text not null references users(id),
  file_name         text not null check (char_length(file_name) <= 200),
  markdown_body     text not null check (char_length(markdown_body) <= 500000),
  visibility        text not null default 'team' check (visibility in ('team','project','admin')),
  extraction_status text not null check (extraction_status in ('pending','done')),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create table if not exists action_items (
  id              text primary key,
  meeting_note_id text not null references meeting_notes(id),
  source_text     text not null,
  title           text not null check (char_length(title) <= 200),
  assignee_id     text references users(id),
  due_at          timestamptz,
  project_id      text references projects(id),
  status          text not null check (status in ('needs_review','candidate','created','held','ignored')),
  created_task_id text references tasks(id),
  confidence      numeric check (confidence between 0 and 1),
  last_changed_by text references users(id),
  last_changed_at timestamptz,
  created_at      timestamptz not null default now()
);

create table if not exists payment_requests (
  id              text primary key,
  title           text not null check (char_length(title) <= 200),
  requester_id    text not null references users(id),
  bank_name       text not null check (char_length(bank_name) <= 50),
  account_number  text not null check (char_length(account_number) <= 50),
  amount          numeric not null check (amount > 0 and amount <= 1000000000000),
  description     text check (char_length(description) <= 2000),
  due_at          timestamptz,
  category        text not null check (char_length(category) <= 50),
  status          text not null check (status in ('waiting','done','cancelled')),
  last_changed_by text references users(id),
  last_changed_at timestamptz,
  created_at      timestamptz not null default now()
);

create table if not exists status_logs (
  id            text primary key,
  task_id       text not null references tasks(id),
  actor_id      text not null references users(id),
  from_status   text not null,
  to_status     text not null,
  reason        text check (char_length(reason) <= 500),
  next_action   text check (char_length(next_action) <= 500),
  help_user_id  text references users(id),
  next_check_at timestamptz,
  created_at    timestamptz not null default now()
);

create table if not exists change_logs (
  id           text primary key,
  entity_type  text not null check (entity_type in
    ('task','calendar_event','milestone','action_item','payment_request','meeting_note')),
  entity_id    text not null,
  actor_id     text not null references users(id),
  change_type  text not null check (change_type in ('create','update','move','status_change','delete')),
  before_value text,
  after_value  text,
  reason       text,
  via          text not null check (via in ('web','mcp','cli')),
  visible_to   text[],
  created_at   timestamptz not null default now()
);

create table if not exists task_comments (
  id           text primary key,
  task_id      text not null references tasks(id),
  author_id    text not null references users(id),
  body         text not null check (char_length(body) <= 1000),
  help_user_id text references users(id),
  created_at   timestamptz not null default now()
);

create table if not exists check_ins (
  id                 text primary key,
  task_id            text not null references tasks(id),
  assignee_id        text not null references users(id),
  scheduled_at       timestamptz not null,
  answered_at        timestamptz,
  response           text check (response in
    ('working','done','needs_reschedule','issue','not_needed','merged','later')),
  follow_up_required boolean not null default false
);

-- 실 인증 전환 시 사용할 PAT 테이블 (mock 단계에서는 미사용 — 코드의 결정적 토큰 사용)
create table if not exists personal_access_tokens (
  token_hash text primary key,       -- 원본 토큰은 저장하지 않는다 (sha256 등 해시만)
  user_id    text not null references users(id),
  label      text,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

-- 조회 패턴 기반 인덱스
create index if not exists idx_tasks_assignee_start on tasks (assignee_id, start_at);
create index if not exists idx_tasks_project on tasks (project_id);
create index if not exists idx_tasks_status on tasks (status);
create index if not exists idx_events_start on calendar_events (start_at);
create index if not exists idx_action_items_note on action_items (meeting_note_id);
create index if not exists idx_status_logs_task on status_logs (task_id, created_at desc);
create index if not exists idx_change_logs_created on change_logs (created_at desc);
create index if not exists idx_check_ins_assignee on check_ins (assignee_id, answered_at);
create index if not exists idx_task_comments_task on task_comments (task_id, created_at);
create index if not exists idx_task_comments_help on task_comments (help_user_id, created_at desc);
