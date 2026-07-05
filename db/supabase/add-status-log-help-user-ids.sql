-- Que — 상태 상세 "도움 필요한 사람" 다중화(help_user_ids text[]) 추가 마이그레이션 (additive)
-- 기준: packages/core/src/domain.ts statusLogSchema.helpUserIds / statusDetailSchema.helpUserIds
-- 성격: 무파괴 additive. nullable text[] 컬럼 추가 + 기존 단일값 backfill.
--
-- ✅ 프로덕션 적용 완료 (2026-07-06, Supabase MCP add_status_log_help_user_ids, 코드 배포 전 선적용).
--    이 컬럼이 없으면 changeTaskStatus의 write-through(upsert)가
--    "column help_user_ids does not exist"로 실패한다. (if not exists라 재적용해도 무해하다.)
--
-- 의미: 문제발생/홀드 전환 시 도움이 필요한 사람을 여러 명 지정할 수 있게 한다.
--       기존 단일 컬럼 help_user_id(FK)는 하위호환·읽기·FK 유지를 위해 남겨 두고,
--       애플리케이션은 help_user_ids[0]에 첫 번째 값을 계속 채운다.
--       "내 관련" 판정과 표시는 core helpUserIdsOf()로 단일/다중을 통일해 읽는다.
--       help_user_ids는 users(id) 원소를 담지만 배열이라 컬럼 레벨 FK는 걸지 않는다(애플리케이션 보장).

alter table status_logs add column if not exists help_user_ids text[];

-- 기존 단일값을 배열로 backfill (help_user_ids가 비어 있는 과거 로그만).
update status_logs
   set help_user_ids = array[help_user_id]
 where help_user_id is not null
   and help_user_ids is null;
