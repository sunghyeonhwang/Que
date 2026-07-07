-- Que — Supabase(Postgres) 스키마
-- 기준: packages/core/src/domain.ts (zod 스키마가 source of truth)
-- 적용: Supabase Dashboard > SQL Editor 또는 `supabase db push`
-- 참고: 서버(Next.js API)가 service_role 키로만 접근하는 전제라 RLS는 사용하지 않는다.
--       클라이언트 직접 접근을 열게 되면 그때 RLS를 설계한다 (docs/deploy-vercel-supabase.md).
-- 주의: milestones.title / calendar_events.title / tasks.description 의
--       길이 check는 현재 core에 대응하는 생성 mutation이 없어 코드 검증이 없다 —
--       해당 mutation을 추가할 때 core 상한(절단 또는 거부)을 함께 구현할 것.
--       (action_items.title / tasks.title / projects.name / clients.name 은 core에서 검증/절단으로 보장됨)

create table if not exists users (
  id          text primary key,
  name        text not null,
  role        text not null check (role in ('admin', 'member')),
  avatar_color text not null,
  -- 직원 관리(항목 19): 비활성(deactivate)은 이 플래그로만 한다(hard delete 없음). 로그인·조회 게이트.
  active       boolean not null default true,
  rank         text,          -- 직급(대표/관리/사원) — grade(성과 스코프) 유도 소스. add-user-management.sql로 backfill.
  department   text,          -- 부서(팀 표시용) — 임시 배정값, 편집 가능.
  email        text,          -- 실 로그인 식별자 (Auth.js Credentials)
  slack_user_id text,         -- Slack member ID(개인 DM 브리핑 발송용). email lookup 후 lazy backfill. 도메인 User엔 미노출.
  password_hash text,         -- bcrypt 해시. 서버에서만 읽고 도메인 User/세션 밖으로 내보내지 않는다.
  must_change_password boolean not null default false, -- 참이면 로그인 후 비밀번호 변경 강제(임시 비번)
  password_changed_at  timestamptz,                    -- 마지막 변경 시각
  failed_login_attempts integer not null default 0,    -- 연속 로그인 실패 횟수(브루트포스 방어)
  locked_until timestamptz,                            -- 잠금 해제 시각(초과 실패 시)
  created_at  timestamptz not null default now()
);
-- 이메일 유니크(대소문자 무시). email이 NULL인 계정도 허용.
create unique index if not exists users_email_key on users (lower(email)) where email is not null;

-- 2단 분류의 상위 = 클라이언트(거래처). 최소 필드(id/name/status)만 둔다.
create table if not exists clients (
  id         text primary key,
  name       text not null check (char_length(name) <= 200),
  status     text not null check (status in ('active', 'archived')),
  -- 관리자가 정한 표시 순서(오름차순). 스위처·관리화면·집계 소스가 공유. 기존 DB엔 add-client-sort.sql로 추가.
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists projects (
  id         text primary key,
  name       text not null check (char_length(name) <= 200),
  owner_id   text not null references users(id),
  status     text not null check (status in ('active', 'archived')),
  -- 상위 클라이언트. nullable — 클라이언트 없는 내부 잡무 허용. Task는 project를 통해 간접 참조.
  client_id  text references clients(id),
  -- PM 도구(/projects) 프로젝트 설명. core에서 2000자 상한 검증. (add-project-description.sql)
  description text check (char_length(description) <= 2000),
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
  source              text not null check (source in
    ('manual','natural_language','action_item','recurring_template')),
  visibility          text not null default 'team' check (visibility in ('team','private')),
  merged_into_task_id text,
  recurring_template_id text,
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
  project_ids       text[] default '{}',
  meeting_at        timestamptz not null,
  attendee_ids      text[] not null default '{}',
  uploader_id       text not null references users(id),
  file_name         text not null check (char_length(file_name) <= 200),
  markdown_body     text not null check (char_length(markdown_body) <= 500000),
  visibility        text not null default 'team' check (visibility in ('team','project','admin','restricted')),
  restricted_user_ids text[],
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
  recipient_name  text check (char_length(recipient_name) <= 100),
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

-- 결제 요청 분류(카테고리) — 관리자 관리. clients와 동일 구조. payment_requests.category(text)는
-- FK가 아니라 이 목록에서 고른 이름 문자열(하위호환). 기존 DB엔 add-payment-categories.sql로 추가.
create table if not exists payment_categories (
  id         text primary key,
  name       text not null check (char_length(name) <= 50),
  status     text not null check (status in ('active', 'archived')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
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
  help_user_ids text[],
  next_check_at timestamptz,
  created_at    timestamptz not null default now()
);

create table if not exists change_logs (
  id           text primary key,
  entity_type  text not null check (entity_type in
    ('task','calendar_event','milestone','action_item','payment_request','payment_category','meeting_note','recurring_template','project','client','user')),
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
  follow_up_required boolean not null default false,
  -- '나중에' 응답의 재확인 시각(스누즈). 이 시각까지 pending/응답대기에서 제외되고 이후 자동 재노출.
  -- 상한 48시간은 core mutation(answerCheckIn)이 강제한다.
  snooze_until       timestamptz,
  -- 스케줄러 중복 생성 백스톱(작업당 회차 1개). Cron 단일화로 경합은 없으나 프레시 설치도 보호.
  constraint uq_check_ins_task_scheduled unique (task_id, scheduled_at)
);

create table if not exists recurring_templates (
  id               text primary key,
  title            text not null check (char_length(title) <= 200),
  assignee_id      text not null references users(id),
  project_id       text references projects(id),
  frequency        text not null check (frequency in ('weekly','monthly')),
  day_of_week      smallint check (day_of_week between 0 and 6),
  day_of_month     smallint check (day_of_month between 1 and 28),
  start_time       text not null check (start_time ~ '^\d{2}:\d{2}$'),
  duration_minutes integer not null default 60 check (duration_minutes between 1 and 1440),
  description      text check (char_length(description) <= 2000),
  active           boolean not null default true,
  created_by       text not null references users(id),
  created_at       timestamptz not null default now(),
  last_generated_for date,
  check (frequency <> 'weekly' or day_of_week is not null),
  check (frequency <> 'monthly' or day_of_month is not null)
);

-- 실 인증 전환 시 사용할 PAT 테이블 (mock 단계에서는 미사용 — 코드의 결정적 토큰 사용)
create table if not exists personal_access_tokens (
  token_hash text primary key,       -- 원본 토큰은 저장하지 않는다 (sha256 등 해시만)
  user_id    text not null references users(id),
  label      text,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);
-- 설정 화면 본인 활성 토큰 목록 쿼리용(B-3). 프로덕션 적용됨.
create index if not exists idx_pat_user on personal_access_tokens (user_id) where revoked_at is null;

-- 수정사항(이슈/피드백) 트래커 — 테스트 중 발견한 수정사항 팀 공용 목록. (add-revision-notes.sql)
-- 업무 데이터가 아니라 change_logs에는 남기지 않고 updated_at/updated_by만 추적한다.
create table if not exists revision_notes (
  id          text primary key,
  menu        text not null check (char_length(menu) <= 100),
  location    text check (char_length(location) <= 200),
  description text not null check (char_length(description) <= 2000),
  status      text not null default 'unresolved'
                check (status in ('unresolved', 'hold', 'resolved')),
  author_id   text references users(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz,
  updated_by  text references users(id)
);

-- 알림 아웃박스 — Slack Webhook 발송 원장(B-1 1단계). (add-notifications.sql)
-- dedup_key UNIQUE가 서버리스 중복 발송 방지의 핵심. 발송/드레인은 크론이 처리.
create table if not exists notification_outbox (
  id          text primary key,
  dedup_key   text not null unique,   -- 이벤트 유일키(issue:/on_hold:/deadline:/standup: 접두). 중복 적재 차단.
  kind        text not null check (kind in ('issue', 'on_hold', 'deadline', 'standup', 'personal_digest')),
  entity_type text not null,
  entity_id   text not null,
  recipient   text,                   -- 팀채널 계열(issue/on_hold/deadline/standup)은 NULL. personal_digest는 Que userId(발송 직전 Slack ID 해석).
  payload     jsonb not null,         -- { title, text, deeplinkPath, tone }
  status      text not null default 'pending'
                check (status in ('pending', 'held', 'sent', 'skipped', 'failed')),
  attempts    integer not null default 0 check (attempts >= 0),
  hold_until  timestamptz,            -- 방해금지 보류 해제 시각. NULL이면 즉시 대상.
  created_at  timestamptz not null default now(),
  sent_at     timestamptz
);
create index if not exists idx_notification_outbox_status on notification_outbox (status, created_at);
create index if not exists idx_notification_outbox_hold on notification_outbox (hold_until)
  where status = 'held';

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
create index if not exists idx_recurring_templates_active on recurring_templates (active);
create index if not exists idx_revision_notes_created on revision_notes (created_at desc);
