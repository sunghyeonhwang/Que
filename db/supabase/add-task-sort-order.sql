-- Que — tasks.sort_order 컬럼 추가 (additive, 간트 작업 세로 순서 수동 정렬)
-- 기준: packages/core taskSchema.sortOrder + core reorderProjectTasks mutation
-- 성격: 무파괴. 프로젝트 내 간트 표시 순서(오름차순). 사용자가 간트에서 행을 드래그해 정한
--       순서를 reorderProjectTasks가 (index+1)*10으로 채운다. 미지정(과거 데이터·이 컬럼 null)은
--       0으로 해석하고 시작일(start_at)로 tie-break한다(정렬 반영은 프론트 담당). 표시 속성이라
--       last_changed_by/at은 갱신하지 않고 감사 추적은 ChangeLog(entity_type='project') 1건으로 남긴다.
--
-- ⚠️ 코드 배포 전에 이 마이그레이션을 먼저 적용한다. 안 그러면 sortOrder를 포함한 task persist가
--    존재하지 않는 컬럼으로 실패한다. 적용: pooler(pg) 직결. mock(인메모리)에는 무관.

begin;

alter table tasks add column if not exists sort_order integer;

commit;
