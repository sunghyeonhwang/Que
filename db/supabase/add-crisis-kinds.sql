-- Que — notification_outbox.kind 체크 제약에 'weekly_agenda' + 긴급 결정 3종(crisis/crisis_remind/crisis_esc) 추가
-- (additive, Phase 2.5 AI 회의 진행 묶음)
-- 기준: que+/daily-standup-okr-plan.md §1-e(긴급 결정 워크플로) · §1-f(주간 통합 회의 AI 아젠다)
-- 성격: 무파괴. 아래 dedup_key로 아웃박스에 적재하려면 kind 화이트리스트에 값이 있어야 한다.
--       - weekly_agenda: 월요일 09:00~09:30 팀채널 주간 아젠다 게시. dedup 'weekly_agenda:team:<YYYY-MM-DD KST>'.
--       - crisis:        긴급 결정 카드 개인 DM. dedup 'crisis:<milestoneId>:<YYYY-MM-DD KST>'. 하루 최대 3건(web dispatch 상한).
--       - crisis_remind: 2h 미해결 재촉 DM. dedup 'crisis_remind:<milestoneId>:<YYYY-MM-DD KST>'.
--       - crisis_esc:    4h 미해결 관리자·대표 에스컬레이션 DM. dedup 'crisis_esc:<milestoneId>:<YYYY-MM-DD KST>'.
--       기존 issue/on_hold/deadline/standup/personal_digest/task_created/checkin_prompt/standup_open/
--       standup_remind/standup_summary/weekly_preview 값은 그대로 유지한다(schema.sql 정합).
--
-- 적용: 이 세션에서는 적용하지 않는다(파일만 생성). 배포 시 pooler(pg) 직결로 실행(run-migration.mjs). mock(인메모리)에는 무관.

begin;

alter table notification_outbox drop constraint if exists notification_outbox_kind_check;
alter table notification_outbox
  add constraint notification_outbox_kind_check
  check (kind in (
    'issue', 'on_hold', 'deadline', 'standup', 'personal_digest', 'task_created',
    'checkin_prompt', 'standup_open', 'standup_remind', 'standup_summary', 'weekly_preview',
    'weekly_agenda', 'crisis', 'crisis_remind', 'crisis_esc'
  ));

commit;
