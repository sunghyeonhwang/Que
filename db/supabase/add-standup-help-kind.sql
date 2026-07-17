-- Que — notification_outbox.kind 체크 제약에 'standup_help' 추가 (additive, idempotent)
-- 기준: CLAUDE.md 도메인 규칙(업무 영향 알림) · 데일리 스탠드업 "내가 도울게요" 원탭(명세 C, 2026-07-17)
-- 성격: 무파괴. 아래 dedup_key로 아웃박스에 적재하려면 kind 화이트리스트에 값이 있어야 한다.
--       (과거 task_created가 CHECK 화이트리스트 누락으로 유실된 사고 재발 방지 — kind는 반드시 먼저 추가.)
--       - standup_help: 막힌 팀원에게 "돕겠다"를 누른 사람이 당사자에게 보내는 개인 DM.
--                       dedup 'standup_help:<KST날짜>:<targetUserId>:<actorId>'(같은 날·조합당 평생 1회).
--                       트랜잭셔널 알림이라 digestRecipientAllowlist 우회(결제 DM 선례).
--       기존 값(issue/on_hold/deadline/standup/personal_digest/task_created/checkin_prompt/standup_open/
--       standup_remind/standup_summary/weekly_preview/weekly_agenda/crisis/crisis_remind/crisis_esc/
--       change_remind/change_esc/payment_created/payment_done)은 그대로 유지한다(schema.sql 정합).
--
-- 적용: 이 세션에서는 적용하지 않는다(파일만 생성). 배포 시 pooler(pg) 직결로 실행. mock(인메모리)에는 무관.

begin;

alter table notification_outbox drop constraint if exists notification_outbox_kind_check;
alter table notification_outbox
  add constraint notification_outbox_kind_check
  check (kind in (
    'issue', 'on_hold', 'deadline', 'standup', 'personal_digest', 'task_created',
    'checkin_prompt', 'standup_open', 'standup_remind', 'standup_summary', 'weekly_preview',
    'weekly_agenda', 'crisis', 'crisis_remind', 'crisis_esc', 'change_remind', 'change_esc',
    'payment_created', 'payment_done', 'standup_help'
  ));

commit;
