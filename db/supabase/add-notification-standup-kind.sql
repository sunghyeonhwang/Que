-- Que — notification_outbox.kind 체크 제약에 'standup' 추가 (additive, B-1 배선 단계)
-- 기준: data/docs/que-roadmap-plan.md "B-1 · Slack Webhook 알림" + apps/web dispatch postStandupDigest
-- 성격: 무파괴. 팀 데일리 스탠드업 다이제스트(하루 1회, dedup_key 'standup:team:<YYYY-MM-DD KST>')를
--       아웃박스에 적재하려면 kind='standup'이 허용돼야 한다. 기존 issue/on_hold/deadline은 그대로.
--
-- 적용: pooler(pg) 직결로 실행. mock(인메모리)에는 무관.

begin;

alter table notification_outbox drop constraint if exists notification_outbox_kind_check;
alter table notification_outbox
  add constraint notification_outbox_kind_check
  check (kind in ('issue', 'on_hold', 'deadline', 'standup'));

commit;
