# Que 로드맵 — 기획 + 개발 계획 (2026-07-04)

실사용(D-7) 이후 남은 로드맵의 항목별 기획·개발계획. 각 섹션은 코드 근거로 작성됐고, **필요한 외부 크레덴셜/결정**을 명시한다.
관련: `HANDOFF.md`(남은 작업), `que-product-plan.md`(기획 기준). 구현은 승인·크레덴셜 확보 후 항목별로.

## 진행 현황 (A 트랙)
- **A-1 비밀번호 보안**(변경·강제변경·관리자 재설정·레이트리밋) — ✅ 완료·배포(글래도스 승인).
- **A-2 개인 비번 배포** — 준비 완료(`gen-passwords.mts`가 `must_change_password=true` 설정 → 첫 로그인 강제 변경). **실행은 개인 비번 확정 후 운영자.**
- **A-3 go-live 데이터 클린업** — ✅ 확인. 프로덕션 거래 테이블 전부 0(데모 시드 없음), users 7·PAT 7.

## 남은 항목 요약 — 무엇이 필요한가

> ⚠️ **아래 원본 표(2026-07-04)는 대부분 완료됐다.** A트랙(비번보안·데이터클린업)·B-2(Cron)·A-4(Sentry 에러캡처)·B-1(Slack Webhook)·Slack Phase 2(개인 DM 브리핑)·Phase 3(할일→담당자 DM)·CLI/MCP·Pro 이전 전부 ✅ 라이브. **현행 남은 일정은 바로 아래 "현황(2026-07-08)" 표가 정본**이다.

### 현황 — 남은 일정 (2026-07-08 정리, 사용자 결정 반영)

| # | 항목 | 상태 | 선행조건 / 트리거 |
| --- | --- | --- | --- |
| **C-1** | 구글캘린더 실연결 전환(더미→실 OAuth) | ⏸ **대기(사용자)** | 더미 청소 먼저 · **여러 항목의 열쇠** |
| — | Slack 전원확대(7명 브리핑 복구 + Phase 3/브리핑 전원 활성) | 🔒 대기 | **C-1 종료 후** · `QUE_DIGEST_RECIPIENTS` 제거+재배포 |
| — | 알림 파이프라인 비차단(outbox 동시크론 race · private task 필터 가드) | 🔒 대기 | **C-1 종료 후**(MCP/CLI 확장 전 권장) |
| **C-2** | Slack Phase 2 인터랙티브(Slack에서 체크인 응답) | 📥 후순위 백로그 | 없음(언제든 착수 가능, 우선순위 낮음) |
| **C-3** | 홈·알림·설정 정식 디자인 | ⏸ **디자인 시안 대기** | 프리뷰 제공(코딩 아님 — 시안 없으면 착수 금지, CLAUDE.md 규칙) |
| A-4↑ | Sentry 소스맵 업로드·트레이싱 | ⏭ **스킵(필요할 때만)** | 읽기 힘든 프로덕션 에러 실제 발생 시 붙임(≈15분) |
| — | 그리프 3·4Q 일정 시트 임포트 | ✋ **수동 처리 중** | 자동화 불요 → 사실상 종결 |

> **핵심: C-1(구글캘린더)이 전체의 열쇠** — 전원확대·알림 비차단이 여기 묶여 있고 현재 사용자 "대기". 그 체인 전체가 함께 멈춤. 지금 착수할 자립 개발 작업은 없음(C-2 저순위·C-3 디자인 대기·Sentry 스킵·시트 수동). **움직이려면 C-1을 풀거나 C-2를 당긴다.**
>
> ~~추천 다음 착수: B-2(Cron)~~ → **완료.** (아래 원본 표·상세는 07-04 참고용)

### D 트랙 — todo_griff(DayBlocks) × Que Task 연동 (2026-07-08 신규, 계획 수립 중)

**배경**: 폰으로 Que 열기는 무리 + 일반 사원은 OKR/할일이 더 요긴 → 별도 앱 `todo_griff`(코드명 **DayBlocks**, `todo.griff.co.kr` + iOS/Android 예정). 현재 상태: **Vite+React PWA, 시간블록 데이 플래너, 완성도 높음 / 단 Que 연동 0%(localStorage 섬)**.

**아키텍처 결정(권장·확인된 근거)**: **"DB 직결" 지양 → "Que REST API 경유" 채택.** Que가 이미 Task 전체를 core mutation+ChangeLog 강제하며 API로 노출(읽기 `/api/tasks·/api/my-day·/api/now`, 쓰기 생성·상태·이동·댓글·재배정·취소). DB 직결은 도메인 규칙 우회 + RLS 정책 0개(anon 차단) + 인증 이중화로 고위험·고비용.

| ID | 항목 | 규모 | 비고 |
| --- | --- | --- | --- |
| **D-1** | Que 모바일 인증 엔드포인트(email+비번→토큰) | 중간 | 🔴 **선결 blocker** — 현재 PAT는 웹 수동 발급뿐(로그인 UX 없음). Supabase Auth(auth.users 7명) 재사용 vs 신설 토큰교환 결정 필요 |
| **D-2** | CORS 허용(todo.griff.co.kr) + `via='mobile'` 태깅 | 작음 | 🔴 PWA(브라우저)면 CORS 없이는 Que API 호출 차단. 감사 출처 'cli' 오기록 해소 |
| **D-3** | DayBlocks ↔ Que Task 동기화 | 큼 | 읽기(`/api/my-day` 오늘 태스크→블록 임포트) + 쓰기(완료/상태) 방향·범위 결정 |
| **D-4** | OKR 데이터 모델 | 중간~큼 | ⚠️ **Que에도 앱에도 없음** — DayBlocks 자체 저장으로 신규 정의(Que는 Task만 제공) |
| **D-5** | 오프라인↔서버 동기화 충돌 정책 | 중간 | 로컬 우선 앱 + 서버 병합 = 충돌 해결 규칙 |
| **D-6** | 네이티브 전환 | 중간 | 현재 PWA → 최단 경로 Capacitor 래핑(vs RN/Expo/네이티브) |
| **보안** | RLS-off 4테이블(clients·revision_notes·payment_categories·notification_outbox) | 작음 | anon 키 쓰는 앱 붙기 전 정책 필요(별건 보안) |

> **선결 순서**: D-1(로그인) · D-2(CORS/via)가 Que 쪽 최소 작업이고 나머지의 전제. D-4(OKR)·D-5(오프라인)·D-6(네이티브)는 앱 쪽 범위. **세부는 사용자 피드백 반영해 확정 예정.**

### E 트랙 — 사용자 피드백 (2026-07-08, 10건 접수)

크게 4묶음. **소·낮은 리스크 = 즉시 배치 가능**, **결정 필요 2건**, **신규 대형 기능 2건(별도 스코핑)**.

**E-A · 빠른 UX 개선 (소, 즉시 배치 가능)**
| ID | 항목 | 근거·비고 |
| --- | --- | --- |
| E-1 | 프로젝트 클라이언트/프로젝트 셀렉트 개선 + **전체 보기** | `project-scope-filters.tsx`. 셀렉트 UX + "전체" 옵션(현 ALL_CLIENTS 스코프 노출 개선) |
| E-2 | 목록/보드 뷰 **완료 버튼**(컨페티) | 기존 `components/app/done-circle.tsx`(+`confetti.ts`) 재사용 — /projects `task-done-toggle`(체크박스)를 DoneCircle로 교체/추가 |
| E-3 | **전체화면 버튼** | 진짜 fullscreen 없음(신규). 캘린더/보드/성과/Gantt에 `requestFullscreen` 토글 |
| E-4 | CLI **명령어별 복사 버튼** | `/tools`. 현재 블록 전체 복사(불필요분 포함) → 명령어 단위 복사로 분할 |

**E-B · 도움말/온보딩 (소)**
| ID | 항목 | 근거·비고 |
| --- | --- | --- |
| E-5 | **일정 vs 캘린더 차이 설명** | `/schedule`(일정=회사+개인 일정)와 `/projects` 캘린더 뷰(프로젝트 태스크)가 공존 → 혼동. 도움말 항목 + 라벨 명확화 검토 |
| E-6 | **반복·마일스톤 사용법/이유** | `/planning` 도움말 섹션 보강(왜·어떻게) |

**E-C · 결정 완료 (2026-07-08 사용자 확정)**
| ID | 항목 | 결정 |
| --- | --- | --- |
| E-7 | MCP 연결 시 **PAT 포함 완전 명령어 복사** | ✅ **실 PAT 항상 노출**(미노출 정책 해제). `/tools`에서 토큰 포함 완전 명령어 복사. ⚠️ 잔여 위험(화면·클립보드 유출) 완화책: 발급 토큰을 **Task 범위로 스코프**해 blast radius 축소 권장 |
| E-8 | 버튼/키컬러 **파스텔 톤** 변경 | ✅ **상태 5색(green/blue/amber/red/violet) 의미 고정 유지 + 브랜드/primary/강조색만 파스텔화**. DESIGN.md 상태색 규칙과 비충돌 범위 |

**E-D · 신규 대형 기능 (큼, 별도 스코핑 필요)**
| ID | 항목 | 규모·비고 |
| --- | --- | --- |
| E-9 | **Gantt** — 작업 기간 + **의존성** 연결 → 일정 리스크 가시화 | 큼. core Task에 **의존성 필드 없음** → 데이터 모델(선후관계) 신규 + Gantt 뷰 + 임계경로/리스크 계산. `/projects` 새 뷰 또는 `/planning` |
| E-10 | **분석 AI** (Gemini 또는 Qwen 연결) | 큼. 현재 프로젝트는 Claude MCP 사용 중 — **왜 Gemini/Qwen인지·무엇을 분석할지** 확인 필요. 새 LLM 통합 |

> **권장 착수 순서**: ① **E-A+E-B(빠른 UX+도움말 6건)를 감사 배치처럼 1~2 배치로** — 가장 높은 ROI·낮은 리스크. ② E-C 2건은 결정 받은 뒤. ③ E-9 Gantt·E-10 분석 AI는 각각 별도 스코핑(기획+데이터 모델). D 트랙(todo_griff)·C-1(구글캘린더)과는 독립.

---

## 개발계획 상세 (2026-07-08 기획 산출 — 트랙별 병렬 기획 종합)

각 항목 파일:줄 근거는 기획 워크플로 산출(스펙 전문은 세션 기록). 아래는 **착수 가능한 순서·데이터모델·미결 결정**만.

### E-A/E-B 배치 계획 (빠른 UX + 도움말, 저리스크)
- **배치 1 (S급, 반나절~1일)**: E-2(완료버튼=`done-circle.tsx` 재사용, 신규 `pm-done-circle.tsx` 래퍼, `task-done-toggle.tsx` 삭제) → E-4(CLI 명령어별 복사, 신규 `command-list.tsx`) → E-3(전체화면, 신규 공용 `fullscreen-button.tsx`, /schedule·/projects·/heatmap 배치) → E-5·E-6(도움말 `help-content.ts` 한 커밋).
- **배치 2**: E-1(M, `projects-data.ts` 다중 프로젝트 합산 + `ALL_PROJECTS` sentinel, core 무변경) → **E-8**(M, 파스텔 — `globals.css` 브랜드 토큰 4종 `--que-brand/-hover/-subtle/-on-brand` × 라이트/다크만, 상태색 불변. **전역 시각 변경이라 단독 커밋 + 양테마 QA**).
- **E-7**(L, 마지막 단독): `personal_access_tokens`에 `secret_enc`(nullable, 전용 토큰만)·`scope`('full'|'tasks') 추가 → **Task 스코프 토큰 발급 + /tools 실 토큰 노출**. ⚠️ scope 강제를 **먼저 배포**한 뒤 노출을 켜는 순서.

### E-9 Gantt (신규 대형, ~1.5~2주, 순차)
- **E-9a (M, 전제)**: core 의존성 모델 — `domain.ts` taskSchema에 `predecessorIds?: string[]`, DB `add-task-predecessors.sql`(`predecessor_ids text[]`), **Finish-to-Start 단일·같은 프로젝트 내만·순환 방지 규칙**(core rules), 신규 mutation `setTaskPredecessors`(ChangeLog via). *마이그레이션 포함이라 가장 먼저 프로덕션 적용.*
- **E-9b (L)**: `/projects` **4번째 뷰 탭 '간트'** — 작업 막대(startAt~endAt)·의존성 화살표(SVG)·오늘 라인·마일스톤 다이아몬드. 막대 클릭→기존 `?task=` 드로어. 태블릿 가로스크롤+sticky(히트맵 선례).
- **E-9c (M)**: 드로어 '선행 작업' 섹션(같은 프로젝트 다중선택·순환 후보 제외·canEdit 게이트).
- **E-9d (M)**: 일정 리스크 — 선행 지연→후행 밀림 전파, at-risk 강조(상태색 규칙 준수).
- 미결: 의존성 UI 범위·임계경로 알고리즘 깊이(E-9b 프리뷰 후 재확인 권장).

### D 트랙 todo_griff (API 경유 확정, 순차)
- **D-2 (S, 먼저)**: CORS 허용(todo.griff.co.kr) + `via='mobile'` — `change_logs.via` check에 'mobile' 추가(이 트랙 유일 core 스키마 변경, **코드 배포 전 마이그레이션 먼저** 안 그러면 쓰기 API 500).
- **D-1 (M)**: email+비번→PAT 교환 엔드포인트(권장안 (a) 토큰교환; `personal_access_tokens` 재사용). mustChangePassword 계정은 발급 거부+웹 유도.
- **D-3 (L)**: `/api/my-day`로 오늘 태스크 임포트(읽기) + 완료 write-back. 1차=읽기+완료만.
- **D-5(M) 오프라인 충돌 정책 → D-4(M) OKR(DayBlocks 자체 스키마, Que 무변경) → D-6(M) Capacitor 네이티브(PWA 충분성=iOS 푸시 필요 여부로 판단, 불필요면 연기).**

### E-10 분석 AI — 결정 완료 (2026-07-08), MVP 스펙 (M)
- **모델**: **Gemini Flash**(사용자 결정 — 비용. Claude Sonnet 선호하나 API 비용 부담). 8명·주간/온디맨드 규모라 호출량 극소=사실상 무료 티어. **provider 어댑터로 시작**(모델 고정 X) → 추후 Claude/Qwen 교체 시 재작업 최소.
- **대상**: **관리자·대표 전용**(`/team` 리포트 뷰. staff에는 미노출 — 기존 view==='report' admin 게이트 재사용).
- **내용**: ① **흐름 분석**(주간 추이·프로젝트 진척·워크로드 흐름 서술) + ② **병목 원인 지적**(문제/홀드·지연의 원인 추론·해결 방향). **개인 평가 금지 가드**(이름과 함께면 '왜 막혔나' 중심, 순위/점수 금지 — `/team` 리포트 원칙 계승).
- **프라이버시**: 외부 LLM 전송 **허용**(사용자 결정 — 실명 포함 가능). 첫 배포엔 프롬프트 가드('개인 평가 금지·수치는 스냅샷 인용만, 해석만') 권장.
- **위치/트리거**: `/team` 리포트에 온디맨드 **'AI 분석' 카드**(버튼→생성). 자동 크론은 후순위.
- **출력**: 흐름 요약 2~3줄 + 병목 하이라이트(원인·해결 방향) + **'AI 생성' 라벨**.
- **데이터 소재**: 기존 `performance-data.ts`·`report-data.ts`·`team-data.ts` 재사용(신규 조회 최소). 게이트: `GEMINI_API_KEY` + 활성 플래그(env). 실패 시 조용히 미표시(알림 파이프라인 격리 원칙).

| 항목 | 규모 | 지금 착수 가능? | 필요한 사용자 입력 |
| --- | --- | --- | --- |
| **A-4 Sentry** | 중간 | ✅ 완료(에러 캡처) · 소스맵/트레이싱은 스킵 | Sentry DSN(+선택 auth token) |
| **B-1 Slack Webhook** | 중간 | ✅ 완료·라이브 | Slack Incoming Webhook URL |
| **B-2 Cron 전환** | 작음~중간 | ✅ 완료·라이브 | 없음(Cron secret은 env) |
| **B-3 실 PAT + 셀프 발급** | 중간 | 코드 가능(맨 마지막) | 발급 토큰 팀 전달(운영) |
| **C-1 Google Calendar OAuth** | 중간 | ⏸ 대기 · 코드 골격 완성 | Google OAuth 클라이언트·동의화면 |
| **C-2 Slack 봇(2단계)** | 큼 | 후순위 | Slack 앱·봇 토큰·서명 시크릿 |
| **C-3 알림 설정/허브** | 중간 | 디자인 프리뷰 대기 | 디자인 프리뷰(CLAUDE.md 규칙) |
| **C-4 마일스톤/반복 재연결** | 큼 | ✅ 완료(/planning) | 화면/범위 결정 |

---

## A-4 · Sentry 에러 리포팅 연결

A-4는 이미 만들어진 "표시 계층 + 콘솔 로깅"을 실제 Sentry 전송·알림으로 승격시키는 작업이다. 표시(error.tsx/global-error.tsx)와 클라이언트 choke point(report-error.ts), useSafeAction 래퍼는 이미 존재하고, **전송 채널만 0**인 상태를 근거로 계획한다.

---

## 기획

**목적/문제**
현재 예상 못 한 실패(서버 500·렌더 crash·처리 안 된 예외)는 `console.error`로만 남아 개발자에게 도달하지 않는다(`report-error.ts:8`). 8인 베타의 전제인 "유저가 말 안 해도 개발자가 반드시 인지" 요건을 채우려면 실제 전송 + 알림 채널이 필요하다. 표시 화면은 이미 "자동 전달은 아직 준비 중"이라 정직하게 써 뒀고(`error.tsx:28`), Sentry가 붙어야 이 문구를 "전달됐습니다"로 바꿀 수 있다.

**사용자 흐름**
1. 테스터가 버그를 만난다 → route error boundary가 `error.tsx`(앱 셸 유지) 또는 `global-error.tsx`(셸 붕괴)로 교체되고 한국어 안내 + 오류 코드(digest)를 본다.
2. 클라이언트 렌더/조작 예외: boundary·`useSafeAction`이 `reportError()`를 호출 → (DSN 있으면) `Sentry.captureException` 백그라운드 전송.
3. 서버(서버 컴포넌트·서버 액션·route handler `withApi` rethrow, `respond.ts:56`) 예외: `instrumentation.ts`의 `onRequestError`가 잡아 Sentry로 전송.
4. Sentry가 이슈를 그루핑하고 **개발자 이메일 알림**(1단계). 개발자는 테스터가 말한 digest로 이슈를 대조.
5. (P1, 범위 밖) 에러 화면 한 줄 피드백·사이드바 피드백 버튼은 후속.

**수용 기준**
- [ ] 클라이언트에서 강제 throw(테스트 페이지/버튼) 시 Sentry에 이슈가 뜬다.
- [ ] 서버 액션/route handler의 처리 안 된 예외가 `onRequestError`를 통해 Sentry 이슈로 뜬다(도메인 규칙 거부 `QueRuleError`·Zod·Auth 에러는 전송 안 됨 — 정상 동작).
- [ ] `beforeSend` 스크러빙이 계좌번호 패턴·금액 필드·`Authorization`(PAT Bearer)·세션 쿠키를 마스킹한다(테스트로 확인).
- [ ] DSN 미설정 환경(로컬·PR 프리뷰)에서 앱이 정상 동작하고 콘솔 폴백으로만 남으며 크래시가 없다.
- [ ] `error.tsx`·`global-error.tsx` 카피를 "자동으로 개발팀에 전달됐습니다"로 수정(전송이 실제 동작한 뒤에만).
- [ ] 이슈에 사용자 id·라우트·`via`·커밋 SHA(release) 컨텍스트가 담긴다.

**필요한 사용자 입력**
- **Sentry DSN** (프로젝트 생성 후) — 클라이언트용 `NEXT_PUBLIC_SENTRY_DSN`, 서버용 `SENTRY_DSN`(동일 값 가능).
- (소스맵 업로드를 켠다면, 권장) `SENTRY_AUTH_TOKEN`(서버 전용, 절대 `NEXT_PUBLIC_` 금지) + `SENTRY_ORG` + `SENTRY_PROJECT`.
- 위 값들을 Vercel 프로젝트 env에 등록(Production/Preview 구분). 알림 이메일 수신자 지정(Sentry 콘솔). Slack 알림은 P2(사무실 복귀 후, Slack 앱 이슈와 함께).

---

## 개발 계획

**현재 상태 — 부분구현**
- 완료: 표시 계층 `error.tsx`·`global-error.tsx`(digest 노출, 스택 비노출), 클라이언트 choke point `report-error.ts`(console만), `useSafeAction`(`use-safe-action.tsx:36` `source:"server-action"`), 기타 호출부 `quick-add.tsx:56`·`user-switcher.tsx:66`.
- 미구현: 전송 채널 전무 — `@sentry/nextjs` 미설치(package.json deps 확인), `instrumentation.ts` 없음, sentry config 파일 없음, `next.config.ts`에 Sentry 래퍼 없음. `VERCEL_GIT_COMMIT_SHA` 참조 0건. `.env*` 파일 없음(env는 `process.env.*` 직접 사용, 예 `db.ts:11`).

**초점 정정(교체 지점은 "1곳"이 아니라 2 surface)**
`report-error.ts`는 `"use client"` 모듈이라 **브라우저 surface만** 담당한다. 서버 예외는 이 함수를 거치지 않고 `instrumentation.ts#onRequestError`로 잡아야 한다(Next 16.2.9 App Router에서 지원 확인 — `node_modules/next/dist/docs/.../instrumentation.md`). 즉 클라이언트=`report-error.ts` 교체, 서버=`instrumentation.ts` 신규, 두 곳이 필요하다. 어느 하나만 하면 "반드시 인지"가 깨진다.

**변경/신규 파일**
- `apps/web/package.json` — `@sentry/nextjs` 추가.
- `apps/web/instrumentation.ts` (신규) — `register`(server/edge config import) + `onRequestError = Sentry.captureRequestError`. async는 반드시 await(서버리스 flush 보장).
- `apps/web/instrumentation-client.ts` (신규) — 클라이언트 `Sentry.init`(`NEXT_PUBLIC_SENTRY_DSN`, `beforeSend` 스크러빙, `tracesSampleRate` 낮게, replay off 또는 저샘플, `sendDefaultPii:false`).
- `apps/web/sentry.server.config.ts` (신규) — 서버 `Sentry.init`(`SENTRY_DSN`, 동일 `beforeSend`, `release`=커밋 SHA).
- `apps/web/sentry.edge.config.ts` (신규) — edge 런타임 대비(현재 middleware 파일은 없지만 SDK 관례상 안전하게 포함).
- `apps/web/src/lib/report-error.ts` (교체) — 시그니처 유지. DSN 있으면 `Sentry.captureException(error, { extra: context })`, 없으면 기존 `console.error` 폴백. 호출부 4곳 무변경.
- `apps/web/src/lib/sentry-scrub.ts` (신규, 선택) — 공유 `beforeSend`: 계좌 패턴 `\d{2,6}-\d{2,6}-\d{2,10}`·금액 필드·`Authorization` 헤더(PAT)·`cookie` 마스킹, request body 수집 off. client/server config가 공용.
- `apps/web/next.config.ts` (변경) — `withSentryConfig`로 감싸 소스맵 업로드·`tunnelRoute`(광고차단 우회)·`widenClientFileUpload` 설정. Turbopack 호환 주의(아래 리스크).
- `apps/web/src/app/(app)/error.tsx`·`apps/web/src/app/global-error.tsx` (변경) — 안내 카피를 "전달됐습니다"로 수정. `global-error`는 루트 layout을 대체해 클라이언트 init이 안 붙을 수 있으므로 `Sentry.captureException`을 직접 호출(권장 패턴).
- env 문서화 — `.env.local`(로컬)·Vercel env에 DSN/토큰 등록. `.env.example` 신규 생성은 선택.

**접근/설계**
- **경계**: 클라이언트=`report-error.ts`(브라우저 렌더·조작·`onerror`/`unhandledrejection`은 SDK 자동), 서버=`onRequestError`. `withApi`가 예상된 거부만 응답으로 매핑하고 unexpected는 `throw`(rethrow, `respond.ts:56`)하므로 서버 캡처는 자연히 이 rethrow만 잡는다 — 규칙 거부 노이즈가 안 섞인다.
- **컨텍스트 enrichment**: 서버는 `getCurrentUser()`(`current-user.ts` — Auth.js 세션) 값을 `onRequestError` 또는 Sentry scope에 `user`로 세팅. 클라이언트는 report-error에 이미 넘어오는 `context`(boundary·digest·source)를 `extra`로, 사용자 id는 로그인 layout에서 `Sentry.setUser` 1회. `release`=`VERCEL_GIT_COMMIT_SHA`(server) / `NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA`(client).
- **권한/보안**: DSN은 설계상 공개 값(클라이언트 노출 OK). `SENTRY_AUTH_TOKEN`은 서버 전용. 스크러빙에 **PAT Bearer·세션 쿠키 추가**(기획 문서엔 계좌/금액만 명시 — 인증 토큰 누락 보완 필요).
- **서버리스(Vercel)**: SDK는 요청별 stateless라 in-memory 금지 규칙과 무충돌. 단 lambda 종료 전 flush가 관건 — `onRequestError`에서 `captureRequestError`를 `await`하고 Sentry Vercel 통합의 flush에 의존.
- **안전 폴백**: 모든 init/report 경로는 DSN 부재 시 no-op + console. 리포팅 실패가 앱을 죽이면 안 됨.

**규모 — 중간**
순서: (1) Sentry 프로젝트 생성·DSN 확보 → (2) `@sentry/nextjs` 설치 + 4개 config 파일 → (3) `sentry-scrub.ts` + `report-error.ts` 교체 → (4) `instrumentation.ts#onRequestError` → (5) `next.config.ts` `withSentryConfig` + 소스맵 → (6) error 카피 수정 + `global-error` 직접 캡처 → (7) 강제 throw로 client·server 양쪽 이슈 생성 검증 → (8) Vercel env 등록 + 이메일 알림 확인.

**리스크/주의**
- **Turbopack × 소스맵**: `dev`/`build` 모두 Turbopack 경로(Next 16.2.9, `next.config.ts`에 `turbopack.root`). `withSentryConfig` 소스맵 업로드가 webpack 전제인 버전이면 Turbopack build에서 무력화될 수 있음(지식 컷오프 2026-01 기준 SDK의 Turbopack 지원 여부를 릴리스 노트로 재확인). 소스맵이 안 붙어도 이슈 수집 자체는 동작하니, 소스맵은 별도 검증 항목으로 분리.
- **build 규칙**: `withSentryConfig`·소스맵 검증은 `pnpm build`가 필요 → CLAUDE.md 규칙대로 **dev 서버 종료 후** 실행, 검증 뒤 재기동.
- **global-error 특수성**: 루트 layout 대체라 클라이언트 Sentry init이 미적용일 수 있음 → 반드시 직접 `captureException`.
- **PII**: 결제 페이로드 breadcrumb·`Authorization`(PAT)·쿠키 누출 위험. `beforeSend`와 request body off를 배포 전 실제 이벤트로 확인(색/마스킹 도메인 규칙과 정합).
- **거짓말 방지 원칙**: 카피 "전달됐습니다" 수정은 프로덕션 DSN이 실제로 전송에 성공한 뒤에만(그전엔 현행 "준비 중" 유지). 문서 2.1 원칙.
- **next-auth 5 beta × Sentry**: 요청 isolation·세션 접근 상호작용 미검증 — enrichment에서 `auth()` 호출 위치 주의.
- **알림 범위**: 1단계 이메일까지가 A-4. Slack은 Slack 앱 생성 이슈에 묶여 P2로 분리.

---

## B-1 · Slack Webhook 알림(1단계)

## 기획

- **목적/문제**: 지금 운영 신호(문제발생·도움요청·마감임박)는 상단바 벨(`notifications-bell.tsx`)에서 앱을 열어야만 보인다 — 이는 매 요청마다 DB 상태를 훑어 그리는 파생 스냅샷(`alerts-data.ts`)일 뿐, 발송·도달·중복방지가 없다. 팀이 Que를 계속 켜두지 않아도 병목을 놓치지 않도록, 기획서 "알림 채널(2026-07-02 확정)"의 1단계인 **Slack Incoming Webhook 발송 + Que 딥링크**를 붙인다.
- **사용자 흐름**:
  1. 운영자가 팀 Slack 채널의 Incoming Webhook URL을 Vercel 환경변수로 등록(1회).
  2. 팀원이 웹/MCP/CLI에서 작업을 `문제발생`/`홀드`로 바꾸며 사유·**도움 필요한 사람**을 입력(`changeTaskStatus`, mock-db.ts:120 / statusDetail의 helpUserId).
  3. 변경이 커밋되면 해당 이벤트가 Slack 채널에 "문제 발생 · 작업명 · 담당 · 사유 · [Que에서 열기]" 형태로 뜬다(딥링크 `/now`, 작업 상세).
  4. 마감임박은 이벤트가 아니라 시간 조건 → Vercel Cron이 주기적으로 열린 작업을 스캔해 임박 건만 발송.
  5. 방해금지 시간대면 Slack 발송을 보류(outbox에 hold)하고 앱 벨에는 그대로 쌓인다 → 창이 지나면 드레인 발송.
- **수용 기준**:
  1. `문제발생`/`홀드` 전환 시 Slack에 사유·담당·**딥링크**가 포함된 메시지가 1건 도착(도움요청 대상이 있으면 그 이름 포함).
  2. 같은 이벤트가 재요청/크론 재실행으로 중복 발송되지 않는다(dedup_key 유니크로 보장).
  3. 마감임박(열린 상태 + 마감 N시간 이내, done/cancelled/merged/overdue 제외) 작업이 한 번만 발송된다.
  4. "보내지 않는 알림"(완료 작업 반복·이미 업데이트된 작업·방해금지 시간대·비공개 일정)이 실제로 발송되지 않는다.
  5. Slack POST 실패가 **작업 상태 변경 자체를 절대 실패시키지 않는다**(도메인 규칙 무결성 우선, 발송은 try/catch·outbox 재시도).
  6. 색 의미가 고정(red=문제, amber=마감/주의, violet=회의록)돼 앱 벨의 `AlertTone`과 일치.
- **필요한 사용자 입력**: **Slack Incoming Webhook URL**(팀 채널, 필수 — 시크릿). 나머지는 기본값으로 시작 가능: 딥링크 베이스 `QUE_APP_URL`(기본 `https://que.griff.co.kr`), `CRON_SECRET`(크론 인증), 마감임박 임계 시간, 크론 주기, 팀 방해금지 창(`QUE_QUIET_HOURS`).

## 개발 계획

- **현재 상태**: **없음(그린필드)**. 저장소 전체에서 slack/webhook/quietHours/DND는 `checkins/[checkInId]/answer/route.ts:11` 주석 한 곳뿐. 벨(`notifications-bell.tsx`)은 순수 표시 컴포넌트, `alerts-data.ts`는 상태 무보존 파생 스냅샷(발송·중복방지·저장 없음). `User` 스키마엔 id/name/role/avatarColor만 있고 timezone·quietHours·slackUserId 없음(domain.ts:14). `vercel.json`에 `crons` 없음. 발송 훅으로 쓸 중앙 지점은 이미 존재: 모든 업무 변경이 `logChange`(mock-db.ts:1049)를 통과하고, `changeTaskStatus`(mock-db.ts:120)가 사유/helpUserId/recheckAt를 statusLog에 남기며, 체크인 응답은 `answerCheckIn`(mock-db.ts:895)→`changeTaskStatus`로 합류. 커밋 경로는 API 라우트가 `db.mutate()` → `await db.persist()` 패턴(status/route.ts:22-26).
- **변경/신규 파일**:
  - `db/supabase/add-notifications.sql` (신규) — `notification_outbox` 테이블. `dedup_key`(UNIQUE), kind, entity_type/id, recipient(1단계는 팀 채널이라 NULL), payload jsonb(title·text·deeplink·tone), status(pending|held|sent|skipped|failed), attempts, hold_until, created_at, sent_at. 유니크 인덱스가 서버리스 중복 발송 방지의 핵심. (schema.sql의 14개 테이블 규약과 동일 스타일, TABLE_INSERT_ORDER에도 추가.)
  - `packages/core/src/notifications.ts` (신규, **재사용 계층**) — 순수 함수: `NotificationIntent` 타입, `buildStatusChangeIntents(ctx, task, from, to, detail)`(issue/on_hold + helpUserId만 통과, done/cancelled/merged·"이미 업데이트" 필터), `buildDeadlineIntents(tasks, now, thresholdH)`, `dedupKeyFor(...)`, `messageFor(intent)`(딥링크 경로+Slack 텍스트, tone=AlertTone 재사용). 규칙("보내지 않는 알림")을 여기서 강제해 web/mcp/cli가 동일 동작.
  - `apps/web/src/lib/notifications/slack.ts` (신규) — `SLACK_WEBHOOK_URL`로 fetch POST(Block/attachment color=tone), 딥링크 베이스 주입, 실패시 throw는 outbox status=failed로 흡수.
  - `apps/web/src/lib/notifications/dispatch.ts` (신규) — 커밋 후 `db.drainNotifications()`로 받은 intent를 outbox에 `ON CONFLICT(dedup_key) DO NOTHING` upsert → 방해금지면 hold_until 세팅, 아니면 즉시 전송 시도. 크론용 `scanAndEnqueueDeadlines()` + `drainOutbox()` 포함.
  - `apps/web/src/app/api/cron/notifications/route.ts` (신규) — Vercel Cron 진입점(`CRON_SECRET` Bearer 검증). 마감임박 스캔·enqueue + held/pending 드레인.
  - `apps/web/vercel.json` (변경) — `crons: [{ path: "/api/cron/notifications", schedule: "*/15 * * * *" }]` 추가(현재 regions만 있음).
  - `packages/core/src/data/mock-db.ts` (변경) — `logChange`/`changeTaskStatus`가 intent를 인스턴스 버퍼에 push, `drainNotifications()` 게터 추가(core 무침투 최소화). 
  - 커밋 라우트(변경) — `tasks/[taskId]/status/route.ts`, `checkins/[checkInId]/answer/route.ts`(체크인發 issue 자동 커버). DRY를 위해 `persist()` 직후 dispatch를 부르는 작은 `commitWithNotify(db)` 헬퍼로 묶는 게 이상적.
- **접근/설계**:
  - **트리거 위치**: 이벤트형(문제/홀드/도움요청)은 mutation 커밋 지점(핵심 훅 `logChange`/`changeTaskStatus`). 시간형(마감임박)은 mutation이 없으므로 **크론 스캔**(alerts-data의 overdue 조건과 정렬하되 "임박=아직 마감 전 N시간 이내"로 구분해 overdue와 중복 방지).
  - **서버리스 제약**: `getDb()`는 요청마다 스냅샷 로드→persist 라이트스루, in-memory 유지 금지. Vercel `waitUntil` 미보장 → **outbox 테이블 + 크론 드레인**이 정석. 인라인 발송을 쓰더라도 반드시 try/catch로 감싸 mutation을 깨지 않게(수용기준 5).
  - **중복 방지/멱등**: `dedup_key`(예: `issue:{taskId}:{toStatus}`, `deadline:{taskId}:{YYYY-MM-DD}`) UNIQUE + `DO NOTHING`. 이것이 "이미 업데이트된 작업/완료 반복" 미발송과 크론 재실행 안전성을 함께 보장.
  - **방해금지**: 설정 화면이 후순위라 1단계는 **팀 단위 env 창**(`QUE_QUIET_HOURS`)으로 hold, 앱 벨은 항상 표시. 개인별 창은 User 스키마·설정 화면 필요 → 후순위.
  - **권한/노출**: 회의록 파생 알림은 열람권한 필터(`canViewMeetingNote`, alerts-data.ts:36 재사용) 필요하지만 1단계 초점(문제/도움/마감)엔 무관. Webhook URL·CRON_SECRET은 Vercel env 전용, 리포/클라이언트 노출 금지.
  - **딥링크**: 베이스 URL을 env로 중앙화(현재 `tools/page.tsx:12`에 PROD_URL 하드코딩) → `/now`·`/action`·`/payments`·작업 상세 등 기존 라우트 재사용.
  - **`via` 의미**: Slack은 **발송 채널**이지 행위자 출처가 아니므로 1단계에서 `ChangeVia`(web|mcp|cli)를 오염시키지 않는다. Slack 내 응답은 2단계 Bot이 `answerCheckIn` 경유할 때 다룬다(기획 E단계).
- **규모**: **중간**. 순서: (1) outbox 마이그레이션 → (2) core intents+규칙+dedup_key → (3) slack 어댑터+dispatch를 status/checkin 커밋에 배선 → (4) 마감임박 크론 라우트 + vercel.json 크론 → (5) 방해금지 hold → (6) 목업 Webhook으로 도착·중복·보류 검증(dev 서버 켠 채 `pnpm build` 금지).
- **리스크/주의**:
  - 발송 실패가 상태 변경을 실패시키면 도메인 규칙 무결성 위반 → 발송은 항상 mutation 밖에서 흡수(outbox/재시도).
  - `waitUntil` 미보장·크론 재실행 → dedup_key UNIQUE 없이는 스팸. 유니크 제약을 1순위로.
  - overdue와 마감임박 이중 발송 위험 → 임계·상태(OPEN 집합, mock-db) 경계를 명확히.
  - 1단계 팀 Incoming Webhook은 신뢰성 있는 `@멘션` 불가(slackUserId 매핑 부재) → 도움요청 대상은 **텍스트에 이름만**, 진짜 멘션은 2단계 Bot.
  - 앱 벨(파생 스냅샷)과 Slack(이벤트+원장)은 서로 다른 메커니즘 — kind/tone은 일치시키되 outbox가 향후 "앱 내 알림=Slack 발송 내역 허브"(기획)의 기반 데이터가 되도록 설계.
  - 색 의미 고정 규칙 준수: attachment color를 `AlertTone`(red/amber/violet)로 매핑.

---

## B-2 · 체크인 스케줄러 Vercel Cron 전환

B-2 · 체크인 스케줄러 Vercel Cron 전환

## 기획

**목적/문제**
현재 체크인·반복업무 스케줄러(`syncCheckIns`/`syncRecurringTemplates`)는 누군가 앱을 열어 `getDb()`를 호출할 때만 lazy 실행된다(`apps/web/src/lib/db.ts:22-36`). 서버리스(Vercel)에는 상주 프로세스가 없으므로, 아무도 접속하지 않는 시간대(새벽·주말)에는 시작 시간이 지난 "예정" 작업에도 체크인이 생성되지 않고, 누군가 페이지를 여는 순간에야 뒤늦게 만들어진다. 시각에 의존하는 운영 신호(체크인)를 사용자 트래픽과 분리해 정시에 돌게 만드는 것이 목표다. 부수적으로 요청 경로에서 스케줄러를 떼어내면 다중 인스턴스 동시 생성 경합(`check_ins` UNIQUE 위반으로 persist가 throw할 수 있는 창)도 근본 해소된다(`db/supabase/go-live-cleanup.sql:29-31`이 지목한 방향).

**사용자 흐름**
- 최종 사용자(8인 팀)는 아무 조작도 하지 않는다. 트리거는 Vercel Cron(시스템).
- Vercel Cron이 N분 간격으로 `GET /api/cron/sync`를 호출 → 엔드포인트가 core 스케줄러를 실행 → 새 체크인/반복 Task를 DB에 persist.
- 팀원이 다음에 앱을 열면 이미 정시에 생성된 체크인이 `작업 목록`/체크인 응답 UI에 떠 있다.
- 관리자는 Vercel 대시보드 Cron 로그(엔드포인트가 반환하는 생성 건수 JSON)로 동작을 확인한다.

**수용 기준**
1. `vercel.json`에 `crons` 항목이 있고, 배포 후 Vercel 대시보드 Cron 탭에 등록·실행된다.
2. `/api/cron/sync`는 올바른 `Authorization: Bearer <CRON_SECRET>` 없이는 401을 반환한다(공개 URL이라도 아무나 실행 불가).
3. 올바른 시크릿으로 호출 시 `syncCheckIns` + `syncRecurringTemplates`가 실행되고 결과가 DB에 저장되며, 생성 건수 요약 JSON을 반환한다.
4. 멱등: 같은 회차를 두 번 호출해도 두 번째는 0건 생성(작업당 체크인 1회 규칙 유지, `check_ins` UNIQUE로 이중 방어).
5. Supabase 읽기 경로(`getDb()`)에서 스케줄러 lazy 실행+persist가 제거되어, 순수 페이지 조회가 쓰기(네트워크 write)를 유발하지 않는다.
6. lint/typecheck/기존 `rules.test.ts`(스케줄러 단위 테스트) 통과.

**필요한 사용자 입력**
외부 크레덴셜/계정/OAuth 없음 — 이 항목은 크레덴셜 없이 구현 가능하다. 배포 측 설정 2건만 필요하며 모두 자체 처리 가능:
- `CRON_SECRET` env 1개(자체 생성 랜덤, `openssl rand -base64 32`)를 Vercel 환경변수에 추가. Vercel Cron은 이 값이 있으면 호출 시 `Authorization: Bearer <CRON_SECRET>`를 자동으로 붙인다.
- Vercel 플랜이 원하는 Cron 주기(예: 10분)를 지원하는지 확인(아래 리스크 참조).

## 개발 계획

**현재 상태: 부분구현(요청 경로 lazy 실행) + Cron 골격 없음**
- 스케줄러 로직 자체는 완성·테스트됨: `packages/core/src/data/mock-db.ts:629`(`syncCheckIns`), `:774`(`syncRecurringTemplates`). 둘 다 멱등 설계이고 코드 주석이 "배포 후 Vercel Cron으로 전환"을 이미 예고(`mock-db.ts:627,772`).
- 실행 지점이 요청 경로에만 있음: `apps/web/src/lib/db.ts:27-29`(Supabase 브랜치에서 sync 2종 후 `persist()`), `:34-35`(mock 브랜치 lazy).
- Cron 엔드포인트·설정은 전무: `apps/web/vercel.json`은 `{ "regions": ["icn1"] }`만 있음(`vercel.json:1-4`), `apps/web/src/app/api/cron/` 디렉터리 없음.
- 중복 방지 하부구조는 준비됨: `check_ins`에 `unique(task_id, scheduled_at)` 추가하는 SQL 존재(`db/supabase/go-live-cleanup.sql:26-27`, go-live 1회 실행분 — 프로덕션 적용 여부만 확인).
- 배포 문서에 이 작업이 미완(⏳)으로 명시됨: `data/docs/deploy-vercel-supabase.md:59`(4-1, 잠정 경로명 `/api/cron/sync-checkins` 언급).

**변경/신규 파일**
- `apps/web/src/app/api/cron/sync/route.ts` (신규) — Cron 진입점. `export async function GET(request)`(Vercel Cron은 GET 호출). ① `Authorization` 헤더가 `Bearer ${process.env.CRON_SECRET}`와 상수시간 일치하는지 검사, 불일치/`CRON_SECRET` 미설정 시 401. ② `getDb()`로 로드된 db 획득 → `db.syncCheckIns(now)` + `db.syncRecurringTemplates(now)` 실행 → `await db.persist()`. ③ `{ checkInsCreated, tasksCreated }` JSON 반환. **`withApi`(PAT 인증)를 쓰지 않는다** — 그건 `Authorization: Bearer <PAT>`(사용자 토큰)를 요구하므로(`apps/web/src/lib/api/respond.ts:28`, `api/auth.ts:61-69`), Cron 시크릿과 인증 축이 다르다. 별도 헤더 검사로 처리.
- `apps/web/vercel.json` (수정) — `crons: [{ "path": "/api/cron/sync", "schedule": "*/10 * * * *" }]` 추가(기존 `regions`와 병존).
- `apps/web/src/lib/db.ts` (수정) — Supabase 브랜치(`:22-31`)에서 `syncCheckIns`/`syncRecurringTemplates` 및 그 결과를 저장하던 `persist()` 호출 제거 → 스케줄러 권위를 Cron으로 일원화하고 조회를 순수 load로. mock 브랜치(`:33-36`)의 lazy 실행은 **유지**(로컬 dev 단일 인스턴스·경합 없음·DB persist 없음 → 개발 편의). 주석도 갱신.
- (선택) `apps/web/src/app/api/cron/sync/route.test.ts` 또는 기존 `rules.test.ts` 보강 — 시크릿 불일치 401, 멱등 재호출 0건. core 스케줄러 자체 테스트는 `rules.test.ts:811~`에 이미 있음.
- (문서) `data/docs/deploy-vercel-supabase.md:59`의 4-1을 완료로 갱신 + `CRON_SECRET` env 표(50-58 근처)에 추가. `HANDOFF.md`에 결정 기록.

**접근/설계**
- **데이터 접근은 core 재사용**: 엔드포인트는 `getDb()`(→ `SupabaseQueDb.load()`)로 로드 후 core의 `syncCheckIns`/`syncRecurringTemplates`를 그대로 호출하고 `persist()`로 diff write-through(`apps/web/src/lib/supabase-db.ts:82`). 새 데이터 경로를 만들지 않는다.
- **권한/보호**: 사용자 권한 모델 밖의 시스템 동작이다. 인증은 오직 `CRON_SECRET` 헤더. 스케줄러는 ChangeLog 관점에서 체크인은 로그 없음(시스템), 반복 Task는 생성 Task 쪽에만 `logChange(via:"web")` 기록(`mock-db.ts:810-818`) — Cron 경유라도 core가 그대로 남긴다(via 값 `web` 유지로 충분, 필요 시 후속에서 `via` 확장 논의).
- **멱등/중복 방지**: 단일 Cron이라 동시성이 사라져 경합 자체가 없음. `syncCheckIns`는 작업당 1회(`mock-db.ts:639`), persist는 id 기준 upsert이므로 재실행 write 0건. `check_ins` UNIQUE는 이제 능동 에러원이 아니라 백스톱.
- **서버리스 제약(Vercel)**: in-memory 상태 없음 — 매 호출 load→sync→persist 왕복. 데이터가 작아(8인) 함수 타임아웃 여유. Cron 스케줄은 **UTC 기준**(체크인은 N분 폴링이라 타임존 무관, 반복 템플릿은 3일 윈도라 느슨 — 영향 미미). icn1 리전·서울 Supabase 동일 리전 왕복 최소.
- **AGENTS.md 주의**: 이 저장소 Next.js는 "네가 아는 그 Next.js가 아님" — route handler 작성 전 `node_modules/next/dist/docs/`의 route handler 문서를 확인(GET 시그니처·`request` 타입·`export const dynamic` 필요 여부).

**규모: 작음–중간**
순서: ① `db.ts`에서 Supabase 스케줄러 lazy 제거(권위 이전 준비) → ② `/api/cron/sync/route.ts` 신규(시크릿 검사 + core 호출 + persist) → ③ `vercel.json`에 crons 추가 → ④ 테스트(401·멱등) + lint/typecheck → ⑤ 문서·HANDOFF 갱신 → ⑥ 배포 후 Vercel env에 `CRON_SECRET` 설정, Cron 로그로 검증. 코드 자체는 작음, 검증·플랜 확인 포함 시 중간.

**리스크/주의**
- **Vercel 플랜 Cron 주기 제한**: Hobby 플랜은 크론이 하루 1회·개수 제한이 있어 10분 주기가 불가하다. 체크인은 "시작 시각 경과 후 곧" 생성돼야 유용하므로 daily로는 무의미 → **Pro 이상 필요**. 배포 팀(`griff0120s-projects`) 플랜을 먼저 확인하고, 불가하면 최소 지원 주기로 낮추거나 대안(외부 스케줄러/GitHub Actions cron이 엔드포인트 호출)을 검토.
- **lazy 제거의 트레이드오프**: Supabase 조회 경로에서 lazy를 떼면, Cron이 실패·미설정인 동안에는 체크인이 아예 안 생긴다(과거엔 접속만으로 생성됨). 배포 초기엔 Cron 등록·시크릿 설정을 반드시 선행. 안전을 더 원하면 Supabase 브랜치에 lazy를 남기는 절충도 가능하나, 그러면 요청 경합·매 요청 persist가 되살아나므로 권장하지 않음(단일 Cron 일원화가 `go-live-cleanup.sql:31`이 지목한 근본 해법).
- **인증 축 혼동 금지**: `withApi`/PAT 경로를 재사용하면 안 됨(사용자 토큰을 요구). Cron 엔드포인트는 별도 `CRON_SECRET` 검사. `CRON_SECRET` 미설정 시 "빈 문자열 == 헤더 없음"으로 우회 통과하지 않도록, 미설정이면 무조건 거부하게 방어.
- **check_ins UNIQUE 실적용 확인**: `go-live-cleanup.sql`은 "1회 실행" 스크립트 — 프로덕션에 실제로 적용됐는지 확인(미적용이면 백스톱 부재, 단 단일 Cron이면 경합 없음이라 치명적이진 않음). 또한 `schema.sql` 재생성 시 이 제약이 빠질 수 있음(문서 29행이 RLS에 대해 지적한 동일 함정).
- **도메인 규칙 준수**: 담당/마감 없는 Action의 자동 Task 금지 규칙은 이 스케줄러와 무관(체크인/반복 템플릿 경로). 반복 Task 생성 시 core가 이미 담당자를 강제(`createRecurringTemplate`)하므로 규칙 위반 소지 없음.

---

## B-3 · 실 PAT 배포 + 설정에서 셀프 발급

## 기획

- **목적/문제**: 서버는 이미 `personal_access_tokens`를 SHA-256 해시로 조회해 CLI/MCP를 인증하지만(`apps/web/src/lib/api/auth.ts:39-59`), **실 토큰을 발급하는 경로가 없다**. 현재 tools 화면은 "프로덕션 토큰은 운영자에게 요청하세요"라고 안내하고 mock 형식 `que_pat_<id>`만 보여준다(`tools/page.tsx:85-88`). 팀원이 설정에서 **직접** PAT를 발급/폐기(평문 1회 표시, 해시만 저장)하게 만들고, mock 토큰과 `QUE_ALLOW_MOCK_AUTH` 인증 우회를 걷어내 배포를 완결한다.

- **사용자 흐름**:
  1. 팀원이 로그인 → **설정(`/settings`)** 진입(비밀번호 변경 카드 아래에 "액세스 토큰" 카드 신설).
  2. 라벨(예: "노트북 CLI")을 입력하고 "발급" → 서버가 무작위 토큰 생성, DB엔 해시만 저장, **평문을 응답으로 1회만 반환** → 화면에 복사 버튼과 함께 표시하고 "다시 볼 수 없음" 경고.
  3. 팀원이 그 토큰을 **MCP · CLI(`/tools`)** 안내대로 `QUE_TOKEN`/`que login`에 붙여넣어 연결.
  4. 목록에서 본인 활성 토큰(라벨·생성일)을 확인하고, 분실/기기 변경 시 개별 **폐기**(`revoked_at` 기록) → 해당 토큰은 즉시 401.
  5. 운영 전환: 8명 전원이 본인 PAT를 발급해 기존 mock 토큰 설정을 교체.

- **수용 기준**:
  1. 발급 시 평문 토큰이 1회 표시되고 DB엔 SHA-256 해시만 저장된다(평문·복구 불가 확인).
  2. 발급 토큰으로 `Authorization: Bearer`가 인증 성공, 폐기 후 같은 토큰은 즉시 401.
  3. 설정에서 **본인** 활성 토큰만 라벨·생성일로 목록/개별 폐기 가능(타인 토큰 비노출).
  4. 프로덕션(`QUE_DB=supabase`)에서 mock 토큰 `que_pat_<id>`가 더 이상 인증되지 않는다(mock 폴백 제거).
  5. tools 화면이 "운영자 요청/mock 형식" 안내 대신 설정 셀프 발급으로 연결된다.
  6. lint/typecheck/build 통과, 태블릿 세로 포함 설정 화면 레이아웃 정상.

- **필요한 사용자 입력**: **없음** (외부 크레덴셜 불필요 — 실 Supabase·실 로그인이 이미 운영 중). 다만 **운영 절차**로: 팀원 8명이 각자 로그인→설정에서 발급→CLI/MCP의 `QUE_TOKEN`을 실 토큰으로 교체해야 하며, 운영자가 토큰을 손으로 배포하던 관행은 이 배포로 폐기된다.

## 개발 계획

- **현재 상태**: **부분구현**.
  - 서버 검증: 구현됨 — `apps/web/src/lib/api/auth.ts:35-59`(`hashToken` SHA-256, `revoked_at IS NULL` 필터로 조회). 스키마 테이블 존재 — `db/supabase/schema.sql:199-205`(`token_hash` PK, `user_id`, `label`, `created_at`, `revoked_at`; **user_id 인덱스·scope 컬럼 없음**).
  - 발급 UI: **없음** — `tools/page.tsx:31,85-88`이 mock 형식만 노출. 설정엔 PAT 카드 없음(`settings/page.tsx`는 폰트+비밀번호만).
  - mock 토큰: `packages/core/src/mock/tokens.ts`(결정적 `que_pat_<id>`), core `index.ts:17`에서 export, `api/auth.ts:58` mock 분기에서만 사용.
  - **재사용할 패턴**: 비밀번호 쓰기 모듈 `apps/web/src/lib/auth/password.ts`가 정확한 모델 — `useSupabase` 게이트, `SECRET_KEY` admin 클라이언트로 직접 write, `randomBytes` 시크릿 생성, `{ok,error}`·`NOT_SUPPORTED` 반환. 서버 액션 래핑은 `settings/security-actions.ts` + 클라이언트 `components/settings/password-settings.tsx`(`useActionState`) 패턴 그대로.

- **변경/신규 파일**:
  - **신규** `apps/web/src/lib/auth/tokens.ts` (`server-only`): `generatePat()`(=`randomBytes`→base32/hex + `que_pat_` 접두), `issuePat({userId,label})`→평문 반환+해시 저장, `listPats(userId)`, `revokePat({userId,tokenHash})`. `password.ts`처럼 `useSupabase` 게이트·admin 클라이언트. **해시는 `api/auth.ts`의 `hashToken`을 재사용**(알고리즘 단일 출처 — 필요 시 `hashToken`을 작은 공유 모듈로 이동).
  - **신규** `apps/web/src/app/(app)/settings/token-actions.ts` (`"use server"`): `getCurrentUser()`로 본인 확인 후 위 함수 호출하는 액션들(발급/폐기). 반환에 평문 1회 포함.
  - **신규** `apps/web/src/components/settings/token-settings.tsx` (client): 활성 토큰 목록 + 라벨 입력 발급 폼 + 개별 폐기 버튼 + **평문 1회 표시(복사 버튼 + "다시 못 봄" 경고)**. 색 의미 고정 준수(경고=amber).
  - **수정** `apps/web/src/app/(app)/settings/page.tsx`: 서버에서 `listPats(user.id)` 로드해 `<TokenSettings>` 렌더.
  - **수정** `apps/web/src/app/(app)/tools/page.tsx`: mock 블록(`mockToken` 변수 L31, "운영자에게 요청" 카드 L85-88) 제거 → 설정 셀프 발급으로 안내/링크.
  - **수정** `apps/web/src/lib/api/auth.ts`: `resolveToken`의 mock 폴백(L54-58) 제거 → Supabase 단일 경로. `resolvePat`/`isMockAuthAllowed` import 제거.
  - **정리** `packages/core/src/mock/tokens.ts` 삭제 + core `index.ts:17` export 제거.
  - **선택/스키마** `db/supabase/schema.sql`: `create index idx_pat_user on personal_access_tokens (user_id) where revoked_at is null;` 추가(목록 쿼리용). (스키마는 번호 마이그레이션 없이 Dashboard/`supabase db push`로 적용 — 파일 헤더 규칙.)

- **접근/설계**:
  - **데이터 모델**: 기존 `personal_access_tokens` 그대로 사용(추가 컬럼 불필요). PAT 테이블은 `supabase-db.ts`의 `TABLE_TO_FIELD`에 **없어** core 스냅샷 DB가 관리하지 않으므로, `password.ts`처럼 **전용 직접-Supabase 모듈**이 정답(core 스냅샷 우회가 오히려 규칙에 맞음).
  - **토큰 생성**: 고엔트로피 무작위(≥128bit) → 추측 불가라 저장은 SHA-256 해시로 충분(비밀번호 아님, `api/auth.ts:34` 주석과 일치). 평문은 서버 액션 반환→클라이언트 1회 렌더, 재조회 불가(해시만 저장).
  - **권한/서버리스**: 발급/폐기는 세션 인증 + 본인 스코프(`getCurrentUser().id`로만). Vercel 무상태 — 전부 DB, in-memory 없음. **ChangeLog 미기록이 맞다**: `change_logs.entity_type` enum에 token이 없고(스키마 L146-147) PAT는 계정/보안 이벤트라, 비밀번호 변경과 동일하게 ChangeLog 대상 아님.
  - **scope(read/write)**: 계획서(L39)엔 있으나 스키마·`authenticate()`에 없음 → **B-3 범위 밖(의도적 보류)**. 지금은 전체 권한 토큰, 필요 시 후속.

- **규모**: **중간**. 순서: (1) `lib/auth/tokens.ts` + 스키마 인덱스 → (2) 서버 액션 → (3) 설정 클라이언트 카드 + page 배선 → (4) tools 화면 문구 교체 → (5) **컷오버**: `api/auth.ts` mock 폴백 제거 + `mock/tokens.ts` 삭제 → (6) 팀 8명 재발급(운영) 확인.

- **리스크/주의**:
  - **`QUE_ALLOW_MOCK_AUTH` 전면 제거는 별개 단계**: 이 플래그는 PAT뿐 아니라 **로그인 mock**도 게이트한다(`auth/verify.ts:78` 쿠키 사용자 전환/공용 비번). B-3에선 **PAT의 mock 폴백만** 제거하고, 플래그 완전 삭제는 8명 전원 실 로그인·실 PAT 확인 후 별도 정리로 순서화(그렇지 않으면 dev 편의가 깨질 수 있음).
  - **컷오버 타이밍**: mock 폴백 제거를 먼저 배포하면 실 PAT 재발급 전까지 기존 mock 토큰 사용자가 401. 발급 UI 배포 → 팀 재발급 안내 → 그 다음 mock 제거 순서 엄수.
  - **평문 노출**: 평문을 로그/ChangeLog/서버 상태에 절대 남기지 않기(반환값만). 폐기는 delete가 아닌 `revoked_at` 소프트 폐기(감사 흔적 유지, `api/auth.ts`가 이미 `revoked_at IS NULL` 필터).
  - **해시 단일 출처**: `tokens.ts`가 자체 해시를 만들면 `authenticate()`와 어긋나 전멸 → 반드시 `hashToken` 재사용.
  - **선택 남용 방지**: 사용자당 활성 토큰 상한(예: 10개) 정도만 고려. `last_used_at`은 매 요청 write 비용이 있어 기본 보류.
  - **dev 서버 켜진 채 `pnpm build` 금지**(프로젝트 규칙) — 검증 시 dev 종료 후 빌드.

---

## C-1 · Google Calendar 실 OAuth 연동

## 기획

**목적/문제**
회사 캘린더 연동의 뼈대(제공자 인터페이스 + 멱등 동기화 엔진 + `/api/calendar/sync`)는 이미 완성돼 있고 지금은 `MockGoogleCalendarProvider`로만 돈다(`apps/web/src/app/api/calendar/sync/route.ts:19`). 실제 Google Calendar 원본 일정(회의·타운홀·휴가·외부 일정)을 Que 캘린더에 함께 보여주려면 남은 조각인 **실 OAuth 연동 + 토큰 저장 + 스케줄 동기화**만 붙이면 된다.

**사용자 흐름**
1. 관리자가 (설정/일정 화면의) "회사 캘린더 연결" 버튼을 누른다 → `/api/calendar/oauth/start`가 Google 동의 화면으로 리다이렉트(scope `calendar.readonly`, `access_type=offline`, `prompt=consent`).
2. 관리자가 회사 Google 계정으로 동의 → `/api/calendar/oauth/callback`이 code를 refresh/access 토큰으로 교환, refresh 토큰을 **암호화**해 `calendar_connections`에 저장(누가·언제·어떤 calendarId).
3. 이후 **Vercel Cron**이 주기적으로(예: 15분) 동기화 엔드포인트를 호출 → `GoogleCalendarProvider`가 저장된 토큰으로 access 토큰을 갱신하고 `events.list`(timeMin/timeMax = 지금-7일 ~ +30일)를 읽어 `ExternalCalendarEvent[]`로 매핑.
4. 기존 `syncExternalCalendar`가 그 결과를 `source:"company"`로 멱등 upsert(`mock-db.ts:830-891`). 관리자는 수동으로도 즉시 동기화 가능(기존 POST 유지).
5. 팀원은 일정/홈 화면에서 회사 일정을 **읽기 전용**으로 본다(드래그·수정 불가). 비공개 일정은 팀원에겐 `비공개 일정`, 관리자·본인에겐 원본 열람.

**수용 기준**
- [ ] 관리자가 OAuth 동의를 완료하면 refresh 토큰이 **암호화 상태로만** 저장되고, 평문 토큰은 DB/로그 어디에도 남지 않는다.
- [ ] 동기화가 -7일~+30일 창의 Google 일정을 `source:"company"`로 upsert하고, 재실행 시 멱등(변경분만 updated, 나머지 0).
- [ ] 가져온 회사 일정은 Que에서 이동/수정 불가 — `canMoveCalendarEvent`가 false(`rules.ts:87`). 드래그 규칙 유지.
- [ ] Google `private/confidential` 일정은 `visibility:"private"`로 들어오고, 비소유·비관리자에겐 제목이 숨겨진다.
- [ ] Vercel Cron이 사용자 세션 없이 `CRON_SECRET`으로 인증돼 무상태로 동작(서버리스 in-memory 토큰 캐시 없음).
- [ ] 연결 해제 시 이후 동기화가 멈춘다(기존 company 일정 보존 여부는 옵션).

**필요한 사용자 입력**
- Google Cloud 프로젝트의 **OAuth 2.0 클라이언트 ID + 시크릿**(Web application), 승인 리다이렉트 URI `https://que.griff.co.kr/api/calendar/oauth/callback`.
- **OAuth 동의 화면** 구성 + scope `.../auth/calendar.readonly`. 8인 회사가 Google Workspace면 **User type = Internal** 권장(민감 scope의 Google 앱 심사 회피).
- 가져올 **회사 캘린더 id**(공유 "회사 일정" 캘린더 id 또는 계정 `primary`).
- 결정: **단일 회사 캘린더 연결(권장)** vs 팀원별 개인 OAuth.
- Vercel 환경변수: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_OAUTH_REDIRECT_URI`, `QUE_CALENDAR_ENCRYPTION_KEY`(토큰 대칭 암호화), `CRON_SECRET`.

---

## 개발 계획

**현재 상태 — 부분구현(핵심 골격 완성, OAuth만 대기)**
- 제공자 인터페이스 완성: `packages/core/src/calendar-provider.ts:26-32`(`CalendarProvider`), `:9-19`(`ExternalCalendarEvent` 스키마).
- 멱등 동기화 엔진 완성: `packages/core/src/data/mock-db.ts:830-891`. `source:"company"` upster, `externalCalendarId`로 매칭, 매핑 불가 ownerId/시간역전 skip. **삭제 동기화는 미구현("후속 과제", :827).** SupabaseQueDb가 상속해 그대로 재사용(`apps/web/src/lib/supabase-db.ts:34`).
- API 라우트 골격 완성·mock 하드코딩: `apps/web/src/app/api/calendar/sync/route.ts:19`(관리자 전용 POST, 범위 -7d~+30d, persist).
- 드래그 불가 규칙 이미 존재: `packages/core/src/rules.ts:87-89`(`source==="que"`만 이동 허용) → company 일정은 자동으로 읽기 전용.
- **없음**: 실 `GoogleCalendarProvider`, OAuth 라우트, 토큰 저장 테이블, Cron. Auth.js는 Credentials 전용(`apps/web/src/auth.ts:12-22`) — 이건 **로그인 OAuth와 별개**(캘린더 API용 offline access 토큰이 필요). `vercel.json`에 cron 없음. `ChangeVia`는 web|mcp|cli만(`domain.ts:265`) — sync 값 없음.

**변경/신규 파일**
- `db/supabase/schema.sql` + 신규 마이그레이션 `db/supabase/add-calendar-connections.sql` — 테이블 `calendar_connections`(id, provider, calendar_id, encrypted_refresh_token, access_token_expiry, connected_by → users(id), connected_at, last_sync_at, last_sync_result jsonb, revoked_at). PAT의 "평문 미저장" 원칙(`schema.sql:199-208`)을 잇되, refresh 토큰은 **되읽어야 하므로 해시가 아니라 대칭 암호화(AES-GCM)**.
- `apps/web/src/lib/calendar/google-oauth.ts` — 동의 URL 생성, code→token 교환, access 토큰 갱신, encrypt/decrypt 헬퍼.
- `apps/web/src/lib/calendar/google-provider.ts` — 실 `GoogleCalendarProvider implements CalendarProvider`. `events.list`(singleEvents=true·페이지네이션), 이메일→Que userId 매핑, all-day/timezone 처리, Google visibility→Que visibility 매핑. **core가 아니라 web에 둠**(googleapis 의존성을 순수 core 밖으로; mock 파일 주석의 "core 대체" 의도와 다르지만 core 순수성 유지가 이득 — 라우트 import만 교체).
- `apps/web/src/lib/calendar/connections.ts` — Supabase에서 연결 로드/저장/폐기(또는 SupabaseQueDb 확장).
- `apps/web/src/app/api/calendar/oauth/start/route.ts` — 관리자 전용, state(CSRF) 심어 Google 동의로 리다이렉트.
- `apps/web/src/app/api/calendar/oauth/callback/route.ts` — code 교환·연결 저장.
- `apps/web/src/app/api/calendar/sync/route.ts` — **수정**: 연결 있으면 real provider, dev·무연결이면 mock 폴백. Cron용 GET 경로(`CRON_SECRET` 검증) 추가, 관리자 POST 유지.
- `apps/web/vercel.json` — `crons` 항목 추가(예: `*/15 * * * *`).
- `apps/web` deps — `google-auth-library`(또는 `googleapis`) 추가.
- (선택) 관리자용 "연결/해제 + 마지막 동기화" 최소 컨트롤. 단 IA에 설정 화면이 없고 "설정 후순위"라 최소화 — /schedule 상단 관리자 버튼 또는 숨은 admin 라우트.

**접근/설계**
- **OAuth 모델**: 단일 회사 캘린더 연결(관리자 1회 동의, refresh 토큰 1개)이 기획("회사 캘린더를 가져온다", 단수·읽기 전용, 74-78행)에 맞고 가장 단순. offline access + `prompt=consent`로 refresh 토큰 확보.
- **ownerId 매핑**: Google 이벤트는 이메일 기준 → `users.email`(`schema.sql`)로 organizer/attendee 이메일을 Que userId로 해석. 매핑 안 되면 엔진이 skip, 또는 전사 일정(타운홀 등)은 연결한 관리자로 폴백 — **결정 필요**.
- **읽기 전용/색 의미**: scope를 readonly로 고정(양방향은 2차, 기획 1030행). company로 저장 → 드래그 불가 규칙 자동 충족. 상태색 토큰 불변.
- **ChangeLog**: 외부 동기화는 시스템 동작이라 ChangeLog를 남기지 않는다(엔진도 `logChange` 미호출; `ChangeVia`에 sync 값 없음 — 지어내지 말 것). 감사 필요 시 `calendar_connections.last_sync_result`에만 기록.
- **서버리스(Vercel) 제약**: in-memory 토큰 캐시 금지 — refresh 토큰은 DB에서 읽어 매 실행마다 access 토큰 갱신(짧은 수명은 연결 로우에 만료시각 캐시 가능). Cron은 세션이 없으므로 `withApi`(사용자 필요) 대신 `CRON_SECRET` 헤더 검증 경로로 분리.

**규모: 중간.** 순서: (1) Google Cloud·env 준비[사용자] → (2) `calendar_connections` 테이블·마이그레이션 → (3) OAuth 헬퍼(URL·교환·갱신·암호화) → (4) start/callback 라우트 → (5) `GoogleCalendarProvider`(이메일 매핑·all-day/tz·페이지네이션·private) → (6) sync 라우트를 real provider로 배선 + Cron GET 가드 + `vercel.json` cron → (7)(선택) 관리자 연결 UI·마지막 동기화 표시 → (8) 검증(dev 서버 내리고 lint/typecheck/build, preview에서 OAuth 왕복, company 일정 드래그 불가 확인).

**리스크/주의**
- **refresh 토큰 재발급 함정**: Google은 최초 동의에서만 refresh 토큰을 준다 → 재동의 시 없을 수 있음. 값이 있을 때만 저장(기존 토큰을 null로 덮지 말 것).
- **동의 화면 심사**: `calendar.readonly`는 민감 scope — External 앱이면 Google 앱 심사 대상. Workspace **Internal**로 회피(핵심 결정).
- **삭제 동기화 부재**: 엔진은 사라진 Google 일정을 삭제하지 않음(`mock-db.ts:827`). 취소/삭제된 회사 일정이 Que에 잔존 → v2에서 "이번 full sync 창에서 미관측 company 일정 정리" 필요. 알려진 갭.
- **all-day/timezone**: `ExternalCalendarEvent`는 offset 있는 datetime 필수(`:14-15`) → Google `start.date`(종일) 이벤트를 시각으로 변환해야 함. 미처리 시 zod 검증 실패.
- **externalId 안정성**: `google:{calendarId}:{eventId}` 형태로 안정 키 구성(현 시드 `google:weekly-sync` 스타일과 호환). `singleEvents=true`면 반복 인스턴스별 고유 id — 매칭엔 좋으나 시리즈 편집 시 신규 인스턴스 발생(v1 허용).
- **암호화 키 운영**: `QUE_CALENDAR_ENCRYPTION_KEY` 회전 시 기존 토큰 재암호화 경로 필요.
- **core import 교체**: 라우트가 `@que/core`에서 mock provider를 import(`route.ts:1`) → real provider를 web lib로 옮기면 import 경로만 바뀜(엔진·인터페이스는 무변경).

---

## C-2 · Slack 2단계(봇 인터랙티브 체크인 응답)

개발은 하지 않았고, 지정 파일과 실제 코드를 읽어 근거 기반으로 계획만 작성함. 핵심 근거: `answerCheckIn`은 이미 core에 구현되어 규칙을 강제하고 있으나, Slack이 이 규칙을 태우려면 **PAT 인증과 다른 서명 검증 진입점 + Slack↔Que 사용자 매핑 + `via` enum 확장**이 새로 필요하다는 점이 이 항목의 실체다.

---

## 기획

### 목적/문제
Slack으로 발송된 체크인 알림(B-1, Incoming Webhook 딥링크)은 사용자를 웹으로 되돌려보내야만 응답이 가능하다. C-2는 Slack 메시지의 **버튼만으로 체크인에 즉답**(작업중/완료/시간변경/문제발생/…)하게 해 응답률과 상태 반영 속도(성공 지표: 하루 상태 응답률·상태 변경 소요 시간)를 끌어올린다. 이때 응답은 반드시 core `answerCheckIn`을 거쳐 웹과 **동일한 규칙·ChangeLog**가 적용되어야 한다(기획서 827행).

### 사용자 흐름
1. 스케줄러가 체크인을 만들고, 봇이 담당자에게 DM으로 질문 메시지를 보낸다 — 이때 메시지에 Block Kit 버튼(작업중/완료/시간변경/문제발생/나중에)과 `checkInId`를 실어 보낸다. (B-1이 텍스트+딥링크만 보냈다면 C-2가 이 메시지를 버튼형으로 승격)
2. 담당자가 Slack 안에서 버튼을 누른다 → Slack이 인터랙티비티 Request URL(Que의 서버리스 엔드포인트)로 서명된 payload를 POST.
3. 엔드포인트가 서명·타임스탬프를 검증하고, Slack user id를 Que user id로 매핑한 뒤 `answerCheckIn({ actorId, via: "slack" }, …)` 호출.
4. 단답형(작업중/완료/필요없어짐)은 그대로 확정. **문제발생(issue)·병합(merged)·시간변경**처럼 사유/도움 필요한 사람/재확인 시간·병합 대상이 필요한 응답은 Slack **모달(views.open, trigger_id)**을 띄워 detail을 받은 뒤 확정한다.
5. 확정되면 원본 메시지를 `chat.update`로 "✅ 완료로 응답함"처럼 갱신하고, 결과는 웹 팀 현황·변경 내역·오늘 화면에 그대로 반영된다.

### 수용 기준
- [ ] Slack 버튼 클릭이 `POST /api/slack/interactivity`로 도달하고, **서명 검증 실패/5분 초과 타임스탬프는 401로 거부**된다.
- [ ] 정상 응답은 core `answerCheckIn`을 경유해 처리되고, 생성된 ChangeLog·StatusLog의 `via`가 **`slack`**으로 남는다.
- [ ] 담당자 아닌 사람이 누른 버튼은 core 규칙대로 거부(NOT_AUTHORIZED)되고, 이미 응답된 체크인 재클릭·Slack 재시도(3초 초과 재전송)는 중복 없이 **멱등**하게 200으로 마무리된다.
- [ ] 문제발생·병합 응답은 버튼만으로 확정되지 않고 모달로 사유(및 병합 대상)를 받은 뒤에만 확정된다(사유 없는 문제발생 확정 불가).
- [ ] 버튼 응답 후 Slack 원본 메시지가 응답 결과로 갱신되고, 같은 변경이 웹 팀 현황/오늘 화면에 나타난다.
- [ ] Slack 미설정(토큰/시크릿 없음) 환경에서 엔드포인트가 안전하게 비활성(503)이고, 기존 mock/웹/MCP 경로는 무영향(빌드·lint·core 테스트 통과).

### 필요한 사용자 입력
- **Slack 앱 생성**(사용자만 가능 — HANDOFF 163행에서 "Slack 앱은 외부라 생성 불가"로 보류된 바로 그 블로커).
- **Bot 토큰**(`xoxb-…`, scope: `chat:write`, 모달·메시지 갱신용. 이메일 자동매핑 쓰면 `users:read.email` 추가).
- **Signing Secret**(요청 서명 검증용).
- **Interactivity Request URL** 설정: 배포된 `https://que.griff.co.kr/api/slack/interactivity`를 Slack 앱 대시보드에 등록.
- (선택) 8명 각자의 **Slack member ID ↔ Que 계정 매핑**. 이메일 자동 조회로 부트스트랩하거나, 링크 플로우로 1회 연결.

---

## 개발 계획

### 현재 상태 — 대부분 없음, 일부 골격
- **core `answerCheckIn`: 구현 완료(부분구현 아님).** `packages/core/src/data/mock-db.ts:895-938` — 담당자/관리자만, `ALREADY_ANSWERED`, `later`는 상태 미변경, 응답→상태 매핑은 `changeTaskStatus`(:120)를 태워 `assertStatusDetail`(`rules.ts:55`)·ChangeLog까지 일괄 적용. **C-2는 이 함수를 새 채널에서 호출만 하면 되므로 도메인 로직 재작성 불필요.**
- **웹 answer 라우트: 존재하나 Slack용 아님.** `apps/web/src/app/api/checkins/[checkInId]/answer/route.ts` 주석에 "Slack Bot(2단계)도 이 경로를 쓴다"라 적혀 있으나, 이 라우트는 `withApi`→`authenticate`로 **Bearer PAT를 요구**(`apps/web/src/lib/api/auth.ts:61-74`)한다. Slack은 PAT가 아니라 서명 payload를 보내므로 **이 라우트를 그대로 못 쓴다 — 별도 엔드포인트 필요**(주석은 낙관적, 정정 대상).
- **`via` enum에 slack 없음.** `packages/core/src/domain.ts:265` `changeViaSchema = z.enum(["web","mcp","cli"])` **및** DB 체크 제약 `db/supabase/schema.sql:154` `check (via in ('web','mcp','cli'))` — 두 곳 다 확장 필요.
- **Slack 코드·발송 계층(B-1) 없음.** notify/dispatch/webhook 모듈 검색 결과 0건. **C-2는 B-1(발송) 이후에만 의미**(선행 의존). `.env.local`에 SLACK_* 슬롯 없음.
- **User에 Slack 식별자 없음.** `domain.ts:14-21` User = id·name·role·avatarColor뿐. 매핑 저장소 신규 필요.

### 변경/신규 파일
신규
- `apps/web/src/app/api/slack/interactivity/route.ts` — **인터랙티비티 진입점**. 원문 body 읽기(`await request.text()`)→서명/타임스탬프 검증→`payload` 파싱→버튼 액션 분기(즉답 vs 모달 트리거)→Slack user 매핑→`getDb()`→`answerCheckIn({actorId, via:"slack"}, …)`→`persist()`→`chat.update`. **`withApi`를 쓰지 않는다**(PAT 아님).
- `apps/web/src/lib/slack/verify.ts` — HMAC-SHA256 서명 검증(`v0=` scheme) + 5분 replay 방어. Signing Secret는 env.
- `apps/web/src/lib/slack/client.ts` — Slack Web API 얇은 fetch 래퍼(`chat.postMessage`/`chat.update`/`views.open`). SDK 없이 서버리스 친화.
- `apps/web/src/lib/slack/blocks.ts` — 체크인 메시지 Block Kit 버튼 빌더 + 문제발생/병합 **모달 뷰** 정의(`checkInId`를 block value/`private_metadata`에 캐리). B-1 발송 메시지도 이 빌더를 공유.
- `packages/core/src/notify/slack-identity.ts`(또는 core 리졸버) — `resolveSlackUser(slackUserId) → Que userId`. 매핑은 신규 테이블/컬럼에서 조회.
- DB 마이그레이션 파일(`db/supabase/`에 신규 `.sql`) — (a) `change_logs.via` 체크 제약에 `'slack'` 추가, (b) Slack 매핑 저장(권장: `slack_identities(slack_user_id pk, user_id fk, slack_team_id)` 신규 테이블. 대안: `users.slack_user_id` 컬럼).

변경
- `packages/core/src/domain.ts:265` — `changeViaSchema`에 `"slack"` 추가(型 파생 `ChangeVia` 자동 반영).
- `packages/core/src/labels.ts` — via 표시 라벨이 없다면(검색 0건) 변경 내역 UI가 via를 어디서 렌더하는지 확인 후 "Slack" 라벨 노출 지점 보강.
- `apps/web/src/app/api/checkins/[checkInId]/answer/route.ts:11` — "Slack도 이 경로" 주석 정정(실제로는 별도 엔드포인트).
- (선택) answer 계열이 `merged`를 지원하려면 body에 `mergedIntoTaskId` 추가 — 현재 route/MCP 도구 모두 미전달이라 병합 응답은 core에서 거부됨(기존 갭. Slack 병합 버튼 지원 시 필요).

### 접근/설계
- **인증 분리**: Slack 트래픽은 Que 사용자 토큰이 아니라 Slack 서명으로 신뢰. 서명 검증 통과 후 **Slack user id → Que user id 매핑이 유일 신뢰원**. 매핑에 없는 Slack 사용자는 거부(권한 규칙 우회 방지). 매핑 부트스트랩은 `emailForUser`(`mock/users.ts:34`) + Slack `users.lookupByEmail`로 자동화 가능.
- **규칙은 그대로 core가 강제**: 본인만 응답(담당자/관리자), 문제발생 사유 필수, later는 미변경 — 전부 `answerCheckIn`/`changeTaskStatus`에 이미 있음. 엔드포인트는 얇은 어댑터(계획서 원칙 1·2 그대로).
- **detail이 필요한 응답의 UX**: `checkInResponseSchema`는 working/done/needs_reschedule/issue/not_needed/merged/later. 이 중 issue는 `detail.reason` 필수, merged는 대상 필수 → **버튼 한 번으로는 불충분**. Slack **모달**(버튼→`trigger_id`로 `views.open`→제출 시 확정)로 받거나, 최소구현이면 이들만 딥링크로 웹 폴백. 나머지 단답은 버튼 즉시 확정.
- **서버리스(Vercel) 제약**:
  - Slack은 3초 내 200 필요 → 서명 검증+DB 1회 쓰기+메시지 갱신은 충분히 빠름. `getDb()` load/mutate/persist를 **같은 인스턴스**에서(웹 answer 라우트와 동일 패턴, `lib/db.ts` 주석).
  - **원문 body 필수**: HMAC은 파싱 전 raw 문자열로 계산 → route에서 `request.text()` 먼저.
  - **멱등/재시도**: Slack은 200 못 받으면 재전송(`X-Slack-Retry-Num`). `answerCheckIn`이 `ALREADY_ANSWERED`(409)를 던지므로, 엔드포인트에서 이를 "이미 처리됨"으로 흡수해 200 반환(재시도 폭주 차단). in-memory 상태 없이 전부 DB.
  - 발송 트리거는 Vercel Cron으로(HANDOFF 33행 "스케줄러 Cron 전환")—단 이건 B-1/스케줄러 몫, C-2는 수신·응답 중심.

### 규모 — 중간
대략 순서: (1) `via` slack 확장(zod+DB 마이그레이션) → (2) Slack↔Que 매핑 저장소+리졸버 → (3) 서명 검증 유틸+인터랙티비티 엔드포인트(단답 경로) → (4) `chat.update`로 메시지 갱신 + 멱등/재시도 처리 → (5) 문제발생/병합 모달(views.open/submit) → (6) B-1 발송 메시지를 버튼형으로 승격(공유 blocks). B-1 발송이 선행되어 있으면 (3)~(5)가 코어. 도메인 로직 재작성이 없어 "큼"은 아니지만, 서명/모달/매핑/enum·DB 마이그레이션이 얽혀 "작음"도 아님.

### 리스크/주의
- **선행 의존(B-1)**: 발송 메시지가 없으면 응답할 대상이 없다. 발송이 텍스트+딥링크뿐이면 C-2에서 Block Kit 버튼으로 승격해야 함(범위 커짐).
- **잘못된 매핑 = 권한 사고**: Slack user를 엉뚱한 Que user로 매핑하면 "본인만 수정" 원칙이 뚫린다. 매핑은 1:1 보장, 미매핑은 거부.
- **enum 확장의 파급**: `changeViaSchema`(zod)와 DB `check` 제약을 **동시에** 안 바꾸면 slack via 쓰기가 런타임에서 깨진다. 변경 내역 라벨 UI도 slack 케이스 미처리 시 빈 값 노출 가능.
- **서명/replay 함정**: raw body 대신 파싱본으로 HMAC 계산하면 항상 검증 실패. 타임스탬프 5분 창·재시도 헤더 무시 시 중복 응답.
- **모달 없이 문제발생 버튼만 두면** core가 `STATUS_DETAIL_REQUIRED`로 거부 → 사용자에겐 그냥 "실패"로 보임. 모달 또는 딥링크 폴백을 반드시 짝지어야 함.
- **answer 라우트 주석의 착시**: 기존 코드가 "Slack도 이 경로"라 적어 재사용을 유도하지만 PAT 인증이 막는다. 별도 엔드포인트로 가는 결정을 명시.
- **DM 채널 제약**: 봇이 DM을 보내려면 사용자가 앱과 대화하거나 앱이 워크스페이스에 설치돼 있어야 함(운영 온보딩 항목).

---

## C-3 · 알림 설정(방해금지)·알림 허브

> 근거 기준일 2026-07-04. 읽은 파일: `/Users/griff_hq/Desktop/que/data/docs/que-product-plan.md`, `/Users/griff_hq/Desktop/que/apps/web/src/components/app/notifications-bell.tsx`, `/Users/griff_hq/Desktop/que/apps/web/src/lib/alerts-data.ts`, `/Users/griff_hq/Desktop/que/packages/core/src/domain.ts`, `/Users/griff_hq/Desktop/que/apps/web/src/app/(app)/settings/page.tsx`, `/Users/griff_hq/Desktop/que/apps/web/src/lib/db.ts`, `/Users/griff_hq/Desktop/que/db/supabase/schema.sql`, `/Users/griff_hq/Desktop/que/apps/web/vercel.json`.

> **선행 제약(가장 중요)**: CLAUDE.md "홈 정식 디자인·알림·설정 — 후순위(**프리뷰 제공 전 착수 금지**)". 기획서도 line 828 "앱 내 알림 화면은 Slack 발송 내역의 허브 역할을 겸한다 **(프리뷰 수령 후 구현)**". 따라서 **UI 구현은 디자인 프리뷰 수령 전 시작 불가**. 아래 계획은 (a) 프리뷰와 무관하게 먼저 확정 가능한 데이터/core 계층과 (b) 프리뷰 도착 후에만 착수하는 UI 계층을 분리한다. **"프리뷰 먼저"가 이 항목의 게이트.**

---

## 기획

### 목적/문제
알림을 "적게, 처리 가능하게" 보내려면(기획서 line 820) 사용자가 **언제(방해금지 시간대)·어디로(채널) 받을지**를 직접 정할 수 있어야 한다. 현재는 이 설정이 없어 방해금지 정책(line 194, 829, 850)과 채널 on/off를 강제할 근거 데이터가 존재하지 않는다. 또한 발송된 알림을 되짚어볼 **앱 내 허브**(Slack 발송 내역 겸용, line 828)가 없다.

### 사용자 흐름
1. 팀원이 `/settings`에서 "알림" 영역에 진입한다(현재 페이지는 폰트·비밀번호만 있음).
2. **방해금지 시간대**를 설정한다(예 22:00–08:00, KST). 자정 걸침 구간 허용.
3. **채널별 on/off**를 켠다/끈다: 앱 내(기본 on), Slack. (선택적 후속: 알림 종류별 on/off — 기획서 "보내는 알림" 13종, line 831–843.)
4. 저장 시 본인 설정만 갱신되고, 이 변경은 **팀에 공유되지 않고 조용히 기록만** 된다(line 876 "알림 설정 변경 = 조용히 기록만 할 변경").
5. 상단바 **벨(알림 허브)**을 열면 자기에게 발송된 알림 목록·읽음 상태를 보고, 각 항목의 딥링크로 이동한다. 방해금지 시간에 Slack이 보류된 항목은 여기에 쌓여 있다(line 829).

### 수용 기준
- [ ] `/settings`에서 방해금지 시작/종료 시각을 저장하면 Supabase에 영속되고 재로그인 후에도 유지된다(쿠키 아님).
- [ ] 채널 on/off(앱 내·Slack)를 저장·복원할 수 있다.
- [ ] 저장은 **본인 것만** 가능하고(타인 user_id 조작 차단), 실패 시 zod 검증 오류를 반환한다.
- [ ] 알림 설정 변경이 **팀 공유 ChangeLog로 나가지 않는다**(조용히 기록만, line 876 준수).
- [ ] core에 `isWithinQuietHours(prefs, now)`(및/또는 `shouldDeliver`)가 존재하고 자정 걸침 구간을 정확히 판정한다 — 향후 Slack 디스패처가 재사용.
- [ ] 알림 허브(벨)가 **영속된 알림 피드**를 읽어 읽음/안읽음과 딥링크를 보여준다(현재의 live 파생과의 관계는 프리뷰가 확정).

### 필요한 사용자 입력
- **디자인 프리뷰** — 알림 설정 화면 + 알림 허브(벨/전체 페이지) 디자인. **이것이 이 항목의 유일한 블로킹 입력**(CLAUDE.md 착수 금지 규칙).
- Slack Webhook URL / Bot 토큰 등 크레덴셜은 **이 항목에는 불필요**. 실제 Slack 발송은 별도 로드맵 항목(디스패처)의 몫이고, C-3는 그 발송이 참조할 설정·허브만 만든다. (설정에 "Slack 채널 on/off"를 두더라도 저장은 발송 구현과 독립.)

---

## 개발 계획

### 현재 상태 — 골격만(설정 페이지 존재) + 부분구현(벨은 live 파생, 영속 피드 아님)
- **알림 설정: 없음.** core `User` 스키마에 `notificationPreference` 미구현 — `packages/core/src/domain.ts:15–21`은 `id·name·role·avatarColor`만. 기획 데이터모델 초안(que-product-plan.md:672)의 `notificationPreference`는 미반영. DB `users` 테이블(`db/supabase/schema.sql:11–25`)에도 관련 컬럼 없음. 별도 `notification_preferences` 테이블 없음.
- **설정 페이지: 골격만.** `/Users/griff_hq/Desktop/que/apps/web/src/app/(app)/settings/page.tsx`는 폰트+비밀번호만, 폰트/테마는 **쿠키**로 유지(영속 설정 계층 아님).
- **알림 허브(벨): 부분구현.** `notifications-bell.tsx`는 팝오버 UI가 있으나 데이터는 `alerts-data.ts`의 **live 파생**(문제/확인필요/결제/기한초과를 DB에서 매 요청 계산, `getAlerts`)이라 **읽음 상태·영속 피드·발송 이력이 없다**. 기획이 말한 "Slack 발송 내역 허브"(line 828)와는 개념이 다름(파생 신호 ≠ 발송 기록).
- **Slack 발송: 없음.** 코드 전역에 Slack 연동 없음(유일 언급은 `apps/web/src/app/api/checkins/[checkInId]/answer/route.ts:11` 주석 — 2단계 Bot이 이 경로 재사용 예정).
- **스케줄러: 없음.** `apps/web/vercel.json`은 region만, Cron 미설정. 방해금지 경계·하루요약을 강제하려면 별도 스케줄 필요(현재 `db.ts:26–33`가 요청마다 sync 실행).

### 변경/신규 파일
프리뷰와 **독립**(먼저 진행 가능):
- `/Users/griff_hq/Desktop/que/db/supabase/` — **신규 마이그레이션 SQL**: `notification_preferences`(user_id PK/FK, quiet_start `time`, quiet_end `time`, quiet_enabled, channel_in_app, channel_slack, 선택적 category 토글 jsonb, updated_at) + `notifications`(id, user_id FK=수신자, kind, tone, title, body, href, read_at, slack_status `queued|sent|held_dnd|failed|skipped`, source_entity_type/id, created_at). 기존 `schema.sql` 패턴·`change_logs`(:144–157) 스타일 준수.
- `/Users/griff_hq/Desktop/que/packages/core/src/domain.ts` — `notificationPreferenceSchema`, `notificationSchema`(zod). 자정 걸침·HH:mm 검증 포함. MCP/CLI 재사용 대비 core에 둠(CLAUDE.md 규칙4).
- `/Users/griff_hq/Desktop/que/packages/core/src/rules.ts` — `isWithinQuietHours(prefs, now)` + `shouldDeliver(prefs, kind, channel, now)`(보내지 않는 알림 규칙 line 847–852를 한 곳에서). 순수함수 → 테스트 용이(`rules.test.ts` 옆).
- `/Users/griff_hq/Desktop/que/packages/core/src/index.ts` — 신규 스키마/헬퍼 export.
- `/Users/griff_hq/Desktop/que/apps/web/src/lib/supabase-db.ts` + core mock db(`createMockDb`) — prefs·notifications **load/persist**와 getter/setter 추가. 양쪽 로더 동기화 필수.
- `/Users/griff_hq/Desktop/que/apps/web/src/lib/notifications-data.ts` — **신규**. 허브 피드 읽기 계층(수신자 본인 것만). `alerts-data.ts`와 병렬 배치.
- `/Users/griff_hq/Desktop/que/apps/web/src/app/(app)/settings/notification-actions.ts` — **신규** 서버 액션. prefs 저장(본인만·zod·조용히 기록). 기존 `settings/security-actions.ts` + `toResult`(같은 db 인스턴스에서 mutation+persist, `db.ts:18–20`) 패턴 준수.

프리뷰 **도착 후** 착수:
- `/Users/griff_hq/Desktop/que/apps/web/src/components/settings/notification-settings.tsx` — **신규**. 방해금지 시간 + 채널 토글 UI. 기존 `font-settings.tsx`/`password-settings.tsx`와 동일 구성.
- `/Users/griff_hq/Desktop/que/apps/web/src/app/(app)/settings/page.tsx` — `NotificationSettings` 마운트.
- `/Users/griff_hq/Desktop/que/apps/web/src/components/app/notifications-bell.tsx` — 영속 피드 읽기·읽음 처리·설정 링크로 확장(프리뷰가 "live 신호 vs 발송 이력 vs 탭 병행"을 확정).
- (프리뷰가 요구할 때만) `/Users/griff_hq/Desktop/que/apps/web/src/app/(app)/notifications/page.tsx` 풀페이지 허브 — **추가 시 `apps/web/src/lib/menu.ts` IA 결정 필요**(사이드바 미노출 유지 권장, 고아 라우트 경고).

### 접근/설계
- **데이터 모델**: prefs는 사용자당 1행(테이블 분리 권장 — `users`를 인증 전용으로 유지). 방해금지는 KST 로컬 `time` 2개 + enabled 플래그로 저장, 비교는 core 헬퍼가 담당(한국은 DST 없음 → 단순). notifications는 **발송 기록/수신함**이라 파생 불가 → 영속 필수.
- **권한**: prefs·notifications 모두 **본인(수신자)만** 조회·수정. 서버 액션이 세션 user.id를 신뢰하고 클라이언트가 준 user_id는 무시(핵심 규칙 "본인 작업만 수정"과 정합).
- **ChangeLog**: 설정 변경은 line 876에 따라 **팀 공유 대상 아님**. `change_logs.entity_type` enum(:145–146)에 user/preference 없음 → **팀 ChangeLog 발행 금지**. 감사가 필요하면 `notification_preferences.updated_at` 또는 `visible_to=[]`인 조용한 별도 기록으로 한정.
- **서버리스(Vercel)**: in-memory 금지 → 전부 Supabase. **방해금지 경계 hold·하루요약(line 838, 850)의 실제 강제는 스케줄러(향후 Vercel Cron) + Slack 디스패처의 책임**. C-3는 그들이 읽을 prefs·헬퍼·허브 write 지점을 제공한다(`shouldDeliver`가 held_dnd로 판정 → 앱 내 피드에만 insert, line 829 그대로). getDb cache 경계(`db.ts:16–18` 주석) 준수: 액션은 db를 한 번 획득해 mutation·persist를 같은 인스턴스에서.
- **core 재사용**: 헬퍼·스키마를 core에 두어 향후 MCP `set_quiet_hours`/`get_notification_prefs` 도구가 web과 동일 규칙을 공유.

### 규모 — 중간
순서: (1) **프리뷰 수령 블록 해제 대기** — 동시에 데이터/core는 진행. (2) 마이그레이션 SQL + core 스키마/헬퍼(+ `rules.test.ts` 자정 걸침 테스트). (3) db load/persist + `notifications-data.ts` + `notification-actions.ts`. (4) **프리뷰 도착 후** 설정 UI. (5) 벨/허브 UI 확장(프리뷰가 신호↔이력 관계 확정). (6) lint·typecheck·build 검증(단, **dev 서버 끄고** build — CLAUDE.md 규칙5).

### 리스크/주의
- **착수 금지 위반**: UI를 프리뷰 없이 만들면 CLAUDE.md 규칙 위반. UI 단계는 프리뷰가 게이트 — 데이터/core만 선행.
- **개념 충돌(허브 정의)**: 현재 벨은 live 운영 신호(병목), 기획 허브는 "Slack 발송 내역". 둘은 다른 데이터다. 통합/병행/대체 여부는 **프리뷰가 결정**하도록 남긴다(탭 `신호 | 기록`이 유력).
- **순서 의존**: "발송 내역 허브"는 발송 로그를 전제 → **Slack 디스패처(별도 항목)**가 없으면 피드가 빌 수 있음. C-3 단독은 "prefs+허브 골격"까지가 정직한 완료선. 이 의존을 명시.
- **ChangeLog 오발행 주의**: 설정 변경을 일반 mutation처럼 팀 ChangeLog로 남기면 line 876 위반. entity_type enum도 미지원.
- **시간대·자정 걸침**: 22:00–08:00 같은 wrap 구간을 단순 `start<=t<=end`로 짜면 오판. 헬퍼에서 wrap 케이스 분기 + 테스트.
- **색 의미 고정**: 허브/토글 톤은 고정 규칙 준수(violet=회의록/응답대기 등). 벨 `TONE_DOT`(:10–14) 재사용.
- **양쪽 db 로더 동기화**: User/스키마 확장 시 mock(`createMockDb`)과 `supabase-db.ts` 로더를 함께 갱신하지 않으면 dev(mock)와 prod(Supabase) 동작이 갈린다.
- **IA 정합성**: 풀페이지 `/notifications` 추가 시 `menu.ts`가 정본 — 사이드바 미노출 결정을 명시하지 않으면 고아 라우트 위험.

---

## C-4 · 마일스톤/반복 업무 템플릿 재연결

**핵심 발견(먼저 읽을 것):** 이 항목은 "새로 만드는" 일이 아니다. 데이터 모델·도메인 규칙·mutation·스케줄러·시드·Supabase 영속화가 **이미 전부 구현·연결되어 있고**, 반복 템플릿 쓰기는 프로덕션에서 이미 저장까지 된다. 진짜 결손은 오직 **UI/IA** — 폼·목록 컴포넌트가 어디에도 import되지 않는 고아 상태이고, 메뉴·라우트가 없다. 따라서 C-4는 "화면 결정 → 연결" 작업이다.

---

## 기획

**목적/문제**
- 정기 반복 업무(예: 주간 스탠드업 준비, 월간 정산)와 프로젝트 마일스톤은 도메인·로직·시드가 이미 존재하나 **화면이 어디에도 붙어 있지 않아**(고아 컴포넌트) 팀이 쓸 수 없다. 재설계 IA에서 보류된 두 기능을 화면에 연결해, 반복 업무의 수기 재등록을 없애고 마일스톤 기한/위험을 한곳에서 드러낸다.

**사용자 흐름**
1. 팀원/PM이 새 화면(호스트 결정 필요)에서 반복 템플릿을 등록한다 — 제목·담당자·(선택)프로젝트·주기(매주/매월)·요일 또는 날짜·시작시각·소요시간. 등록 시 "다가오는 회차부터 Task 자동 생성" 안내.
2. 스케줄러가 회차 3일 전 시점에 해당 회차 Task를 자동 생성(멱등, 중복 방지). 생성된 Task는 기존 작업 목록/일정/스탠드업에 그대로 나타난다.
3. 만든 사람·관리자는 목록에서 템플릿을 켜기/끄기 한다(끄면 다음 회차부터 생성 중단).
4. PM은 마일스톤을 프로젝트별로 열람하고, 일정(캘린더)에서 드래그로 기한을 옮긴다(이미 동작). 재연결 범위에 따라 마일스톤 생성/수정/삭제와 태스크 연결을 이 화면에서 수행.

**수용 기준**
- [ ] 반복 템플릿 등록/목록/켜끄기 화면이 메뉴 또는 확정된 호스트 화면에서 접근 가능하고, 저장이 Supabase에 영속된다.
- [ ] 새 템플릿 등록 후 다가오는 회차(3일 이내)가 Task로 자동 생성되고, 재요청/새로고침에도 중복 생성되지 않는다(멱등).
- [ ] 템플릿 끄기 시 이후 회차 생성이 멈춘다. 켜기/끄기·생성은 각각 ChangeLog(`via: web`)에 남는다.
- [ ] 반복 템플릿의 관리(켜끄기)는 만든 사람과 관리자만 가능(`canManageRecurringTemplate`).
- [ ] 마일스톤이 결정된 화면에서 프로젝트별로 열람되고(기한·위험 상태), 재설계 IA 원칙(표·배지 우선, 색 의미 고정)을 지킨다.
- [ ] (범위에 마일스톤 CRUD/연결 포함 시) 마일스톤 생성·수정 및 태스크-마일스톤 연결이 저장·표시된다.

**필요한 사용자 입력**
- 외부 크레덴셜/계정: **없음**(기존 Auth.js·Supabase·PAT로 충분).
- 대신 **결정 3건**(이 항목의 실질 입력):
  1. **호스트 화면** — 반복 템플릿을 (a) 독립 메뉴 항목으로 부활시킬지, (b) `팀 현황(/team)`의 뷰 토글 탭으로 넣을지, (c) `프로젝트(/projects)` 안에 둘지. 프로젝트는 현재 메뉴 제외(미리보기)라 반복 템플릿을 여기 두면 다시 감춰진다 — 별도 화면 권장.
  2. **마일스톤 범위** — 이번엔 반복 템플릿만 재연결하고 마일스톤은 캘린더 드래그(현행) 유지인지, 아니면 마일스톤 관리 화면(생성/수정/위험표시)까지 포함할지.
  3. **태스크-마일스톤 연결 깊이** — 현재는 프로젝트 공유(`projectId`)로만 간접 연결. 태스크에 직접 마일스톤을 붙일지(→ 스키마 필드 추가·마이그레이션 필요) 결정.

---

## 개발 계획

**현재 상태 — 부분구현("백엔드 완성 + UI 고아")**
- 도메인 스키마: `RecurringTemplate` `packages/core/src/domain.ts:181-209`(주/월·요일/날짜·시각·소요·active·lastGeneratedFor), `Milestone` `domain.ts:116-125`(projectId·dueAt·riskStatus).
- 규칙: `canManageRecurringTemplate`/`assertCanManageRecurringTemplate` `packages/core/src/rules.ts:145-157`(생성자+관리자만).
- mutation·스케줄러(모두 구현·영속): `createRecurringTemplate` `mock-db.ts:655`, `setRecurringTemplateActive` `:733`, `nextOccurrenceDate` `:751`, **`syncRecurringTemplates` `:774`**(3일 창·멱등·생성 Task에 ChangeLog), `moveMilestone` `:593`.
- 영속화: `SupabaseQueDb extends MockQueDb` `apps/web/src/lib/supabase-db.ts:34`, `recurring_templates`·`milestones` 테이블 매핑 `:19,:25`. → 반복 템플릿 쓰기는 **프로덕션에서 이미 저장됨**.
- 스케줄러 구동 위치: `getDb()`가 매 요청 lazy 실행 — mock·Supabase 양쪽 `apps/web/src/lib/db.ts:27-28,34-36`.
- 서버 액션(존재·정상): `createRecurringTemplateAction`/`setRecurringTemplateActiveAction` `apps/web/src/app/(app)/projects/actions.ts:25-48`(core 사용·`via:"web"`). 마일스톤 드래그 `moveMilestoneToDateAction` `apps/web/src/app/(app)/calendar/actions.ts:121`은 **이미 라이브**(캘린더 렌더 `lib/calendar-data.ts:94`).
- 시드: 반복 템플릿 2건 `seed.ts:568`, 마일스톤 4건 `seed.ts:69`.
- **결손(=UI):** `CreateTemplateForm`·`TemplateList`(`apps/web/src/components/templates/*`)를 import하는 곳이 **전무**(grep 0건). `/templates`·`/milestones` 라우트 없음. `apps/web/src/lib/menu.ts`에 항목 없음. MCP/CLI 미노출(`packages/mcp/src`·`packages/cli/src` grep 0건).

**변경/신규 파일**
- `apps/web/src/app/(app)/templates/page.tsx`(신규) — 결정된 호스트가 독립 화면일 경우. 서버 컴포넌트에서 `getDb()`로 `recurringTemplates`+`users`+`projects` 조회, `canManageRecurringTemplate`로 `canManage` 계산해 `TemplateList`에 주입, `CreateTemplateForm` 렌더. (호스트를 `/team` 탭으로 정하면 `apps/web/src/app/(app)/team/*`에 뷰 추가로 대체.)
- `apps/web/src/app/(app)/projects/actions.ts`(수정) — 현재 `revalidatePath("/projects")` `:17` 고정. 새 호스트 경로도 revalidate하도록 수정(또는 액션을 새 라우트 폴더로 이전). **주의:** 이 액션은 `pm-actions.ts`의 `QUE_PM_WRITE` 쓰기차단을 거치지 않으므로 새 화면에서 곧바로 실 저장된다(의도된 동작).
- `apps/web/src/lib/menu.ts`(수정) — 호스트가 독립 메뉴면 항목 1개 추가. **CLAUDE.md 메뉴 절과 반드시 동시 갱신**(불일치=고아 라우트 규칙).
- `CLAUDE.md`·`HANDOFF.md`(수정) — "보류" 문구 해제, 확정된 화면/범위 기록.
- (마일스톤 범위 포함 시) `apps/web/src/components/milestones/*`(신규 목록/폼) + 코어에 `createMilestone`/`updateMilestone`/삭제 mutation 추가(`mock-db.ts` — 현재 `moveMilestone`만 존재) + 대응 서버 액션.
- (B-2 Cron 전환 시) `apps/web/src/app/api/cron/recurring/route.ts`(신규) — `db.syncRecurringTemplates()`+`persist()` 호출. 패턴 선례: `apps/web/src/app/api/calendar/sync/route.ts`(관리자 게이트+db 메서드+persist, 주석에 "배포 후 Vercel Cron" 명시). `apps/web/vercel.json`에 `crons` 항목 추가(현재 `regions`만).

**접근/설계**
- **화면 연결이 본질**: 코어·액션이 이미 있으므로 신규 페이지가 컴포넌트를 조립하고 `canManage`만 서버에서 계산해 넘기면 끝. 재구현 금지, `getDb()` 코어 계층 재사용.
- **스케줄러(서버리스 제약)**: 현재 `getDb()` 매 요청 lazy 실행은 멱등(`lastGeneratedFor`)이라 안전하나 요청마다 창 계산이 돈다. B-2에서 Vercel Cron의 스케줄 POST로 옮기고 lazy 호출은 제거 또는 유지(멱등이라 이중 안전). Cron 엔드포인트는 관리자/비밀 헤더로 게이트. **in-memory 금지 규칙 준수** — 상태는 Supabase에만.
- **권한**: 반복 템플릿=생성자+관리자(구현됨). 마일스톤 CRUD를 추가하면 프로젝트 owner/관리자 권한 규칙을 코어에 신설 필요.
- **마일스톤 위험 상태**: `moveMilestone`은 `dueAt`만 갱신하고 `riskStatus`는 자동 재계산하지 않음(`report-data.ts:211`가 `atRiskMilestones` 집계). 관리 화면을 넣으면 riskStatus 수동 설정 또는 연결 Task 완료율 기반 자동 도출을 설계 결정으로.
- **태스크-마일스톤 연결**: `Task`에 `milestoneId` 없음(`domain.ts:65-84` — `recurringTemplateId`만 존재). 직접 연결은 새 필드+Supabase 마이그레이션+정규화 왕복 처리. 간접(projectId 공유)로 충분하면 스키마 불변.

**규모: 중간**
- 반복 템플릿만 재연결(권장 최소 범위): **작음~중간**. (1) 호스트 화면 확정 → (2) 페이지 신설·컴포넌트 조립 → (3) 액션 revalidate 경로 정정 → (4) 메뉴+CLAUDE.md 동기화 → (5) lint/typecheck/build/브라우저 검증.
- 마일스톤 CRUD·태스크 연결·Cron 전환까지 포함: **중간~큼**(코어 mutation·마이그레이션·Cron·권한 추가).

**리스크/주의**
- **호스트 오판**: 반복 템플릿을 `/projects` 안에 두면 프로젝트가 메뉴 제외(미리보기)라 다시 숨는다 — 별도 화면 또는 `/team` 탭 권장.
- **revalidate 경로 불일치**: 액션이 `/projects`만 revalidate(`actions.ts:17`) — 새 화면 경로를 추가하지 않으면 등록 후 목록이 갱신 안 됨.
- **메뉴↔CLAUDE.md 불일치 → 고아 라우트**(프로젝트 규칙). 메뉴 추가 시 문서 동시 수정 필수.
- **쓰기차단 오해**: `QUE_PM_WRITE` 차단은 `pm-actions.ts`(PM 보드)만. 반복 템플릿 액션은 차단 대상이 아니어서 새 화면에서 즉시 실 저장 — "미리보기" 배너를 재사용하면 안 됨(잘못된 안내).
- **Cron 인증**: 새 Cron 엔드포인트는 반드시 비밀/관리자 게이트. 미인증 공개 시 임의 Task 생성 트리거 가능.
- **월말 처리**: 매월 반복은 1~28일로 제한(월말 오버플로우 회피, `domain.ts:191`) — 폼 max=28 유지, "말일" 옵션은 별도 설계 없이는 추가 금지.
- **build 규칙**: dev 서버 켜진 동안 `pnpm build` 금지(공유 `.next` 캐시 손상).

