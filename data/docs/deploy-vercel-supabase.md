# Que 배포 가이드 — Vercel + Supabase

마지막 업데이트: 2026-07-02
상태: **준비 단계** — env(Supabase 키) 수령 전. env 없이 가능한 준비는 완료됐고, 아래 체크리스트의 ⏳ 항목이 env 도착 후 작업이다.

## 완료된 준비 (env 불필요)

- ✅ **mock 인증 배포 가드** — production 빌드에서 `QUE_ALLOW_MOCK_AUTH=true` 옵트인 없이는 웹/API 인증이 전부 차단된다 (`lib/mock-auth-guard.ts`). 실수로 공개 배포해도 계좌/데이터가 노출되지 않는 fail-safe.
- ✅ **API 입력 상한** — 본문 100KB(413), 필드 길이 상한(제목 200자, 사유 500자, 회의록 500,000자, 금액 ≤1조 등)은 core에서 강제.
- ✅ **Supabase 스키마** — `db/supabase/schema.sql` (테이블 12종 + PAT 테이블 + 인덱스. 서버가 service_role로만 접근하는 전제라 RLS 미사용).
- ✅ Vercel 빌드 호환 — pnpm 모노레포(`packageManager` 명시), Next.js 16, `turbopack.root` 설정.

## 배포 체크리스트

### 1단계 — 데모 배포 (env 도착 즉시 가능, DB 없이)

인메모리 mock 그대로 올리는 "구경용" 배포. 서버리스 특성상 상태 변경은 인스턴스별/재시작마다 초기화된다는 걸 팀에 공지할 것.

1. ⏳ Vercel 프로젝트 생성 — GitHub `sunghyeonhwang/Que` 연결
2. ⏳ **Root Directory: `apps/web`** (Framework: Next.js 자동 인식)
3. ⏳ 환경 변수: `QUE_ALLOW_MOCK_AUTH=true`
4. ⏳ **Settings > Deployment Protection 활성화 (필수)** — mock 인증은 누구나 사용자 전환이 가능하므로 Protection 없이 절대 공개하지 않는다
5. ⏳ 배포 후 확인: `/` 접속(역할별 리다이렉트), `QUE_ALLOW_MOCK_AUTH` 없이 재배포하면 503으로 잠기는지

### 2단계 — 실사용 배포 (Supabase 연동)

1. ⏳ Supabase 프로젝트 생성 → SQL Editor에서 `db/supabase/schema.sql` 실행
2. ⏳ **코드 작업: Supabase 어댑터** — `QueDb` 인터페이스(packages/core)를 구현하는 `SupabaseQueDb` 작성, `apps/web/src/lib/db.ts`의 `getDb()`에서 env 존재 시 교체. 시드 스크립트(`pnpm seed` — core `createSeed` 데이터를 insert).
3. ⏳ Vercel 환경 변수:
   | 변수 | 값 | 비고 |
   | --- | --- | --- |
   | `SUPABASE_URL` | Supabase 프로젝트 URL | |
   | `SUPABASE_SERVICE_ROLE_KEY` | service_role 키 | **서버 전용 — `NEXT_PUBLIC_` 금지** |
   | `QUE_ALLOW_MOCK_AUTH` | (제거) | 실 인증 도입 후 제거 |
4. ⏳ **실 인증** — Auth.js 도입, mock 쿠키 전환기 제거, PAT를 무작위 발급 + `personal_access_tokens` 테이블(해시 저장)로 교체 (`core/mock/tokens.ts` 폐기)
4-1. ⏳ **체크인 스케줄러 Cron 전환** — 현재는 `getDb()` 접근 시 lazy 실행(`syncCheckIns`). 서버리스에서는 아무도 접근하지 않는 시간대에 체크인이 늦게 생성되므로, Vercel Cron(`vercel.json`의 crons, 예: 10분 간격)으로 `/api/cron/sync-checkins` 엔드포인트를 호출하게 전환한다 (lazy 실행은 이중 안전망으로 유지 — 멱등이므로 충돌 없음).
5. ⏳ MCP/CLI 전환 — `.mcp.json`/`~/.que/config.json`의 `QUE_API_URL`을 배포 URL로

### 배포 후 검증 (글래도스 게이트 항목)

- [ ] 옵트인 없는 production에서 웹/API 전부 차단(503)
- [ ] 서로 다른 두 사용자 토큰으로 결제 마스킹 바이트 검사
- [ ] 상태 변경이 재요청/새 인스턴스에서도 유지 (DB 연동 확인)
- [ ] 100KB 초과 본문 413

## 알려진 제약 (1단계 데모 한정)

- 인메모리 DB: 인스턴스마다 상태가 다르고 콜드 스타트마다 시드로 초기화 — 쓰기 기능 시연 불가
- 시드가 실행 시점 상대 날짜라 인스턴스 간 날짜 불일치 가능
