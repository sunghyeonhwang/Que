-- 비밀번호 보안 컬럼 추가 (본인 변경 · 첫 로그인 강제 변경 · 관리자 재설정 · 로그인 레이트리밋).
-- 2026-07-04 프로덕션(rnsqhipljpdmmkviiypy)에 Supabase 마이그레이션으로 적용됨. 재적용 안전(if not exists).
alter table users add column if not exists must_change_password boolean not null default false;
alter table users add column if not exists password_changed_at timestamptz;
alter table users add column if not exists failed_login_attempts integer not null default 0;
alter table users add column if not exists locked_until timestamptz;

-- 로그인 실패 카운터를 원자적으로 증가시키고 임계 도달 시 잠근다(read-modify-write 경쟁 방지).
-- verify.ts / password.ts가 SECRET_KEY로 rpc('register_login_failure', ...) 호출.
create or replace function register_login_failure(p_user_id text, p_threshold integer, p_lock_minutes integer)
returns void
language sql
as $$
  update users set
    locked_until = case
      when failed_login_attempts + 1 >= p_threshold then now() + make_interval(mins => p_lock_minutes)
      else locked_until end,
    failed_login_attempts = case
      when failed_login_attempts + 1 >= p_threshold then 0
      else failed_login_attempts + 1 end
  where id = p_user_id;
$$;
