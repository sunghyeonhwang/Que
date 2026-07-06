-- payment_requests.recipient_name 추가 — 결제요청 "입금받을 곳"(상호/사람/기관명) 저장용.
-- 무파괴 additive 마이그레이션. 아직 프로덕션 미적용 — 메인에서 적용한다.
-- add column if not exists라 재실행해도 무해하다.
--
-- core(createPaymentRequest)가 100자 상한을 검증으로 강제하지만,
-- 다른 경로(직접 SQL·향후 어댑터)에서도 새지 않도록 DB도 동일 상한을 방어한다
-- (bank_name/account_number 등 선례와 동일). 기존 행은 null로 남는다(선택 필드).
alter table payment_requests
  add column if not exists recipient_name text check (char_length(recipient_name) <= 100);
