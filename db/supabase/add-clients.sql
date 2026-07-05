-- 2단 분류(클라이언트 → 프로젝트) 추가 — additive 마이그레이션.
-- ✅ 2026-07-05 프로덕션(rnsqhipljpdmmkviiypy) 적용 완료 — Supabase MCP apply_migration(add_clients_two_tier).
--    적용 전 projects 0행 확인, 적용 후 clients 테이블·client_id 컬럼·entity_type check 재검증(HANDOFF 56). 무파괴.
-- 재적용 안전(if not exists / catalog 조회 후 재생성) — schema.sql과 정합.

-- 1) 상위 분류 = 클라이언트(거래처). 최소 필드(id/name/status)만.
create table if not exists clients (
  id         text primary key,
  name       text not null check (char_length(name) <= 200),
  status     text not null check (status in ('active', 'archived')),
  created_at timestamptz not null default now()
);

-- 2) projects에 상위 클라이언트 FK 추가(nullable — 내부 잡무 허용, 무파괴).
alter table projects add column if not exists client_id text references clients(id);

-- 3) change_logs.entity_type check에 'project'·'client' 허용값 추가.
--    check constraint 자동명이 환경마다 다를 수 있어(예: change_logs_entity_type_check),
--    pg_catalog에서 실제 이름을 조회해 드롭한 뒤 재생성한다.
do $$
declare
  cname text;
begin
  select con.conname into cname
  from pg_constraint con
  where con.conrelid = 'change_logs'::regclass
    and con.contype = 'c'
    and pg_get_constraintdef(con.oid) ilike '%entity_type%';

  if cname is not null then
    execute format('alter table change_logs drop constraint %I', cname);
  end if;

  alter table change_logs
    add constraint change_logs_entity_type_check
    check (entity_type in
      ('task','calendar_event','milestone','action_item','payment_request','meeting_note','recurring_template','project','client'));
end $$;
