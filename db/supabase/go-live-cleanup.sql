-- Que go-live 클린업 (2026-07-04, HANDOFF 51). 프로덕션 실사용 전 1회 실행.
-- ⚠️⚠️ 파괴적 — 롤백 불가. 실행 전 Supabase 스냅샷/백업 권장.
-- 목적: 데모 시드 데이터(멘딕스 등) 전량 제거. users·personal_access_tokens는 유지(로그인 보존).
-- 실행: Supabase SQL Editor 또는 psql. 아래 두 블록을 순서대로.

-- ── 1) 트랜잭션 데이터 퍼지 (자식→부모 FK 역순, users/PAT 제외) ──
begin;
delete from check_ins;
delete from task_comments;
delete from change_logs;
delete from status_logs;
delete from recurring_templates;
delete from payment_requests;
delete from action_items;
delete from meeting_notes;
delete from calendar_events;
delete from tasks;
delete from milestones;
delete from projects;
-- users, personal_access_tokens 는 의도적으로 남긴다(로그인·MCP/CLI 토큰 보존).
commit;

-- ── 2) (권장) 스케줄러 중복 생성 방지 — check_ins 회차 UNIQUE ──
-- 서버리스 다중 인스턴스가 같은 회차를 동시에 만들 때 DB 레벨에서 중복 차단.
-- 위 퍼지로 테이블이 비어 있어야 제약 추가가 안전하다(기존 중복 시 실패).
alter table check_ins
  add constraint uq_check_ins_task_scheduled unique (task_id, scheduled_at);

-- 참고(후순위, 이 파일 밖):
--  · 반복 업무(recurring) 중복은 생성 Task에 dedup 키 컬럼이 필요 → 스키마 변경 사안, 별도.
--  · 스케줄러를 요청 경로에서 떼어 단일 Vercel Cron으로 이관하면 위 제약 없이도 근본 해소.
