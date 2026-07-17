-- Que — notification_outbox.kind 체크 제약에 'meeting_note' 추가 (additive, idempotent)
-- ✅ 적용 완료(2026-07-17, supabase 마이그레이션 `add_meeting_note_kind`).
-- 기준: CLAUDE.md 도메인 규칙(업무 영향 알림) · 회의록 업로드 시 참석자 요약 DM(명세 A-2, 2026-07-17)
-- 성격: 무파괴. 아래 dedup_key로 아웃박스에 적재하려면 kind 화이트리스트에 값이 있어야 한다.
--       (과거 task_created가 CHECK 화이트리스트 누락으로 유실된 사고 재발 방지 — kind는 반드시 먼저 추가.)
--       - meeting_note: 회의록 업로드/가져오기 성공 후, 참석자 중 열람 권한(canViewMeetingNote) 통과자
--                       (업로더 본인 제외)에게 제목·회의 일시·AI 요약 앞 3불릿·딥링크를 담아 보내는 개인 DM.
--                       dedup 'meeting_note:<noteId>:<recipientId>'(회의록·수신자당 평생 1회).
--                       트랜잭셔널 알림이라 digestRecipientAllowlist 우회(payment/standup_help 선례).
--       기존 값(issue/on_hold/deadline/standup/personal_digest/task_created/checkin_prompt/standup_open/
--       standup_remind/standup_summary/weekly_preview/weekly_agenda/crisis/crisis_remind/crisis_esc/
--       change_remind/change_esc/payment_created/payment_done/standup_help)은 그대로 유지한다(schema.sql 정합).
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
    'payment_created', 'payment_done', 'standup_help', 'meeting_note'
  ));

commit;
