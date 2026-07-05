-- 배치4 항목 16 — 회의록 다중 프로젝트(주간회의 등 여러 프로젝트 아젠다).
-- 무파괴: 기존 project_id(단일 대표값)는 유지하고 project_ids(배열)를 additive로 추가한다.
-- core는 projectIds[0]을 project_id와 항상 일치시키므로 하위호환 목록/필터가 깨지지 않는다.
-- 적용은 메인에서 수행한다(이 파일은 준비만).
--
-- nullable로 둔다: core의 upsert 경로(toRow)가 projectIds 미지정 회의록을 null로 보내므로
-- not-null이면 시드/persist가 깨진다. null=미지정으로 취급한다(fromRow가 undefined로 되돌림).

alter table meeting_notes
  add column if not exists project_ids text[] default '{}';

-- 기존 행: 단일 project_id가 있으면 배열에도 채운다(비어 있지 않은 경우만).
update meeting_notes
  set project_ids = array[project_id]
  where project_id is not null
    and (project_ids is null or array_length(project_ids, 1) is null);
