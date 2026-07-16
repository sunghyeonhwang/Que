-- 회의록 AI 요약 — 업로드 시 자동 생성되는 한국어 요약(핵심 결정·논의 흐름·리스크).
-- ⚠️ 적용: 프로덕션 적용 완료(2026-07-16). 이 파일은 스키마 기록용이다. additive만 담았고
--         재적용 안전(if not exists). 코드는 테이블 부재에도 우아하게 비활성(요약만 빠지고 업로드는 성공).
-- 격리: 이 테이블은 core 도메인 스냅샷 밖이다. SupabaseQueDb.persist에 절대 편입하지 말 것
--       (webauthn_credentials·personal_access_tokens와 동일 선례 — 전용 admin 클라이언트 직조회로만 접근).
--       meetingNoteSchema에도 필드를 추가하지 않는다(write-through 제약 회피가 설계 의도).
-- 참고: meeting_notes.id / users.id 는 schema.sql 기준 text primary key → note_id·generated_by 도 text.

create table if not exists meeting_note_summaries (
  note_id      text primary key references meeting_notes(id) on delete cascade,
  content      text not null,
  model        text not null,
  generated_at timestamptz not null default now(),
  generated_by text not null references users(id)
);
alter table meeting_note_summaries enable row level security;
