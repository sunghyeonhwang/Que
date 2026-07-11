-- 데일리 스탠드업 비동기 체크인 — 신규 테이블 + 회의록 kind 컬럼. additive 마이그레이션.
-- "사람이 쓴 말"만 저장한다(파생 4분면은 저장 안 함 — 제출 시점 Task id만 jsonb로 경량 동결).
-- 운영 리듬 기록이라 ChangeLog(change_logs)에는 남기지 않는다(RevisionNote 선례).
-- ⚠️ 적용 금지(파일만) — 메인에서 Supabase에 apply_migration으로 적용한다.
-- 재적용 안전(if not exists) — schema.sql과 정합.

create table if not exists standup_entries (
  id                text primary key,
  -- KST 날짜 키(YYYY-MM-DD). (date, user_id) 유니크 — 재제출은 덮어쓰기.
  date              text not null,
  user_id           text not null references users(id),
  -- 오늘의 포커스 한마디(필수)
  focus             text not null check (char_length(focus) <= 200),
  -- 부연(선택)
  note              text check (char_length(note) <= 1000),
  -- 막힘 자유 서술(선택)
  blocker_text      text check (char_length(blocker_text) <= 1000),
  -- 막힌 작업 참조(선택 — issue/on_hold Task id)
  blocked_task_ids  text[],
  -- 제출 시점 파생 4분면 Task id 동결 {yesterdayDone, yesterdayUnfinished, todayPlanned}
  snapshot_task_ids jsonb not null default '{}'::jsonb,
  -- AI 개인 초안 프리필 여부 / 사람이 편집했는지
  ai_drafted        boolean not null default false,
  draft_edited      boolean,
  submitted_at      timestamptz not null,
  updated_at        timestamptz not null,
  unique (date, user_id)
);

-- 날짜별 조회가 기본이다(오늘 보드).
create index if not exists idx_standup_entries_date on standup_entries (date desc);

-- 회의록 종류 — weekly=월요일 주간 통합 회의, milestone=주중 수시 마일스톤 처리, general=일반.
-- 하위호환: 기존 데이터·미지정은 general.
alter table meeting_notes
  add column if not exists kind text not null default 'general'
    check (kind in ('milestone', 'weekly', 'general'));
