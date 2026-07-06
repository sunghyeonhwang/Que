-- 수정사항(이슈/피드백) 트래커 — 신규 테이블. additive 마이그레이션.
-- 테스트 중 발견한 수정사항을 적는 팀 공용 목록. 비즈니스 업무 데이터가 아니라
-- ChangeLog(change_logs)에는 기록하지 않는다 — entity_type check 확장이 필요 없다.
-- ⚠️ 적용 금지(파일만) — 메인에서 Supabase에 apply_migration으로 적용한다.
-- 재적용 안전(if not exists) — schema.sql과 정합.

create table if not exists revision_notes (
  id          text primary key,
  -- 어느 화면(메뉴)에서 발견했는지 — 메뉴 라벨 등 자유 텍스트
  menu        text not null check (char_length(menu) <= 100),
  -- 화면 내 위치(자유 텍스트, 선택)
  location    text check (char_length(location) <= 200),
  -- 오류/수정 내용(필수)
  description text not null check (char_length(description) <= 2000),
  -- 미해결 / 보류 / 해결
  status      text not null default 'unresolved'
                check (status in ('unresolved', 'hold', 'resolved')),
  author_id   text references users(id),
  created_at  timestamptz not null default now(),
  -- 마지막 상태 변경 시각/변경자 (updatedAt/updatedBy만 추적)
  updated_at  timestamptz,
  updated_by  text references users(id)
);

-- 목록은 최신순 조회가 기본이다.
create index if not exists idx_revision_notes_created on revision_notes (created_at desc);
