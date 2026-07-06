-- 결제 요청 분류(카테고리) 관리 — 관리자 전용. additive 마이그레이션(무파괴).
-- 기준: packages/core/src/domain.ts paymentCategorySchema { id, name(≤50), status, sortOrder }
-- 적용: 사람이 프로덕션에 적용한다 (Supabase Dashboard > SQL Editor 또는 supabase MCP apply_migration).
--       이 파일 자체는 개발 중 실행하지 않는다. schema.sql과 정합.
-- 성격: 신규 테이블 + change_logs.entity_type check에 'payment_category' 추가.
--       payment_requests.category(text) 컬럼은 그대로 둔다 — 이 목록은 폼 선택지 소스일 뿐 FK가 아니다(하위호환).
-- 재적용 안전(if not exists / catalog 조회 후 재생성).

-- 1) 결제 분류 목록. 클라이언트(clients)와 동일 구조 — id/name/status + sort_order.
create table if not exists payment_categories (
  id         text primary key,
  name       text not null check (char_length(name) <= 50),
  status     text not null check (status in ('active', 'archived')),
  -- 관리자가 정한 표시 순서(오름차순). 결제 폼 select·관리화면이 공유한다.
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- 2) 기존 결제 category 문자열에서 분류 목록을 시드한다(최초 1회, 중복 제외).
--    이미 payment_categories가 채워져 있으면 아무것도 하지 않는다(on conflict do nothing).
insert into payment_categories (id, name, status, sort_order)
select
  'paycat-' || md5(category)                       as id,
  category                                          as name,
  'active'                                          as status,
  (row_number() over (order by min(created_at)) - 1) as sort_order
from payment_requests
where category is not null and char_length(category) <= 50
group by category
on conflict (id) do nothing;

-- 3) change_logs.entity_type check에 'payment_category' 허용값 추가.
--    check constraint 자동명이 환경마다 다를 수 있어 pg_catalog에서 실제 이름을 조회해 드롭 후 재생성한다.
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
      ('task','calendar_event','milestone','action_item','payment_request','payment_category','meeting_note','recurring_template','project','client','user'));
end $$;
