-- Que — 프로젝트 표시 순서(sort_order) 추가 마이그레이션 (additive)
-- 기준: packages/core/src/domain.ts projectSchema.sortOrder · reorderProjects mutation
-- 적용: 사람이 프로덕션에 적용한다 (Supabase Dashboard > SQL Editor 또는 supabase MCP apply_migration).
--       이 파일 자체는 개발 중 실행하지 않는다.
-- ⚠️ 배포 순서 주의: 이 컬럼이 없는 상태로 신 코드가 배포되면 스냅샷 write-through(persist)가
--    sort_order를 insert/update에 실어 보내 실패한다. **반드시 이 마이그레이션을 먼저 적용한 뒤 코드를 배포**한다.
-- 성격: 무파괴 additive. 컬럼 추가 + 같은 클라이언트(및 미소속) 그룹 안에서 created_at 순으로 초기 순서 부여.

-- 1) 컬럼 추가. 기존 행은 default 0으로 채워진다.
alter table projects add column if not exists sort_order integer not null default 0;

-- 2) 그룹(client_id, 미소속=NULL 포함)별로 created_at 오름차순으로 0부터 초기 sort_order를 부여한다.
--    (모두 0이면 그룹 내 순서가 생성 순서와 무관해지므로, 최초 1회 순번을 매긴다.)
--    재실행 가드(글래도스 게이트): 이미 0이 아닌 sort_order가 있으면(=사람이 재정렬했거나 백필 완료)
--    백필을 건너뛴다 — 실수로 2회 적용해도 수동 순서를 리셋하지 않는다.
with ordered as (
  select
    id,
    row_number() over (partition by client_id order by created_at) - 1 as rn
  from projects
)
update projects p
set sort_order = o.rn
from ordered o
where p.id = o.id
  and not exists (select 1 from projects g where g.sort_order <> 0);
