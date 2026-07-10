-- Que — tasks.predecessor_ids 컬럼 추가 (additive, E-9a · 간트 선행 작업)
-- 기준: data/docs/que-roadmap-plan.md "E-9" + packages/core taskSchema.predecessorIds
-- 성격: 무파괴. 선행 작업(FS — 이 작업들이 끝나야 시작) id 목록. 같은 프로젝트 내만·
--       자기 참조/순환 금지·최대 20개는 core setTaskPredecessors mutation이 강제한다
--       (DB 제약이 아니라 core 규칙 — 웹/MCP/CLI 공통 적용, 기존 관례).
--
-- ⚠️ 코드 배포 전에 이 마이그레이션을 먼저 적용한다. 안 그러면 predecessorIds를 포함한
--    persist가 존재하지 않는 컬럼으로 실패한다. 적용: pooler(pg) 직결. mock(인메모리)에는 무관.

begin;

alter table tasks add column if not exists predecessor_ids text[];

commit;
