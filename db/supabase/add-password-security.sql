-- 비밀번호 보안 컬럼 추가 (본인 변경 · 첫 로그인 강제 변경 · 관리자 재설정 · 로그인 레이트리밋).
-- 2026-07-04 프로덕션(rnsqhipljpdmmkviiypy)에 Supabase 마이그레이션으로 적용됨. 재적용 안전(if not exists).
alter table users add column if not exists must_change_password boolean not null default false;
alter table users add column if not exists password_changed_at timestamptz;
alter table users add column if not exists failed_login_attempts integer not null default 0;
alter table users add column if not exists locked_until timestamptz;
