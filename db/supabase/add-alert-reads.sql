-- Que — alert_reads 테이블 추가 (additive, C-3a 알림 센터)
-- 알림은 상태 파생 스냅샷(alerts-data)이라 저장하지 않고, 사용자별 "읽음"만 저장한다.
-- id = `${user_id}:${alert_id}` (사용자·알림당 1행, 멱등 upsert 키). 업무 데이터 아님 — ChangeLog 없음.
-- ⚠️ 2026-07-10 프로덕션에 이미 적용됨(배포 사고 복구 과정에서 선적용). 이 파일은 기록·재현용.

begin;

create table if not exists alert_reads (
  id       text primary key,
  user_id  text not null references users(id),
  alert_id text not null,
  read_at  timestamptz not null
);
create index if not exists idx_alert_reads_user on alert_reads (user_id);

commit;
