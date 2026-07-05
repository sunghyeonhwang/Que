-- ============================================================
-- Que view 테스트용 더미 데이터 정리(삭제) 스크립트
-- ------------------------------------------------------------
-- db/supabase/dummy-data-view-test.sql 로 넣은 더미를 모두 제거합니다.
-- tasks 를 먼저 지운 뒤 projects 를 지웁니다(자식 참조 우선).
-- ============================================================

delete from tasks where id like 'dummy-%';
delete from projects where id like 'dummy-prj-%';
