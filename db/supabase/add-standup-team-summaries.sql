-- 데일리 스탠드업 AI 팀 요약(기획 §2·§3②) — 신규 테이블. additive 마이그레이션.
-- **AI 저장 관례("AI는 확인을 거쳐 저장")의 의도적 예외**: 시스템(크론)이 pro(실패 시 flash 폴백)로
-- 생성 즉시 저장한다. 근거 — Slack 게시·보드 표시 시점 분리, 하루 1회 pro 재생성 비용, 과거 회고 재현.
-- 권한: 시스템 생성, 재생성만 admin(regenerated_by에 그 actorId). date 유니크 1건, 재생성은 덮어쓰기.
-- 운영 리듬 산출물이라 ChangeLog(change_logs)에는 남기지 않는다(standup_entries·revision_notes 선례).
-- ⚠️ 적용 금지(파일만) — 메인에서 Supabase에 apply_migration으로 적용한다.
-- 재적용 안전(if not exists) — schema.sql과 정합.

create table if not exists standup_team_summaries (
  id                 text primary key,
  -- KST 날짜 키(YYYY-MM-DD). 유니크 1건 — 재생성은 덮어쓰기.
  date               text not null unique,
  generated_at       timestamptz not null,
  -- 생성에 실제로 쓴 모델. pro 우선, 실패 시 flash 폴백.
  model              text not null check (model in ('flash', 'pro')),
  -- 구조화 텍스트 — (a)막힘 클러스터+도울 사람 (b)어제→오늘 흐름 (c)추천 액션 2~3개.
  content            text not null,
  -- 요약 생성 시점에 제출돼 있던 유저 id들(지각 미반영·"n인 미제출" 판정 근거).
  submitted_user_ids text[] not null default '{}',
  -- admin 재생성 시 그 actorId(최초 자동 생성이면 NULL).
  regenerated_by     text references users(id)
);

-- 날짜별 단건 조회가 기본이다(오늘 보드·Slack 게시).
create index if not exists idx_standup_team_summaries_date on standup_team_summaries (date desc);

-- 알림 아웃박스 kind 확장(기획 §5 알림 시간표 재편) — 스탠드업 리듬 신규 kind 4종.
-- standup_open=10:00 팀채널 오픈+개인 DM, standup_remind=10:40 미제출 재촉 DM,
-- standup_summary=11:00 팀채널 AI 팀 요약, weekly_preview=금 16:00 팀채널 주간 프리뷰.
alter table notification_outbox drop constraint if exists notification_outbox_kind_check;
alter table notification_outbox
  add constraint notification_outbox_kind_check
  check (kind in (
    'issue', 'on_hold', 'deadline', 'standup', 'personal_digest', 'task_created',
    'checkin_prompt', 'standup_open', 'standup_remind', 'standup_summary', 'weekly_preview'
  ));
