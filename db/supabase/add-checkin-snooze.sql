-- Que — 체크인 스누즈(snooze_until) 추가 마이그레이션 (additive)
-- 기준: packages/core/src/domain.ts checkInSchema.snoozeUntil
-- 성격: 무파괴 additive. nullable 컬럼 추가만.
--
-- ⚠️ 이 컬럼은 이미 프로덕션에 적용됨(사용자 확인). 이 파일은 프레시 설치·기록용이며
--    프로덕션에 다시 적용하지 않는다. (if not exists라 재적용해도 무해하다.)
--
-- 의미: '나중에(later)' 응답 시 다시 물어볼 시각. 이 시각이 지날 때까지 오늘 화면의
--       응답 대기 체크인과 팀 현황의 '응답대기' 집계에서 제외되고, 지나면 자동으로 재노출된다.
--       상한 48시간은 애플리케이션(core mutation answerCheckIn)에서 강제한다.

alter table check_ins add column if not exists snooze_until timestamptz;
