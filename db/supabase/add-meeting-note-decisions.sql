-- Que — 회의록 결정 로그(meeting_note_decisions) — AI가 회의록 원문에서 추출한 "결정사항"(명세 B-4).
-- 기준: 데일리/회의록 기획(§1-f 회의록) · 회의록 개선 6건 중 B-4(결정사항 추출 → 결정 로그, 2026-07-17)
-- ✅ 적용 완료(2026-07-17, supabase 마이그레이션 `add_meeting_note_decisions`). mock(인메모리)에는 무관.
--         재적용 안전(if not exists). 코드는 테이블 부재에도 우아하게 비활성(결정만 빠지고 업로드는 성공).
-- 격리: 이 테이블은 core 도메인 스냅샷 밖이다. SupabaseQueDb.persist에 절대 편입하지 말 것
--       (meeting_note_summaries·webauthn_credentials·personal_access_tokens와 동일 선례 — 전용 admin
--        클라이언트 직조회로만 접근). meetingNoteSchema에도 필드를 추가하지 않는다.
-- 성격: AI 추출 파생물이라 "원문 대조 필요"(요약과 동급). Task/일정 등 업무 데이터 쓰기는 절대 없다.
--       재생성 시 note_id 기준 delete 후 재삽입한다(요약 upsert와 짝).
-- 참고: meeting_notes.id 는 schema.sql 기준 text primary key → note_id 도 text.

create table if not exists meeting_note_decisions (
  id         uuid primary key default gen_random_uuid(),
  note_id    text not null references meeting_notes(id) on delete cascade,
  content    text not null,
  decided_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists meeting_note_decisions_note_id_idx on meeting_note_decisions (note_id);
create index if not exists meeting_note_decisions_decided_at_idx on meeting_note_decisions (decided_at desc);

alter table meeting_note_decisions enable row level security;
