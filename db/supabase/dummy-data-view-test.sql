-- ============================================================
-- Que view 테스트용 더미 데이터 (프로덕션 Supabase)
-- ------------------------------------------------------------
-- 목적: que.griff.co.kr/view (board / schedule) 현황판을 채워 테스트하기 위한
--       임시 더미 데이터입니다. 실제 업무 데이터가 아닙니다.
-- 삭제: 이 데이터는 모두 지울 수 있습니다.
--       => db/supabase/remove-dummy-data-view-test.sql 실행
--          (delete from tasks where id like 'dummy-%';
--           delete from projects where id like 'dummy-prj-%';)
-- 식별: projects.id = 'dummy-prj-*', tasks.id = 'dummy-uf-*' / 'dummy-mw-*'
-- 날짜: 테스트 목적상 시트 원본 날짜 대신 2026-06-29 ~ 2026-07-17 평일
--       (+ 오늘 2026-07-05, 내일 2026-07-06)로 재분배했습니다.
-- 주의: 실행 전 프로덕션 users 에 lee-hyejin(이혜진)이 존재해야 합니다.
-- 생성: 자동 생성 스크립트 (시트 gviz CSV 파싱). 수동 편집 시 주의.
-- ============================================================

-- 1) 더미 프로젝트 2개
insert into projects (id, name, owner_id, status, client_id, description) values
  ('dummy-prj-unrealfest', '언리얼 페스트', 'oh-seunghoon', 'active', 'client-ffeba3b4-5345-4a83-88f5-c69fc74e7d49', '[뷰 테스트용 더미] 언리얼 페스트 일정'),
  ('dummy-prj-mendix-webinar', '멘딕스 파트너 웨비나', 'oh-seunghoon', 'active', 'client-f604b930-24f6-497a-8e74-d81a15caf18d', '[뷰 테스트용 더미] 멘딕스 파트너 웨비나 일정');

-- 2) 더미 태스크 (58개: 언리얼 34 + 멘딕스 24)
insert into tasks
  (id, title, owner_id, assignee_id, project_id, start_at, end_at, status, priority, description, estimated_hours, source, visibility)
values
  ('dummy-uf-001', '일정 제작', 'hwang-sunghyeon', 'hwang-sunghyeon', 'dummy-prj-unrealfest', '2026-06-29T10:00:00+09:00', '2026-06-29T11:00:00+09:00', 'done', 'high', '기획 · 뷰 테스트용 더미', NULL, 'manual', 'team'),
  ('dummy-uf-002', '키이미지 전달 - 에픽', 'oh-seunghoon', 'oh-seunghoon', 'dummy-prj-unrealfest', '2026-06-30T10:00:00+09:00', '2026-06-30T12:00:00+09:00', 'done', 'normal', '키이미지 · 뷰 테스트용 더미', NULL, 'manual', 'team'),
  ('dummy-uf-003', '등록 프로세스 기획 초안', 'hwang-sungjin', 'hwang-sungjin', 'dummy-prj-unrealfest', '2026-07-01T10:00:00+09:00', '2026-07-01T11:00:00+09:00', 'done', 'normal', '웹사이트 제작 · 뷰 테스트용 더미', NULL, 'manual', 'team'),
  ('dummy-uf-004', '프론트 페이지 코딩', 'park-seunghwan', 'park-seunghwan', 'dummy-prj-unrealfest', '2026-07-02T10:00:00+09:00', '2026-07-02T12:00:00+09:00', 'in_progress', 'normal', '웹사이트 제작 · 뷰 테스트용 더미', NULL, 'manual', 'team'),
  ('dummy-uf-005', '테스트 / 수정', 'song-suyong', 'song-suyong', 'dummy-prj-unrealfest', '2026-07-03T10:00:00+09:00', '2026-07-03T11:00:00+09:00', 'in_progress', 'normal', '웹사이트 제작 · 뷰 테스트용 더미', NULL, 'manual', 'team'),
  ('dummy-uf-006', '쿠폰 기능 개발', 'lee-yejin', 'lee-yejin', 'dummy-prj-unrealfest', '2026-07-05T10:00:00+09:00', '2026-07-05T12:00:00+09:00', 'scheduled', 'high', '웹사이트 제작 · 뷰 테스트용 더미', NULL, 'manual', 'team'),
  ('dummy-uf-007', '메인 사이트 오픈', 'kim-riwon', 'kim-riwon', 'dummy-prj-unrealfest', '2026-07-06T10:00:00+09:00', '2026-07-06T11:00:00+09:00', 'scheduled', 'normal', '웹사이트 제작 · 뷰 테스트용 더미', NULL, 'manual', 'team'),
  ('dummy-uf-008', 'CM 수정', 'lee-hyejin', 'lee-hyejin', 'dummy-prj-unrealfest', '2026-07-07T10:00:00+09:00', '2026-07-07T12:00:00+09:00', 'scheduled', 'normal', '광고 디자인 · 뷰 테스트용 더미', NULL, 'manual', 'team'),
  ('dummy-uf-009', 'CM 제작', 'hwang-sunghyeon', 'hwang-sunghyeon', 'dummy-prj-unrealfest', '2026-07-08T10:00:00+09:00', '2026-07-08T11:00:00+09:00', 'scheduled', 'normal', '광고 디자인 · 뷰 테스트용 더미', NULL, 'manual', 'team'),
  ('dummy-uf-010', 'CM 스타일 초안', 'oh-seunghoon', 'oh-seunghoon', 'dummy-prj-unrealfest', '2026-07-09T10:00:00+09:00', '2026-07-09T12:00:00+09:00', 'scheduled', 'normal', '광고 디자인 · 뷰 테스트용 더미', NULL, 'manual', 'team'),
  ('dummy-uf-011', '카카오톡 채널 친구', 'hwang-sungjin', 'hwang-sungjin', 'dummy-prj-unrealfest', '2026-07-10T10:00:00+09:00', '2026-07-10T11:00:00+09:00', 'done', 'high', '홍보 발송 · 뷰 테스트용 더미', NULL, 'manual', 'team'),
  ('dummy-uf-012', '뉴스레터 - BIC 1차', 'park-seunghwan', 'park-seunghwan', 'dummy-prj-unrealfest', '2026-07-13T10:00:00+09:00', '2026-07-13T12:00:00+09:00', 'done', 'normal', '홍보 발송 · 뷰 테스트용 더미', NULL, 'manual', 'team'),
  ('dummy-uf-013', '뉴스레터 - 그리프 2차', 'song-suyong', 'song-suyong', 'dummy-prj-unrealfest', '2026-07-14T10:00:00+09:00', '2026-07-14T11:00:00+09:00', 'done', 'normal', '홍보 발송 · 뷰 테스트용 더미', NULL, 'manual', 'team'),
  ('dummy-uf-014', '뉴스레터 - 인프라정보기술', 'lee-yejin', 'lee-yejin', 'dummy-prj-unrealfest', '2026-07-15T10:00:00+09:00', '2026-07-15T12:00:00+09:00', 'in_progress', 'normal', '홍보 발송 · 뷰 테스트용 더미', NULL, 'manual', 'team'),
  ('dummy-uf-015', '뉴스레터 - 그리프 3차(온라인 무료등록)', 'kim-riwon', 'kim-riwon', 'dummy-prj-unrealfest', '2026-07-16T10:00:00+09:00', '2026-07-16T11:00:00+09:00', 'in_progress', 'normal', '홍보 발송 · 뷰 테스트용 더미', NULL, 'manual', 'team'),
  ('dummy-uf-016', '현재 DB 문자 메시지 발송 (전야 안내 문자) 8000명 규모', 'lee-hyejin', 'lee-hyejin', 'dummy-prj-unrealfest', '2026-07-17T10:00:00+09:00', '2026-07-17T12:00:00+09:00', 'scheduled', 'high', '홍보 발송 · 뷰 테스트용 더미', NULL, 'manual', 'team'),
  ('dummy-uf-017', '감사 발송', 'hwang-sunghyeon', 'hwang-sunghyeon', 'dummy-prj-unrealfest', '2026-06-29T12:00:00+09:00', '2026-06-29T13:00:00+09:00', 'scheduled', 'normal', '홍보 발송 · 뷰 테스트용 더미', NULL, 'manual', 'team'),
  ('dummy-uf-018', '1차 광고 에셋 런칭', 'oh-seunghoon', 'oh-seunghoon', 'dummy-prj-unrealfest', '2026-06-30T12:00:00+09:00', '2026-06-30T14:00:00+09:00', 'scheduled', 'normal', '광고 디자인 · 뷰 테스트용 더미', NULL, 'manual', 'team'),
  ('dummy-uf-019', '3차 광고 에셋 런칭', 'hwang-sungjin', 'hwang-sungjin', 'dummy-prj-unrealfest', '2026-07-01T12:00:00+09:00', '2026-07-01T13:00:00+09:00', 'scheduled', 'normal', '광고 디자인 · 뷰 테스트용 더미', NULL, 'manual', 'team'),
  ('dummy-uf-020', '스테이지 디자인 제작', 'park-seunghwan', 'park-seunghwan', 'dummy-prj-unrealfest', '2026-07-02T12:00:00+09:00', '2026-07-02T14:00:00+09:00', 'scheduled', 'normal', '중계 · 뷰 테스트용 더미', NULL, 'manual', 'team'),
  ('dummy-uf-021', '공간구성안 초안', 'song-suyong', 'song-suyong', 'dummy-prj-unrealfest', '2026-07-03T12:00:00+09:00', '2026-07-03T13:00:00+09:00', 'done', 'high', '공간 디자인 · 뷰 테스트용 더미', NULL, 'manual', 'team'),
  ('dummy-uf-022', '브랜딩 디자인 2차 컨펌', 'lee-yejin', 'lee-yejin', 'dummy-prj-unrealfest', '2026-07-05T12:00:00+09:00', '2026-07-05T14:00:00+09:00', 'done', 'normal', '공간 디자인 · 뷰 테스트용 더미', NULL, 'manual', 'team'),
  ('dummy-uf-023', '굿즈 샘플 제작', 'kim-riwon', 'kim-riwon', 'dummy-prj-unrealfest', '2026-07-06T12:00:00+09:00', '2026-07-06T13:00:00+09:00', 'in_progress', 'normal', '굿즈 디자인 · 뷰 테스트용 더미', NULL, 'manual', 'team'),
  ('dummy-uf-024', '스폰서 부스가이드 배포', 'lee-hyejin', 'lee-hyejin', 'dummy-prj-unrealfest', '2026-07-07T12:00:00+09:00', '2026-07-07T14:00:00+09:00', 'done', 'normal', '운영 · 뷰 테스트용 더미', NULL, 'manual', 'team'),
  ('dummy-uf-025', '행사 보험 가입', 'hwang-sunghyeon', 'hwang-sunghyeon', 'dummy-prj-unrealfest', '2026-07-08T12:00:00+09:00', '2026-07-08T13:00:00+09:00', 'done', 'normal', '운영 · 뷰 테스트용 더미', NULL, 'manual', 'team'),
  ('dummy-uf-026', '조명업체 섭외', 'oh-seunghoon', 'oh-seunghoon', 'dummy-prj-unrealfest', '2026-07-09T12:00:00+09:00', '2026-07-09T14:00:00+09:00', 'scheduled', 'high', '운영 · 뷰 테스트용 더미', NULL, 'manual', 'team'),
  ('dummy-uf-027', '현장 세팅 리스트 작성', 'hwang-sungjin', 'hwang-sungjin', 'dummy-prj-unrealfest', '2026-07-10T12:00:00+09:00', '2026-07-10T13:00:00+09:00', 'scheduled', 'normal', '현장 세팅 · 뷰 테스트용 더미', NULL, 'manual', 'team'),
  ('dummy-uf-028', '중계 시즐릴 세팅', 'park-seunghwan', 'park-seunghwan', 'dummy-prj-unrealfest', '2026-07-13T12:00:00+09:00', '2026-07-13T14:00:00+09:00', 'scheduled', 'normal', '현장 세팅 · 뷰 테스트용 더미', NULL, 'manual', 'team'),
  ('dummy-uf-029', '오프라인 중계 오전 리허설', 'song-suyong', 'song-suyong', 'dummy-prj-unrealfest', '2026-07-14T12:00:00+09:00', '2026-07-14T13:00:00+09:00', 'scheduled', 'normal', '현장 세팅 · 뷰 테스트용 더미', NULL, 'manual', 'team'),
  ('dummy-uf-030', '아르바이트 배치&세팅', 'lee-yejin', 'lee-yejin', 'dummy-prj-unrealfest', '2026-07-15T12:00:00+09:00', '2026-07-15T14:00:00+09:00', 'scheduled', 'normal', '현장 세팅 · 뷰 테스트용 더미', NULL, 'manual', 'team'),
  ('dummy-uf-031', '출입 세팅', 'kim-riwon', 'kim-riwon', 'dummy-prj-unrealfest', '2026-07-16T12:00:00+09:00', '2026-07-16T13:00:00+09:00', 'done', 'high', '현장 세팅 · 뷰 테스트용 더미', NULL, 'manual', 'team'),
  ('dummy-uf-032', '1DAY', 'lee-hyejin', 'lee-hyejin', 'dummy-prj-unrealfest', '2026-07-17T12:00:00+09:00', '2026-07-17T14:00:00+09:00', 'done', 'normal', '행사 · 뷰 테스트용 더미', NULL, 'manual', 'team'),
  ('dummy-uf-033', '강연 편집', 'hwang-sunghyeon', 'hwang-sunghyeon', 'dummy-prj-unrealfest', '2026-06-29T14:00:00+09:00', '2026-06-29T15:00:00+09:00', 'done', 'normal', '추후 진행 · 뷰 테스트용 더미', NULL, 'manual', 'team'),
  ('dummy-uf-034', '이벤트 굿즈 발송', 'oh-seunghoon', 'oh-seunghoon', 'dummy-prj-unrealfest', '2026-06-30T14:00:00+09:00', '2026-06-30T16:00:00+09:00', 'in_progress', 'normal', '추후 진행 · 뷰 테스트용 더미', NULL, 'manual', 'team'),
  ('dummy-mw-001', '애셋 전달', 'hwang-sungjin', 'hwang-sungjin', 'dummy-prj-mendix-webinar', '2026-07-01T14:00:00+09:00', '2026-07-01T15:00:00+09:00', 'in_progress', 'normal', '키이미지 · 뷰 테스트용 더미', NULL, 'manual', 'team'),
  ('dummy-mw-002', '키이미지 초안 제작', 'park-seunghwan', 'park-seunghwan', 'dummy-prj-mendix-webinar', '2026-07-02T14:00:00+09:00', '2026-07-02T16:00:00+09:00', 'scheduled', 'high', '키이미지 · 뷰 테스트용 더미', 56, 'manual', 'team'),
  ('dummy-mw-003', '기본 키이미지 제작', 'song-suyong', 'song-suyong', 'dummy-prj-mendix-webinar', '2026-07-03T14:00:00+09:00', '2026-07-03T15:00:00+09:00', 'scheduled', 'normal', '키이미지 · 뷰 테스트용 더미', 24, 'manual', 'team'),
  ('dummy-mw-004', '멘딕스 웨비나 사이트 내용 전달', 'lee-yejin', 'lee-yejin', 'dummy-prj-mendix-webinar', '2026-07-05T14:00:00+09:00', '2026-07-05T16:00:00+09:00', 'scheduled', 'normal', '사이트 · 뷰 테스트용 더미', NULL, 'manual', 'team'),
  ('dummy-mw-005', '사이트 디자인 초안 제작', 'kim-riwon', 'kim-riwon', 'dummy-prj-mendix-webinar', '2026-07-06T14:00:00+09:00', '2026-07-06T15:00:00+09:00', 'scheduled', 'normal', '사이트 · 뷰 테스트용 더미', 56, 'manual', 'team'),
  ('dummy-mw-006', '사이트 디자인 제작 / 코딩&수정', 'lee-hyejin', 'lee-hyejin', 'dummy-prj-mendix-webinar', '2026-07-07T14:00:00+09:00', '2026-07-07T16:00:00+09:00', 'scheduled', 'normal', '사이트 · 뷰 테스트용 더미', 56, 'manual', 'team'),
  ('dummy-mw-007', '사이트 내부오픈', 'hwang-sunghyeon', 'hwang-sunghyeon', 'dummy-prj-mendix-webinar', '2026-07-08T14:00:00+09:00', '2026-07-08T15:00:00+09:00', 'done', 'high', '사이트 · 뷰 테스트용 더미', 16, 'manual', 'team'),
  ('dummy-mw-008', '사이트 런칭 / 행사 페이지 오픈', 'oh-seunghoon', 'oh-seunghoon', 'dummy-prj-mendix-webinar', '2026-07-09T14:00:00+09:00', '2026-07-09T16:00:00+09:00', 'done', 'normal', '사이트 · 뷰 테스트용 더미', 8, 'manual', 'team'),
  ('dummy-mw-009', '뉴스레터 애셋 전달', 'hwang-sungjin', 'hwang-sungjin', 'dummy-prj-mendix-webinar', '2026-07-10T14:00:00+09:00', '2026-07-10T15:00:00+09:00', 'done', 'normal', '웨비나 홍보애셋 · 뷰 테스트용 더미', NULL, 'manual', 'team'),
  ('dummy-mw-010', '뉴스레터 제작', 'park-seunghwan', 'park-seunghwan', 'dummy-prj-mendix-webinar', '2026-07-13T14:00:00+09:00', '2026-07-13T16:00:00+09:00', 'in_progress', 'normal', '웨비나 홍보애셋 · 뷰 테스트용 더미', 56, 'manual', 'team'),
  ('dummy-mw-011', '뉴스레터 수정', 'song-suyong', 'song-suyong', 'dummy-prj-mendix-webinar', '2026-07-14T14:00:00+09:00', '2026-07-14T15:00:00+09:00', 'in_progress', 'normal', '웨비나 홍보애셋 · 뷰 테스트용 더미', 32, 'manual', 'team'),
  ('dummy-mw-012', '뉴스레터 런칭', 'lee-yejin', 'lee-yejin', 'dummy-prj-mendix-webinar', '2026-07-15T14:00:00+09:00', '2026-07-15T16:00:00+09:00', 'scheduled', 'high', '웨비나 홍보애셋 · 뷰 테스트용 더미', 8, 'manual', 'team'),
  ('dummy-mw-013', '홍보 배너 애셋 전달', 'kim-riwon', 'kim-riwon', 'dummy-prj-mendix-webinar', '2026-07-16T14:00:00+09:00', '2026-07-16T15:00:00+09:00', 'scheduled', 'normal', '웨비나 홍보애셋 · 뷰 테스트용 더미', NULL, 'manual', 'team'),
  ('dummy-mw-014', '홍보 배너 디자인 초안 제작', 'lee-hyejin', 'lee-hyejin', 'dummy-prj-mendix-webinar', '2026-07-17T14:00:00+09:00', '2026-07-17T16:00:00+09:00', 'scheduled', 'normal', '웨비나 홍보애셋 · 뷰 테스트용 더미', 56, 'manual', 'team'),
  ('dummy-mw-015', '홍보 배너 디자인 수정', 'hwang-sunghyeon', 'hwang-sunghyeon', 'dummy-prj-mendix-webinar', '2026-06-29T16:00:00+09:00', '2026-06-29T17:00:00+09:00', 'scheduled', 'normal', '웨비나 홍보애셋 · 뷰 테스트용 더미', 32, 'manual', 'team'),
  ('dummy-mw-016', '홍보 배너 런칭', 'oh-seunghoon', 'oh-seunghoon', 'dummy-prj-mendix-webinar', '2026-06-30T16:00:00+09:00', '2026-06-30T18:00:00+09:00', 'scheduled', 'normal', '웨비나 홍보애셋 · 뷰 테스트용 더미', 8, 'manual', 'team'),
  ('dummy-mw-017', '이벤트 기획 전달', 'hwang-sungjin', 'hwang-sungjin', 'dummy-prj-mendix-webinar', '2026-07-01T16:00:00+09:00', '2026-07-01T17:00:00+09:00', 'done', 'high', '이벤트 애셋 · 뷰 테스트용 더미', 56, 'manual', 'team'),
  ('dummy-mw-018', '이벤트 최종 세팅', 'park-seunghwan', 'park-seunghwan', 'dummy-prj-mendix-webinar', '2026-07-02T16:00:00+09:00', '2026-07-02T18:00:00+09:00', 'done', 'normal', '이벤트 애셋 · 뷰 테스트용 더미', 16, 'manual', 'team'),
  ('dummy-mw-019', '스테이지 디자인', 'song-suyong', 'song-suyong', 'dummy-prj-mendix-webinar', '2026-07-03T16:00:00+09:00', '2026-07-03T17:00:00+09:00', 'done', 'normal', '중계 · 뷰 테스트용 더미', 56, 'manual', 'team'),
  ('dummy-mw-020', '스튜디오 세팅 & PC 세팅', 'lee-yejin', 'lee-yejin', 'dummy-prj-mendix-webinar', '2026-07-05T16:00:00+09:00', '2026-07-05T18:00:00+09:00', 'in_progress', 'normal', '중계 · 뷰 테스트용 더미', 8, 'manual', 'team'),
  ('dummy-mw-021', '내부 중계 최종 세팅', 'kim-riwon', 'kim-riwon', 'dummy-prj-mendix-webinar', '2026-07-06T16:00:00+09:00', '2026-07-06T17:00:00+09:00', 'in_progress', 'normal', '중계 · 뷰 테스트용 더미', 8, 'manual', 'team'),
  ('dummy-mw-022', '리허설', 'lee-hyejin', 'lee-hyejin', 'dummy-prj-mendix-webinar', '2026-07-07T16:00:00+09:00', '2026-07-07T18:00:00+09:00', 'scheduled', 'high', '중계 · 뷰 테스트용 더미', 8, 'manual', 'team'),
  ('dummy-mw-023', '중계', 'hwang-sunghyeon', 'hwang-sunghyeon', 'dummy-prj-mendix-webinar', '2026-07-08T16:00:00+09:00', '2026-07-08T17:00:00+09:00', 'scheduled', 'normal', '중계 · 뷰 테스트용 더미', 8, 'manual', 'team'),
  ('dummy-mw-024', '다시보기 오픈', 'oh-seunghoon', 'oh-seunghoon', 'dummy-prj-mendix-webinar', '2026-07-09T16:00:00+09:00', '2026-07-09T18:00:00+09:00', 'scheduled', 'normal', '다시보기 · 뷰 테스트용 더미', NULL, 'manual', 'team');
