-- projects.description 추가 — PM 도구(/projects) 프로젝트 설명 저장용.
-- 이미 프로덕션에 적용됨(기록용). 재적용 금지 — add column if not exists라 재실행해도 무해하다.
--
-- core(createProject/updateProject)가 2000자 상한을 검증/절단으로 강제하지만,
-- 다른 경로(직접 SQL·향후 어댑터)에서도 새지 않도록 DB도 동일 상한을 방어한다
-- (tasks.description / recurring_templates.description 선례와 동일).
alter table projects
  add column if not exists description text check (char_length(description) <= 2000);
