-- Que — 직원 관리(항목 19) DB화 마이그레이션 (additive, 무파괴)
-- 기준: packages/core/src/domain.ts userSchema(rank·department·active) + mock/users.ts(USER_RANK/USER_DEPARTMENT)
-- 성격: additive. users에 active/rank/department 추가 + 기존 8명 backfill, change_logs entity_type에 'user' 허용.
--
-- ⚠️ 적용은 메인이 한다(이 파일만 생성). 적용 후 기존 8명 로그인·조회가 그대로 되는지 검증할 것.
-- 재적용 안전(if not exists / backfill은 null 대상만 / 제약은 조회 후 재생성).
--
-- 락아웃 방지 핵심:
--   - active는 not null default true라 기존 8행이 자동으로 true로 채워진다(로그인 유지).
--   - rank/department는 backfill로 채운다 — 이게 없으면 DB화 후 rank null → 성과 스코프(personScopeForGrade)·
--     직급 표시가 깨진다. gradeForUser("대표"→ceo)가 rank에 의존하므로 대표/관리 backfill이 특히 중요하다.

-- 1) 컬럼 추가 (additive).
alter table users add column if not exists active     boolean not null default true;
alter table users add column if not exists rank       text;
alter table users add column if not exists department text;

-- 2) 기존 8명 backfill — 정적 맵(USER_RANK/USER_DEPARTMENT) 값과 동일하게. rank가 비어 있는 행만 채운다.
--    (department는 임시 배정값 — 실제 값 확정 시 편집. rank는 대표/관리/사원 3종.)
update users set rank = '대표', department = '경영' where id = 'hwang-sunghyeon' and rank is null;
update users set rank = '관리', department = '운영' where id = 'oh-seunghoon'    and rank is null;
update users set rank = '사원', department = '개발' where id = 'hwang-sungjin'   and rank is null;
update users set rank = '사원', department = '개발' where id = 'park-seunghwan'  and rank is null;
update users set rank = '사원', department = '디자인' where id = 'song-suyong'   and rank is null;
update users set rank = '사원', department = '디자인' where id = 'lee-yejin'     and rank is null;
update users set rank = '사원', department = '기획' where id = 'kim-riwon'       and rank is null;
update users set rank = '사원', department = '디자인' where id = 'lee-hyejin'    and rank is null;

-- 남은(맵에 없던) 행은 사원으로 폴백 채움 — rank null 방지(헬퍼 폴백과 동일 결과).
update users set rank = '사원' where rank is null;

-- 3) change_logs.entity_type check에 'user' 허용값 추가(직원 create/deactivate/reactivate 기록용).
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
      ('task','calendar_event','milestone','action_item','payment_request','meeting_note','recurring_template','project','client','user'));
end $$;
