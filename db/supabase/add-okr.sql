-- OKR(분기 목표 + 월 핵심결과, 기획 §2·§6·§8-3) — 신규 테이블 2 + tasks.key_result_id + change_logs entity_type.
-- additive 마이그레이션. 재적용 안전(if not exists) — schema.sql과 정합.
-- ⚠️ 적용 금지(파일만) — 메인에서 Supabase에 apply_migration으로 적용한다.
--
-- 목표 데이터는 감사 대상이라 생성·진척 변경을 change_logs에 남긴다(운영 리듬 산출물인 standup과 다르다).
-- 형식 검증(period=YYYY-Qn, month=YYYY-MM)과 manual targetValue 필수는 앱(zod)에서 강제한다 — DB는 enum/FK만.

-- 분기 목표(회사 레벨 단일 계층). period 형식(YYYY-Qn)은 앱 검증.
create table if not exists objectives (
  id          text primary key,
  title       text not null check (char_length(title) <= 200),
  description text check (char_length(description) <= 2000),
  period      text not null,                       -- 예: 2026-Q3 (형식은 앱 검증)
  owner_id    text not null references users(id),
  status      text not null default 'active'
                check (status in ('draft', 'active', 'done', 'cancelled')),
  "order"     integer not null default 0,          -- 표시 정렬(작을수록 먼저)
  created_at  timestamptz not null default now()
);
create index if not exists idx_objectives_period on objectives (period);

-- 월 핵심결과(개인 담당). month 형식(YYYY-MM)·manual targetValue 필수는 앱 검증.
create table if not exists key_results (
  id            text primary key,
  objective_id  text not null references objectives(id),
  title         text not null check (char_length(title) <= 200),
  owner_id      text not null references users(id),
  month         text not null,                     -- 예: 2026-07 (형식은 앱 검증)
  metric_type   text not null check (metric_type in ('manual', 'task_auto')),
  target_value  numeric,                            -- manual 측정용(양수, 앱 검증)
  current_value numeric,                            -- manual 측정용
  unit          text check (char_length(unit) <= 20),
  status        text not null default 'active'
                  check (status in ('active', 'done', 'cancelled')),
  updated_at    timestamptz not null,
  updated_by    text not null references users(id)
);
create index if not exists idx_key_results_objective on key_results (objective_id);

-- Task ↔ KR 연결(단일, optional). 취소 시에도 이력이라 on delete는 걸지 않는다(앱이 해제 관리).
alter table tasks
  add column if not exists key_result_id text references key_results(id);
create index if not exists idx_tasks_key_result on tasks (key_result_id);

-- change_logs entity_type에 목표 데이터(objective·key_result) 추가.
-- 기존 체크 제약을 갈아끼운다(재적용 안전: drop if exists → add).
alter table change_logs drop constraint if exists change_logs_entity_type_check;
alter table change_logs add constraint change_logs_entity_type_check
  check (entity_type in
    ('task','calendar_event','milestone','action_item','payment_request','payment_category',
     'meeting_note','recurring_template','project','client','user','objective','key_result'));
