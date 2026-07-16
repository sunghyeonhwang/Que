-- 패스키(WebAuthn) 로그인 — 이메일+비밀번호와 공존하는 추가 로그인 옵션.
-- ⚠️ 적용: 아직 프로덕션 미적용. 사람이 Supabase Dashboard > SQL Editor(또는 `supabase db push`)로
--         직접 적용한다. additive만 담았고 재적용 안전(if not exists). 코드는 테이블 부재에도
--         우아하게 실패(로그인/등록만 막히고 기존 인증은 무영향)하도록 작성됨 — 배포 순서 자유.
-- 격리: 이 테이블들은 core 도메인 스냅샷 밖이다. SupabaseQueDb.persist에 절대 편입하지 말 것
--       (personal_access_tokens와 동일 선례 — 전용 admin 클라이언트 직조회로만 접근).
-- 참고: users.id 는 schema.sql 기준 text primary key → user_id 도 text로 맞춘다.

-- 등록된 인증기(패스키) 원장. credential.id(base64url)를 PK로 둔다.
create table if not exists webauthn_credentials (
  id           text primary key,                       -- credential id (base64url)
  user_id      text not null references users(id) on delete cascade,
  public_key   text not null,                          -- COSE public key (base64url 인코딩 저장)
  counter      bigint not null default 0,              -- 서명 카운터(리플레이 방지 — 로그인마다 갱신)
  transports   text,                                   -- 콤마 CSV(usb,nfc,ble,internal,hybrid) nullable
  device_name  text not null default '내 기기',        -- 사용자 지정 라벨(관리 화면 표시)
  created_at   timestamptz not null default now(),
  last_used_at timestamptz
);
create index if not exists idx_webauthn_credentials_user on webauthn_credentials (user_id);

-- 원타임 로그인 토큰(패스키 verify → Auth.js 교환) 재사용 방지 원장.
-- jti를 PK로 insert → 충돌(23505)이면 이미 사용된 토큰(리플레이) → 로그인 거부.
-- 오래된 행(5분 초과)은 verify 시 opportunistic delete로 정리(별도 크론 불필요).
create table if not exists webauthn_login_nonces (
  jti        text primary key,
  created_at timestamptz not null default now()
);
