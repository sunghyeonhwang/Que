-- Que — milestones에 중요 표시(critical) 컬럼 추가 (additive)
-- 기준: packages/core milestoneSchema.critical — 최종 런칭일 등 중요 마일스톤을 체크하면
--       전 화면 마일스톤 칩이 붉은 그라데이션으로 표기된다(2026-07-13 사용자 요청).
-- 성격: 무파괴. null=일반(기존 전부), true=중요.
--
-- ⚠️ 코드 배포 전에 이 마이그레이션을 먼저 적용한다. 안 그러면 critical 저장 시 미지 컬럼으로 persist 실패.
-- 적용: supabase MCP apply_migration (2026-07-13 프로덕션 기적용).

begin;

alter table milestones add column if not exists critical boolean;

commit;
