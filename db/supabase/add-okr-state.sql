-- OS-1 상태형 KR(부록 A) — key_results.metric_type에 'state' 추가 + state_checks jsonb 컬럼.
-- additive 마이그레이션. 재적용 안전(if not exists / drop-add). schema.sql과 정합.
-- ✅ 프로덕션 기적용(2026-07-11, apply_migration) — schema.sql과 정합.
--
-- state_checks 형태(1~7개, state일 때 1개 이상 — 앱 zod가 강제):
--   [{ id, label, done, requiresAdminConfirm, confirmedBy?, doneAt? }]
-- 진척은 done 비율(keyResultProgress state 분기). requiresAdminConfirm 항목은 admin만 토글(앱 강제).

begin;

-- 상태 체크리스트(jsonb). manual/task_auto KR에는 NULL. 형식·개수는 앱(zod)이 검증한다.
alter table key_results
  add column if not exists state_checks jsonb;

-- metric_type 체크에 'state' 추가(재적용 안전: drop if exists → add).
alter table key_results drop constraint if exists key_results_metric_type_check;
alter table key_results add constraint key_results_metric_type_check
  check (metric_type in ('manual', 'task_auto', 'state'));

commit;
