-- Que — users.slack_user_id 컬럼 추가 (additive, Slack Phase 2)
-- 기준: dev-lead Slack Phase 2 설계 + apps/web slack-bot.resolveSlackUserId lazy backfill
-- 성격: 무파괴. 개인 DM 브리핑 발송 직전 Que userId → Slack member ID를 해석한다.
--       최초 발송 때 email로 users.lookupByEmail(Bot) 조회 후 이 컬럼에 캐시(backfill)한다.
--       매핑이 틀린 멤버는 이 컬럼을 SQL로 직접 세팅해 탈출한다(수동 오버라이드).
--       ⚠️ 도메인 User엔 넣지 않는다 — supabase-db load()에서 email과 함께 삭제해 클라이언트 유출 차단.
--
-- 적용: pooler(pg) 직결로 실행(run-migration.mjs). mock(인메모리)에는 무관.

begin;

alter table users add column if not exists slack_user_id text;

commit;
