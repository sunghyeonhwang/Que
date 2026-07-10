-- Que — Slack 인터랙티브(C-2) 마이그레이션 (additive)
--
-- ① change_logs.via 체크 제약에 'slack' 추가 — Slack 버튼으로 체크인에 응답하면
--    core answerCheckIn이 via='slack'으로 ChangeLog를 남긴다(누가/언제/무엇을/어디서).
-- ② notification_outbox.kind 체크 제약에 'checkin_prompt' 추가(체크인 재촉 DM) +
--    ⚠️ 'task_created' 누락 보정 — Phase 3(할일 생성 DM)가 코드에 먼저 들어갔는데 kind 제약
--    마이그레이션이 없었다. 제약이 구 목록인 DB에서는 task_created 적재가 CHECK 위반으로
--    persist 전체를 깨뜨릴 수 있는 잠복 결함이라 여기서 함께 넓힌다(idempotent).
--
-- ✅ 프로덕션 기적용(2026-07-10, supabase migration 'add_slack_interactive') — 재실행해도 무해(idempotent).
--    task_created 보정은 C-2 활성과 무관하게 즉시 적용했다(적용 전까지 대표 배정 작업의 생성 DM이
--    CHECK 위반으로 조용히 유실되던 활성 결함 — glados 재심사 지적).

alter table change_logs drop constraint if exists change_logs_via_check;
alter table change_logs
  add constraint change_logs_via_check
  check (via in ('web', 'mcp', 'cli', 'mobile', 'slack'));

alter table notification_outbox drop constraint if exists notification_outbox_kind_check;
alter table notification_outbox
  add constraint notification_outbox_kind_check
  check (kind in ('issue', 'on_hold', 'deadline', 'standup', 'personal_digest', 'task_created', 'checkin_prompt'));
