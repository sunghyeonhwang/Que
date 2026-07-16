-- RLS 일괄 활성 — 2026-07-16 패스키 작업 때 Supabase 어드바이저리가 경고한 잔여 11개 테이블.
-- ⚠️ 적용: 사람이 Supabase Dashboard > SQL Editor에서 직접 실행한다(자동 적용은 권한 게이트 차단).
-- 안전성: Que·인터뷰 앱 모두 service role 키로만 DB 접근 → service role은 RLS를 우회하므로
--         정책 없는 RLS 활성은 anon/authenticated 경로만 차단하고 앱 동작에는 무영향.
-- 재실행 안전(enable은 멱등).
alter table change_requests enable row level security;
alter table milestone_retros enable row level security;
alter table payment_categories enable row level security;
alter table notification_outbox enable row level security;
alter table standup_entries enable row level security;
alter table standup_team_summaries enable row level security;
alter table revision_notes enable row level security;
alter table objectives enable row level security;
alter table key_results enable row level security;
alter table clients enable row level security;
alter table alert_reads enable row level security;
