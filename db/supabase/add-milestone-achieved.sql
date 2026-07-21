-- Que — milestones.achieved_at 컬럼 추가 (additive, 마일스톤 완료 처리)
-- 기준: packages/core milestoneSchema.achievedAt + core setMilestoneAchieved mutation
-- 성격: 무파괴. 마일스톤 완료 시각(ISO/timestamptz). 있으면 달성 완료로 보고 위험·재촉·긴급 결정
--       로직에서 제외한다(riskStatus 위험 의미와 분리 — 완료를 별도로 기록·해제할 수 있게 함).
--       완료=setMilestoneAchieved가 현재 시각 기록, 해제=null(다시 위험 로직에 편입). fromRow/toRow는
--       제네릭 snake↔camel이라 별도 매핑 코드가 없고, timestamptz는 ISO 문자열로 왕복한다.
--
-- ⚠️ 코드 배포 전에 이 마이그레이션을 먼저 적용한다. 안 그러면 achievedAt를 포함한 milestone persist가
--    존재하지 않는 컬럼으로 실패한다. 적용: pooler(pg) 직결. mock(인메모리)에는 무관.

begin;

alter table milestones add column if not exists achieved_at timestamptz;

commit;
