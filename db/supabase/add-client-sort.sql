-- Que — 클라이언트 표시 순서(sort_order) 추가 마이그레이션 (additive)
-- 기준: packages/core/src/domain.ts clientSchema.sortOrder
-- 적용: 사람이 프로덕션에 적용한다 (Supabase Dashboard > SQL Editor 또는 supabase MCP apply_migration).
--       이 파일 자체는 개발 중 실행하지 않는다.
-- 성격: 무파괴 additive. 컬럼 추가 + 기존 행에 created_at 순으로 초기 순서 부여.

-- 1) 컬럼 추가. 기존 행은 default 0으로 채워진다.
alter table clients add column if not exists sort_order integer not null default 0;

-- 2) 기존 행에 created_at 오름차순으로 0부터 초기 sort_order를 부여한다.
--    (모두 0이면 정렬이 생성 순서와 무관해지므로, 최초 1회 순번을 매긴다.)
with ordered as (
  select id, row_number() over (order by created_at) - 1 as rn
  from clients
)
update clients c
set sort_order = o.rn
from ordered o
where c.id = o.id;
