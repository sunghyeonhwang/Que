-- Que Copilot(⌘K 채팅) 확정 실행 경로 — change_logs.via에 'chat' 추가(기획 모듈 D-2).
-- ⚠️ 프로덕션 기적용(2026-07-11, apply_migration add_via_chat) — schema.sql과 정합.
alter table change_logs drop constraint if exists change_logs_via_check;
alter table change_logs add constraint change_logs_via_check
  check (via in ('web','mcp','cli','mobile','slack','chat'));
