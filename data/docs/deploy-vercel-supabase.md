# Que 배포 가이드 — Vercel + Supabase

마지막 업데이트: 2026-07-03
상태: **Supabase DB 연동 완료** — 실 프로젝트(`rnsqhipljpdmmkviiypy`)에 스키마·시드 적용됐고, 앱이 `QUE_DB=supabase`로 실 DB를 읽고 쓴다(로컬 검증 완료). 남은 것은 Vercel 배포 + 실 인증.

## 완료된 준비

- ✅ **mock 인증 배포 가드** — production 빌드에서 `QUE_ALLOW_MOCK_AUTH=true` 옵트인 없이는 웹/API 인증이 전부 차단된다 (`lib/mock-auth-guard.ts`). 실수로 공개 배포해도 계좌/데이터가 노출되지 않는 fail-safe.
- ✅ **API 입력 상한** — 본문 100KB(413), 필드 길이 상한(제목 200자, 사유 500자, 회의록 500,000자, 금액 ≤1조 등)은 core에서 강제.
- ✅ **Supabase 스키마 + 시드 적용됨** — `db/supabase/schema.sql`(14테이블: 13 도메인 + PAT). 실 프로젝트에 마이그레이션(`db/supabase/migrate-fresh.sql`)·시드(`db/supabase/seed.mts`) 완료.
- ✅ **RLS 활성화됨 (2026-07-03)** — 14개 테이블 전부 `ENABLE ROW LEVEL SECURITY`(정책 없음). 앱은 `SUPABASE_SECRET_KEY`(service_role급)로만 접근해 RLS를 우회하므로 무영향, publishable/anon 키를 통한 PostgREST 직접 접근(계좌번호 등)은 차단됨. 실측: secret 키 조회 정상 / anon 키 조회 `[]`. Supabase 보안 어드바이저 critical 3종(rls_disabled·sensitive_columns_exposed·function_search_path) 해소. **주의: `schema.sql`은 아직 이 RLS 구문을 포함하지 않음 — DB 재생성 시 `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`를 다시 적용할 것.**
- ✅ **Supabase 어댑터 완성** — `apps/web/src/lib/supabase-db.ts`의 `SupabaseQueDb`(MockQueDb 상속, 요청마다 스냅샷 load → mutation 후 diff persist). `QUE_DB=supabase` + `SUPABASE_URL` + `SUPABASE_SECRET_KEY` 있으면 활성, 없으면 mock. 도메인↔행 매핑은 `packages/core/src/data/supabase-rows.ts`.
- ✅ Vercel 빌드 호환 — pnpm 모노레포(`packageManager` 명시), Next.js 16, `turbopack.root` 설정.

## 배포 체크리스트

### 1단계 — 데모 배포 (env 도착 즉시 가능, DB 없이)

인메모리 mock 그대로 올리는 "구경용" 배포. 서버리스 특성상 상태 변경은 인스턴스별/재시작마다 초기화된다는 걸 팀에 공지할 것.

1. ⏳ Vercel 프로젝트 생성 — GitHub `sunghyeonhwang/Que` 연결
2. ⏳ **Root Directory: `apps/web`** (Framework: Next.js 자동 인식)
2-1. ⏳ **리전: 인천(`icn1`) — 필수.** Settings > Functions > Function Region을 **Seoul, South Korea (icn1)** 로 지정하거나, `apps/web/vercel.json`에 `{ "regions": ["icn1"] }`를 둔다. Supabase 프로젝트도 서울(`ap-northeast-2`)이라 DB와 같은 리전에 두어야 왕복 지연이 최소화된다.
3. ⏳ 환경 변수: `QUE_ALLOW_MOCK_AUTH=true`
4. ⏳ **Settings > Deployment Protection 활성화 (필수)** — mock 인증은 누구나 사용자 전환이 가능하므로 Protection 없이 절대 공개하지 않는다
5. ⏳ 배포 후 확인: `/` 접속(역할별 리다이렉트), `QUE_ALLOW_MOCK_AUTH` 없이 재배포하면 503으로 잠기는지

### 2단계 — 실사용 배포 (Supabase 연동)

1. ✅ Supabase 스키마·시드 적용 완료 (마이그레이션: `node db/supabase/run-migration.mjs`, 시드: `pnpm --filter @que/core exec tsx db/supabase/seed.mts` — 둘 다 `data/.env`의 pooler 연결 사용). 재시드하면 정본 상태로 리셋됨.
2. ✅ Supabase 어댑터 완성(위 "완료된 준비" 참고). DDL은 pooler 직결, 런타임은 supabase-js(PostgREST).
3. ⏳ Vercel 환경 변수:
   | 변수 | 값 | 비고 |
   | --- | --- | --- |
   | `QUE_DB` | `supabase` | 없으면 mock으로 동작 |
   | `SUPABASE_URL` | Supabase 프로젝트 URL | |
   | `SUPABASE_SECRET_KEY` | secret 키(`sb_secret_...`) | **서버 전용 — `NEXT_PUBLIC_` 금지** |
   | `AUTH_SECRET` | 랜덤 32바이트 base64 (`openssl rand -base64 32`) | **Auth.js 세션 서명 — 필수.** 로컬은 `data/.env`에 있음 |
   | `QUE_ALLOW_MOCK_AUTH` | `true` (API/MCP/CLI의 mock PAT 경로 게이트) | **웹 로그인은 이제 실 인증이라 이 값과 무관.** PAT 해시화(B2) 완료 후 제거 |
4. ✅ **웹 실 인증 완료 (Auth.js, 이메일+비밀번호)** — `getCurrentUser`가 세션을 읽고 미인증 시 `/login`으로 리다이렉트. 8명 계정은 `<이름>.<성>@griff.co.kr` + 초기 공용 비밀번호 `que-2026!`(bcrypt, DB 저장). **첫 로그인 강제 변경/개별 비밀번호는 후속(B2).** ⏳ 남은 것: API/MCP/CLI의 mock PAT를 무작위 발급 + `personal_access_tokens` 테이블(해시)로 교체(`core/mock/tokens.ts` 폐기) — 이게 되면 `QUE_ALLOW_MOCK_AUTH` 제거.
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
