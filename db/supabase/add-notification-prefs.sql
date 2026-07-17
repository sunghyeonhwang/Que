-- 알림 개인 설정 — 리듬성(정기) 개인 DM만 개인이 끌 수 있게 하는 muted 목록.
-- 배경: 개인 DM 종류가 21종으로 늘며 과부하 우려 → 리듬성 알림(아침 브리핑·스탠드업 오픈/재촉·
--       체크인 재촉)만 개인이 off할 수 있고, 트랜잭셔널(결제·회의록·크라이시스·도움 등)과
--       팀채널 게시는 대상이 아니다(당사자 응답이 필요하거나 개인 설정이 무의미하므로).
-- ✅ 적용 완료(2026-07-17, supabase 마이그레이션 `add_notification_prefs` — RLS 포함). 아래는 기록용.
--          직접 적용한다. additive만 담았고 재적용 안전(if not exists). 코드는 테이블 부재에도
--          우아하게 실패(fail-open — 빈 Set, 아무도 못 끔)하도록 작성됨 → 배포 순서 자유.
-- 격리: 이 테이블은 core 도메인 스냅샷 밖이다. SupabaseQueDb.persist에 절대 편입하지 말 것
--       (webauthn_credentials·personal_access_tokens와 동일 선례 — 전용 admin 클라이언트 직조회로만 접근).
-- 참고: users.id 는 schema.sql 기준 text primary key → user_id 도 text로 맞춘다.

-- 유저별 알림 개인 설정. muted_kinds는 콤마 CSV(예: "personal_digest,standup_remind").
-- ⚠️ MUTABLE 화이트리스트(prefs.ts MUTABLE_KINDS)에 있는 kind만 저장 허용 — 코드가 저장/조회 양쪽에서
--    화이트리스트 필터로 강제한다(조작 방어). DB는 CSV 문자열만 보관(kind 제약은 코드가 소유).
create table if not exists notification_prefs (
  user_id     text primary key references users(id) on delete cascade,
  muted_kinds text not null default '',            -- 끈 알림 kind 콤마 CSV(빈 문자열=아무것도 안 끔)
  updated_at  timestamptz not null default now()
);

-- RLS 활성(정책 없음). Que는 service role 키로만 접근 → RLS 우회, anon/authenticated 경로만 차단.
-- (enable-rls-remaining.sql 선례 — 재실행 안전.)
alter table notification_prefs enable row level security;
