-- OS-2b 외부 변경 접수(부록 C) — 신규 테이블 change_requests
--   + change_logs.entity_type에 'change_request' 추가
--   + notification_outbox.kind에 SLA 알림 2종(change_remind·change_esc) 추가.
-- additive 마이그레이션. 재적용 안전(if not exists / drop-add). schema.sql과 정합.
-- ✅ 프로덕션 기적용(2026-07-11, apply_migration) — schema.sql과 정합.
--
-- 5단계(순서 강제, 앱): received → impact_analyzed → renegotiated → approved(admin) → closed.
-- impact_deadline = received_at + 24h(SLA 고정). 종결 시 external·managed 회고 자동 생성(앱).
-- stage_log jsonb: [{ stage, at, by }]. 업무 영향 변경이라 change_logs에 기록(entity_type 'change_request').

begin;

create table if not exists change_requests (
  id              text primary key,
  project_id      text not null references projects(id),
  milestone_id    text references milestones(id),
  title           text not null check (char_length(title) <= 200),
  description     text check (char_length(description) <= 2000),
  stage           text not null default 'received'
                    check (stage in ('received', 'impact_analyzed', 'renegotiated', 'approved', 'closed')),
  received_at     timestamptz not null,
  impact_deadline timestamptz not null,             -- received_at + 24h(SLA)
  stage_log       jsonb not null default '[]'::jsonb,
  closed_at       timestamptz
);
create index if not exists idx_change_requests_project on change_requests (project_id);
create index if not exists idx_change_requests_stage on change_requests (stage);

-- change_logs entity_type에 'change_request' 추가(재적용 안전: drop if exists → add).
alter table change_logs drop constraint if exists change_logs_entity_type_check;
alter table change_logs add constraint change_logs_entity_type_check
  check (entity_type in
    ('task','calendar_event','milestone','action_item','payment_request','payment_category',
     'meeting_note','recurring_template','project','client','user','objective','key_result',
     'change_request'));

-- notification_outbox.kind에 외부 변경 SLA 재촉·에스컬레이션 2종 추가.
--   change_remind: impact_deadline 12h 전 재촉 DM.  dedup 'change_remind:<changeRequestId>:<YYYY-MM-DD KST>'.
--   change_esc:    impact_deadline 초과 admin·대표 에스컬레이션 DM. dedup 'change_esc:<changeRequestId>:<YYYY-MM-DD KST>'.
alter table notification_outbox drop constraint if exists notification_outbox_kind_check;
alter table notification_outbox
  add constraint notification_outbox_kind_check
  check (kind in (
    'issue', 'on_hold', 'deadline', 'standup', 'personal_digest', 'task_created',
    'checkin_prompt', 'standup_open', 'standup_remind', 'standup_summary', 'weekly_preview',
    'weekly_agenda', 'crisis', 'crisis_remind', 'crisis_esc', 'change_remind', 'change_esc'
  ));

commit;
