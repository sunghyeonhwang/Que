-- DayBlocks(todo.griff.co.kr) 개인 데이터 서버 저장 — 블록 + 하루 회고(See) 스냅샷 2테이블.
-- ⚠️ 적용 금지(파일만) — 메인에서 Supabase에 apply_migration으로 적용한다.
-- 재적용 안전(if not exists) — schema.sql과 정합.
--
-- 네임스페이스: `db_` 접두 = DayBlocks 소유(interview 선례의 `iv_`와 같은 격리 관례).
-- 이 두 테이블은 Que **core 도메인 스냅샷 밖**이다 — SupabaseQueDb.persist / load에 절대 편입하지 말 것
-- (webauthn_credentials·personal_access_tokens·meeting_note_summaries와 동일 선례:
--  전용 admin 클라이언트 직조회/직쓰기로만 접근, 도메인 zod 스키마에도 필드를 넣지 않는다).
--
-- payload/snapshot을 jsonb로 두는 근거: DayBlocks 블록·회고 스키마는 **그쪽 레포가 정본**이라
-- Que가 컬럼으로 강결합하지 않는다. 서버는 소유(user_id)·날짜(date_key)·시각(updated_at)만 알고,
-- 내용 구조는 알지 못한다(방어적 파싱으로만 읽는다). 보안상 DayBlocks는 Supabase SDK 직접 접근 없이
-- Que API(PAT Bearer·본인 스코프 강제)를 통해서만 이 테이블에 닿는다.

-- 개인 블록: id는 클라이언트(DayBlocks)가 생성한다. 타 사용자 행 탈취는 API 계층에서 막는다
-- (upsert 전 소유자 확인 — 남의 id와 충돌하는 건은 거부). on delete cascade로 사용자 삭제 시 정리.
create table if not exists db_blocks (
  id         text primary key,
  user_id    text not null references users(id) on delete cascade,
  date_key   text not null,               -- 소속 날짜(YYYY-MM-DD, KST)
  payload    jsonb not null,              -- DayBlocks 블록 원형(구조는 DayBlocks 정본)
  updated_at timestamptz not null default now()
);
-- 기본 조회는 "본인 + 날짜 범위"다.
create index if not exists idx_db_blocks_user_date on db_blocks (user_id, date_key);

-- 하루 회고(See) 스냅샷: (user_id, date_key) PK라 upsert가 구조적으로 본인 밖을 건드릴 수 없다.
create table if not exists db_day_reviews (
  user_id    text not null references users(id) on delete cascade,
  date_key   text not null,               -- 회고 대상 날짜(YYYY-MM-DD, KST)
  snapshot   jsonb not null,              -- DayBlocks 하루 회고 원형(구조는 DayBlocks 정본)
  updated_at timestamptz not null default now(),
  primary key (user_id, date_key)
);

-- RLS enable(방어층). 서비스 키는 RLS를 우회하지만, anon 정책을 두지 않음으로써 익명 접근을 원천 차단한다.
alter table db_blocks enable row level security;
alter table db_day_reviews enable row level security;
