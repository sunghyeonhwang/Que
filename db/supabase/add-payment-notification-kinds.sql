-- Que — notification_outbox.kind 체크 제약에 결제 알림 2종(payment_created / payment_done) 추가
-- (additive, idempotent)
-- 기준: CLAUDE.md 도메인 규칙(업무 영향 변경 알림) · 결제요청 Slack 개인 DM 2종 요구(2026-07-14)
-- 성격: 무파괴. 아래 dedup_key로 아웃박스에 적재하려면 kind 화이트리스트에 값이 있어야 한다.
--       (과거 task_created가 CHECK 화이트리스트 누락으로 유실된 사고 재발 방지 — kind는 반드시 먼저 추가.)
--       - payment_created: 결제 요청 등록 즉시 active 관리자 전원(등록자 제외) 개인 DM.
--                          dedup 'payment_created:<paymentId>:<recipientId>'(결제·수신자당 평생 1회).
--                          ⚠️ 계좌번호는 payload에 담지 않는다(마스킹 — Slack 계좌 유출 방지).
--       - payment_done:    결제 완료(status=done) 시 등록자(requesterId) 개인 DM.
--                          dedup 'payment_done:<paymentId>:<lastChangedAt ISO>'(완료 이벤트당 1회, 재완료 시 재발송).
--       기존 값(issue/on_hold/deadline/standup/personal_digest/task_created/checkin_prompt/standup_open/
--       standup_remind/standup_summary/weekly_preview/weekly_agenda/crisis/crisis_remind/crisis_esc/
--       change_remind/change_esc)은 그대로 유지한다(schema.sql 정합).
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
    'payment_created', 'payment_done'
  ));

commit;
