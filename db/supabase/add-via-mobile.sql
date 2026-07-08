-- Que — change_logs.via 체크 제약에 'mobile' 추가 (additive, D-2 · todo_griff(DayBlocks) 연동)
-- 기준: data/docs/que-roadmap-plan.md "D 트랙" + packages/core changeViaSchema('web'|'mcp'|'cli'|'mobile')
-- 성격: 무파괴. DayBlocks 모바일 앱이 Que REST API로 Task를 쓸 때 감사 출처를 'mobile'로 기록하려면
--       via check에 'mobile'이 허용돼야 한다(현행 'cli' 오기록 해소). 기존 web/mcp/cli는 그대로.
--
-- ⚠️ 코드 배포 전에 이 마이그레이션을 먼저 적용한다. 안 그러면 via='mobile' 쓰기가 제약 위반으로 500.
-- 적용: pooler(pg) 직결로 실행. mock(인메모리)에는 무관.

begin;

alter table change_logs drop constraint if exists change_logs_via_check;
alter table change_logs
  add constraint change_logs_via_check
  check (via in ('web', 'mcp', 'cli', 'mobile'));

commit;
