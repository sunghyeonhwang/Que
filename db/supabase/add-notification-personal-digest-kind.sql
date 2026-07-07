-- Que — notification_outbox.kind 체크 제약에 'personal_digest' 추가 (additive, Slack Phase 2)
-- 기준: dev-lead Slack Phase 2 설계 + apps/web dispatch postPersonalDigests
-- 성격: 무파괴. 개인 DM 데일리 브리핑(하루 1회, dedup_key 'personal_digest:<userId>:<YYYY-MM-DD KST>')을
--       아웃박스에 적재하려면 kind='personal_digest'가 허용돼야 한다. 기존 issue/on_hold/deadline/standup은 그대로.
--
-- 적용: pooler(pg) 직결로 실행(run-migration.mjs). mock(인메모리)에는 무관.

begin;

alter table notification_outbox drop constraint if exists notification_outbox_kind_check;
alter table notification_outbox
  add constraint notification_outbox_kind_check
  check (kind in ('issue', 'on_hold', 'deadline', 'standup', 'personal_digest'));

commit;
