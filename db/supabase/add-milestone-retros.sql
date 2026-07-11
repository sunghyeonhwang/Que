-- OS-2a 실패 분류(부록 B) — 신규 테이블 milestone_retros.
-- additive 마이그레이션. 재적용 안전(if not exists). schema.sql과 정합.
-- ✅ 프로덕션 기적용(2026-07-11, apply_migration) — schema.sql과 정합.
--
-- 회고=기록 그 자체라 ChangeLog를 남기지 않는다(revision_notes 선례). 불변 레코드(updated_at 없음).
-- 원칙: 회고는 프로젝트·마일스톤 단위 — 담당자 강조 없음. created_by는 감사용 최소 기록.
-- 형식/enum은 앱(zod)에서도 강제하지만 DB는 enum·FK·길이만 방어한다.

begin;

create table if not exists milestone_retros (
  id           text primary key,
  milestone_id text not null references milestones(id),
  cause        text not null check (cause in ('internal', 'external')),
  cause_detail text not null check (cause_detail in
    ('schedule_mgmt', 'qa_lack', 'communication', 'approval_missed',
     'client_direction', 'budget_change', 'schedule_change', 'event_cancelled', 'other')),
  note         text check (char_length(note) <= 300),
  managed      boolean not null default false,   -- 대응 프로세스(외부 변경 접수 등)를 탔는가
  created_by   text not null references users(id),
  created_at   timestamptz not null default now()
);
create index if not exists idx_milestone_retros_milestone on milestone_retros (milestone_id);
create index if not exists idx_milestone_retros_created on milestone_retros (created_at desc);

commit;
