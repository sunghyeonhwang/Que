-- Que — milestones에 안건 결정 기록 컬럼 추가 (additive, /daily 긴급 결정 카드 종결 인식)
-- 기준: packages/core milestoneSchema(lastDecision·lastDecisionAt) + recordMilestoneDecision mutation
-- 성격: 무파괴. '유지(keep)'는 데이터를 바꾸지 않아 결정 사실이 어디에도 남지 않았고,
--       긴급 결정 카드·재촉 DM이 '미결정'으로 오판해 계속 남던 버그(2026-07-12)의 해소 근거.
--       detectCrisisTriggers는 last_decision_at이 오늘(KST)인 마일스톤을 재감지하지 않는다.
--
-- ⚠️ 코드 배포 전에 이 마이그레이션을 먼저 적용한다. 안 그러면 결정 실행 시 미지 컬럼으로 persist 실패.
-- 적용: supabase MCP apply_migration (2026-07-12 프로덕션 기적용).

begin;

alter table milestones
  add column if not exists last_decision text check (last_decision in ('keep', 'defer', 'hold'));

alter table milestones
  add column if not exists last_decision_at timestamptz;

commit;
