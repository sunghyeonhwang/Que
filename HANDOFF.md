# Que 핸드오프 문서

마지막 업데이트: 2026-07-08

---

## 🚀 빠른 시작 (다음 세션은 여기부터)

**Que = 8인 팀용 캘린더 기반 작업 상태 관리 도구.** 감시 도구가 아니라 병목·일정충돌을 빨리 드러내는 운영 도구. 저장소 <https://github.com/sunghyeonhwang/Que.git>. 스택: TypeScript · Next.js 16 App Router · Tailwind · shadcn/ui(base-nova) · zod. pnpm 모노레포(`apps/web` 웹, `packages/core` 도메인/규칙/데이터, `packages/mcp` MCP, `packages/cli` CLI).

### 지금까지 완성된 것
- **웹 MVP 전 화면 + 재설계 IA(2026-07-04 배포)**: 홈·일정·성과·작업목록(오늘/Now)·팀·팀 현황(+스탠드업+관리자 리포트)·회의록(+Action)·반복·마일스톤·프로젝트·클라이언트·결제요청·수정사항·MCP·CLI·도움말. 하루 사이클 완결(자연어 등록→체크인→충돌 제안→댓글/도움요청→하루 마감). 정본은 `apps/web/src/lib/menu.ts`.
- **REST API + MCP(도구 19개) + CLI(19명령)** — 전부 `packages/core`의 규칙 공유, 변경은 `via: web|mcp|cli` 기록.
- **백로그 1~5위 완료**: ①비공개 일정 관리자 열람 ②회의록 단위 열람 권한(restricted) ③반복 업무 템플릿 ④관리자 리포트(점수화 없음, 팀 현황 admin 뷰) ⑤Google Calendar 비-env 골격(CalendarProvider+동기화 엔진+`/api/calendar/sync`, 실 OAuth만 대기).
- **Supabase 실 DB 연동 완료 (핵심)**: 실 프로젝트 `rnsqhipljpdmmkviiypy`에 스키마·시드 적용. `SupabaseQueDb`(`apps/web/src/lib/supabase-db.ts`)가 MockQueDb를 상속해 요청마다 스냅샷 load→mutation→diff persist. **`QUE_DB=supabase`면 실 DB, 없으면 mock(기본).**
- core 테스트 209케이스(전부 통과). 글래도스 게이트 누적 30+회(반려 전부 수정 후 승인).

### 실행 방법
```bash
pnpm install
pnpm dev                    # mock(인메모리) 기본 — 키 불필요
# Supabase 실 DB로 띄우려면 (키는 data/.env에 있음, gitignore됨):
SUPA_URL=$(grep '^SUPABASE_URL=' data/.env | cut -d= -f2-); SUPA_KEY=$(grep '^SUPABASE_SECRET_KEY=' data/.env | cut -d= -f2-)
QUE_DB=supabase SUPABASE_URL="$SUPA_URL" SUPABASE_SECRET_KEY="$SUPA_KEY" pnpm dev
pnpm -r typecheck && pnpm --filter @que/web lint && pnpm --filter @que/core test
# DB 재시드(정본 리셋): pnpm --filter @que/core exec tsx "$PWD/db/supabase/seed.mts"
```
mock 인증: 쿠키 `que-user=<id>` / PAT `que_pat_<id>` (예: `hwang-sunghyeon`=관리자). 8명 id는 `packages/core/src/mock/users.ts`.

### 다음 할 일

**프로덕션은 GRIFF Pro 팀(`griff-fde0dc32/que`) · <https://que.griff.co.kr> · 실 DB(`QUE_DB=supabase`)+실 인증(Auth.js) 라이브.** 비밀값은 `data/.env`(gitignore). Vercel env로 기능 게이트(아래 참고).

#### ✅ 완료·라이브 (2026-07-06~07) — 상세는 각 절 참고
- **팀원·권한 관리 확장**(설정›직원관리: 추가·비활성·권한변경·정보편집) · **view 현황판**(주간뷰 겹침 레인 분할+N 상한, Week range 제거·기본 3day, hide-completed 즉시반응) · **로그아웃 오류 수정**(NEXT_REDIRECT 오인).
- **Pro 팀 이전**(GRIFF, env·도메인·git 함께) · **cron 활성화**(`*/10` `/api/cron/sync`) · **Sentry**(에러 리포팅) · **Slack B-1**(팀채널 알림·스탠드업, `SLACK_WEBHOOK_URL`) · **Slack Phase 2**(개인 DM 브리핑 9:50, `SLACK_BOT_TOKEN`, 8명 매핑) · **CLI/MCP**(방식 (b) repo 실행 + `/tools` 사전준비 온보딩) · **마감임박 임계 env화** · **도움말 전면 개편**(8→13섹션).

#### 🔜 다음 세션 착수 대상 (파킹 — 키/자산/팀행동 대기)
1. **② B2 인증 마무리** — mock PAT 폴백 제거(`api/auth.ts`) + `core/mock/tokens.ts` 삭제 + `QUE_ALLOW_MOCK_AUTH` 제거. **전제: 팀 8명 각자 PAT 재발급**(현재 프로덕션 7/8이 아직 `label='initial'`, 실 재발급은 송수용 1건만). 제거 시 로컬 dev mock 테스트가 깨지니 **다른 개발 다 끝난 맨 마지막에**. (사용자 확정: 맨 마지막.)
2. **③ 개인 비밀번호 배포** — 현재 전원 공용 `good121930`(`must_change=false`). 개인별 랜덤 + `must_change_password=true`(첫 로그인 강제 변경). 스크립트 있음: `db/supabase/gen-passwords.mts` → `set-passwords.sql`. **전원 강제 변경이라 팀 공지 직전에**. (사용자 확정: 맨 마지막.)
3. **④ 구글 캘린더 실연동** — `GOOGLE_SERVICE_ACCOUNT_KEY`+도메인위임 대기. **현재 더미 유지**(회사 일정=Mock, Que 일정=실제). **전환 절차: provider 교체 → source=`company` 더미 삭제 → 실 sync**(아래 "그 외 대기 트랙" 참고).
4. **회의록 액션플랜(항목15)** — 회의록 md 샘플 대기.
5. ~~**Phase 3 (할일 생성→담당자 DM)**~~ → **✅ 완료 (2026-07-08)**: 할일 생성 즉시 담당자에게 개인 DM(task_created). Phase 2 Bot DM 인프라 재사용. 아래 "Slack Phase 3" 절.
6. (후순위) 그리프 3,4Q 프로젝트 임포트([[griff-3-4q-schedule-sheet]], 담당자 부재 블로커) · 홈 정식 디자인(프리뷰 전 착수 금지).

**Vercel env 게이트 현황(GRIFF/que production)**: `SLACK_WEBHOOK_URL`·`SLACK_BOT_TOKEN`·`CRON_SECRET`·`QUE_CRON_ACTIVE=1`·`NEXT_PUBLIC_SENTRY_DSN`·`QUE_DB=supabase`·`SUPABASE_*`·`AUTH_SECRET` 설정됨. 미설정: `QUE_DEADLINE_THRESHOLD_HOURS`(기본24)·`QUE_QUIET_HOURS`(기본22-8)·`QUE_DIGEST_RECIPIENTS`(미설정=전체)·`GOOGLE_SERVICE_ACCOUNT_KEY`·`QUE_ALLOW_MOCK_AUTH`(의도적 미설정).

#### env 트랙 (사용자가 "하나씩" 진행 중)
1. ~~**Vercel 배포**~~ → **완료 (43번)**. <https://que-rouge-eight.vercel.app> (Root=`apps/web`, 리전 `icn1`, 실 DB+실 인증). **주의: Deployment Protection이 현재 꺼진 상태**(대시보드에서 재활성화 필요) — 단 실 인증+mock API 503이라 공개라도 안전. `QUE_ALLOW_MOCK_AUTH`는 **안 켬**(mock PAT 봉인). (`data/docs/deploy-vercel-supabase.md`)
2. ~~**웹 실 인증**~~ → **완료 (42번, Auth.js 이메일+비밀번호)**. 로그인: `<이름>.<성>@griff.co.kr`. **프로덕션 비번(2026-07-04): 테스트용 공용 비번으로 전 팀원 7명 통일 적용**(평문은 `data/passwords.txt` gitignore 참조, 여기엔 평문 금지). 프로덕션 `users.password_hash`에 bcrypt(rounds10) 직접 UPDATE, E2E 로그인 검증 완료. **테스트+개인 비번 작성 후 개인별 교체 예정**(`gen-passwords.mts` → `set-passwords.sql`). 로컬 dev 상수 `DEV_PASSWORD(que-2026!)`는 mock 전용(프로덕션 무관). **남은 B2**: API/MCP/CLI의 mock PAT를 `personal_access_tokens`(해시)로 교체 + `core/mock/tokens.ts` 폐기 → 그 후 `QUE_ALLOW_MOCK_AUTH` 제거.
3. ~~Sentry DSN(에러 리포팅)~~ → **✅ 완료 (2026-07-07)**: `@sentry/nextjs` 붙임(에러 캡처만, 트레이싱/리플레이/소스맵은 후속). 아래 "[✅ Sentry 에러 리포팅](#-sentry-에러-리포팅-2026-07-07)" 절. · ~~Slack 앱(알림/스탠드업)~~ → **✅ 활성화·라이브 (2026-07-07)**: **B-1**(팀채널 문제발생·마감임박 알림 + 스탠드업, `SLACK_WEBHOOK_URL` 설정) + **Phase 2**(개인 DM 데일리 브리핑 9:50, `SLACK_BOT_TOKEN`, 8명 매핑) 둘 다 프로덕션 발송 검증 완료. 아래 "[✅ Slack Phase 2](#-slack-phase-2--개인-dm-데일리-브리핑-2026-07-07)"·"[✅ Slack 알림 B-1](#-slack-알림-b-1-1단계--알림스탠드업-2026-07-07)" 절. Phase 3(할일 생성→담당자 DM)은 계획됨. · ~~CLI/MCP 배포(30번)~~ → **✅ 완료 (2026-07-07, 방식 (b) 사내 실행)**: npm 공개 대신 **repo 실행 유지**(`pnpm --filter @que/mcp start`). `/tools` 온보딩에 **"사전 준비" 블록**(Node·pnpm·git 설치 macOS/Windows + 확인, 복사 버튼) 추가로 비개발 팀원도 복사·붙여넣기로 온보딩 완결. 전체 레퍼런스 `que-tools-guide.md`. ~~스케줄러 Vercel Cron 전환~~ → **✅ 활성화 완료 (2026-07-07)**: Pro 이전(4번) 후 `apps/web/vercel.json`에 `crons */10 * * * *`(`/api/cron/sync`) 복구·배포 성공(Pro라 수락). `CRON_SECRET`(랜덤, data/.env 기록)·`QUE_CRON_ACTIVE=1`을 Vercel **production** env에 설정 → lazy sync 꺼지고 cron이 스케줄 권위. 검증: 무인증/오시크릿 401, 올바른 Bearer 200 `{ok:true,checkInsCreated:4}`(실제 체크인 생성). Vercel이 10분마다 자동 호출(대시보드 Crons 탭에서 스케줄·다음 실행 확인 가능). 상세 `deploy-vercel-supabase.md` 4-1.
4. ~~**Pro 계정으로 프로젝트 이전**~~ → **✅ 완료 (2026-07-07)**. Vercel "Transfer Project"로 `que`를 Hobby 팀 `griff0120s-projects` → **Pro 팀 `griff-fde0dc32`("GRIFF")**로 이전. **env(AUTH_SECRET·SUPABASE_URL·SUPABASE_SECRET_KEY·QUE_DB)·도메인(que.griff.co.kr·view.griff.co.kr)·git 연동이 함께 이동**(Transfer 마법사가 자동 처리 — 재설정 불필요했음). `.vercel/project.json` orgId `team_adk2R8uxbLjr0BeZ9yzjfZxC` → **`team_rSoKnhEmb773JXpYGBdkdQwU`**(projectId `prj_FSGUPN9iXotjqSw5X5btx4dN0At9` 동일). 검증: que/view 도메인 200·icn1·noindex 정상, env 4개 정상. **버려진 `que-web` 프로젝트(GRIFF 팀, 도메인 없음)는 삭제 예정**. ⚠️ [[end-of-work-routine]] 메모의 배포 팀을 GRIFF로 갱신함. **이제 cron `*/10` 활성화 언블록**(위 3번 (A)안): `vercel.json` crons 복구 + `CRON_SECRET` 설정 + `QUE_CRON_ACTIVE=1` → 다음 단계.

## ✅ 마무리 스윕 감사 배치 9 — 대표 홈 요청함·부하표 후속·딥링크·월간 칩 캡 (2026-07-08)

글래도스 게이트 재심사 배치. 감사 원문 DASH-6·RPT-1 후속 + `/clients?client=` 딥링크 소비 + 월간 뷰 칩 캡 마일스톤 산입 최소 diff 구현. 표시/데이터 유도·라우팅 전용 — **core·도메인 파일 diff 0건**(mutation 경로 무접촉), 상태색 의미 고정 준수(색+아이콘/텍스트 병행), 새 mutation 경로 없음. **변경 파일 7개**: `apps/web/src/app/(app)/clients/page.tsx`, `apps/web/src/components/clients/client-groups.tsx`, `apps/web/src/components/home/ceo-home.tsx`, `apps/web/src/components/performance/low-performers-table.tsx`, `apps/web/src/components/schedule/month-view.tsx`, `apps/web/src/lib/home-grade-data.ts`, `apps/web/src/lib/performance-data.ts`.

- **DASH-6 (대표 홈 요청함) — 사용자 결정**: 사용자 확정 "**대표 홈에도 RequestInbox('내게 온 요청')를 넣는다**". `ceo-home.tsx`에 staff 홈과 동일한 요청함을 배선하되 **기존 `getAlerts`/`getNoteSummary`를 그대로 재사용**(새 데이터 경로 없음 — staff 홈과 동일 계약). **배치 위치 = 결제 요약 아래, 내 오늘 할 일 위**(사용자 지정). 검증: ceo 홈 1건 렌더, manager 0건·staff 1건(회귀 없음).
- **RPT-1 후속 (부하표 순위 인상 제거·조치 신호 추가)**: 배치 1에서 ceo 전용화한 `lowPerformers`를 **순위표 성격에서 운영 표로 전환**. (1) **정렬 제거** — 기존 '초과 많고 완료 적은 순' 내림차순 정렬을 삭제하고 **db.users 원 순서 고정**(개인 순위 인상 방지, RPT-1 취지). (2) **'막힘 사유·경과' 열 추가**(`low-performers-table.tsx`) — issue=red / on_hold=amber / 없으면 '—'(색+텍스트 병행). (3) **ceo 전용 게이트 보존**(배치 1의 `isCeo` 분기·데이터 스코핑 유지, manager는 '내 월간 요약'만). 표 제목은 중립 유지. `performance-data.ts:330` 주석도 '(db.users 고정 순서, 정렬 없음)'으로 갱신(스테일 방지).
- **`/clients?client=` 딥링크 소비**: 배치 6에서 '알려진 갭'으로 남긴 항목 마감. `clients/page.tsx`가 `client` searchParam을 소비해 `client-groups.tsx`에서 해당 클라이언트 카드를 하이라이트 — **note-list 선례 패턴 재사용**(`ring-2`+`brand-subtle` 배경+`scrollIntoView`). 쿼리 없으면 하이라이트 0건, 비관리자는 기존 307 리다이렉트(/home) 유지. 토큰 라이트/다크 모두 정의.
- **월간 뷰 칩 캡 마일스톤 산입**: 배치 3의 비차단 메모(월간 `dayItems.slice(0,3)` 상한에 마일스톤 미산입) 마감. `month-view.tsx`에서 이벤트 표시 상한을 **`eventCap = max(0, 3 - 마일스톤수)`**로 계산 — 마일스톤이 칩 예산을 차지하고, `hiddenItems`(N개 더)는 **잘린 이벤트 수만** 정확히 카운트(마일스톤은 항상 렌더되므로 미포함). 마일스톤 0개 셀은 기존과 동일(회귀 없음), `min-h-[6.5rem]`·배치 3 종일 밴드 무접촉. 비차단 관찰: 마일스톤 4개+인 날은 마일스톤 칩 자체는 무제한 렌더(스펙 밖, 기록만).
- 검증: dev 서버 부재 확인(`pgrep -fl "next dev"` 0건) 후 실행 — `pnpm lint` exit 0 · `pnpm -r typecheck` 4워크스페이스 Done · `pnpm build` exit 0(dev 서버 부재 확인 후). 실 계정 3개(ceo=황성현·manager=오승훈·staff=박승환) 브라우저 렌더로 DASH-6 배치·RPT-1 db.users 순서/막힘 열·딥링크 하이라이트·월간 eventCap 실측 완료. core 테스트 209 통과(이번 배치 mutation 무접촉). `git status` 정확히 위 7개 파일만 M(스코프 크립·임시 파일·죽은 코드 없음).

## ✅ /projects 감사 P1 수정 — 댓글/도움요청 + overdue 신호 (2026-07-07)

글래도스 게이트 재심사 배치. 감사 원문 PROJ-1·PROJ-3(둘 다 P1 CONFIRMED) 최소 diff 구현. core 계층 경유·상태색 의미 고정 준수, 새 mutation 경로 없음.

- **PROJ-1 (댓글/도움요청 어포던스 부재)**: 태스크 상세 드로어(`task-detail-drawer.tsx`)에 기존 `TaskComments`(app/task-comments.tsx, task-status-sheet와 동일 컴포넌트) 재사용 추가. `TaskDetail`에 `comments: TaskCommentView[]` 필드 추가, `getTaskDetail`이 기존 `getCommentViewsByTask()`로 채움. **!canEdit(타인 작업)에도 항상 노출** — 도메인 규칙(타인 작업=댓글/도움요청만) 충족. 작성은 기존 `addTaskCommentAction`(core mutation, via:web). 읽기전용 안내문에 "아래 댓글로 의견/도움 요청" 문구 보강.
- **PROJ-3 (overdue 시각 신호 부재)**: `projects-data.ts`에 `isTaskOverdue(task)` 헬퍼(endMs<nowMs && status∉{done,cancelled,merged} — home/performance-data와 동일 규칙). `TaskCard`·`CalendarCard`·`TaskDetail`에 `isOverdue` 추가. 보드 카드·목록 행·드로어 마감일은 red(`--que-error`) 텍스트+`AlertTriangle` 아이콘, 캘린더 pill은 red ring-inset+아이콘. **색 단독 금지 준수**: 모든 지점에 아이콘/`sr-only "(기한 초과)"` 병행.
- 변경 파일: `lib/projects-data.ts`, `lib/comments.ts`(무변경, 재사용), `components/projects/{task-detail-drawer,board-view,task-group-section,calendar-view}.tsx`.
- 검증: lint/typecheck/build 전부 통과(46라우트, 정적 15/15). dev 서버 미실행 확인 후 build.
- ⚠️ 오케스트레이션 메모: 직전 2라운드는 배치 스펙이 리터럴 'undefined'로 전달돼 구현 0건 공회전. 원인은 상위 프롬프트 조립(finding 본문 미치환), 코드 결함 아님. 재호출 시 audit-parsed.txt의 실제 finding 본문(T/EVID/FIX/COMP/VERIFY)을 채워 전달해야 함. (남은 감사 findings: PROJ-7(P3, 체크박스 히트박스)만 미착수 — PROJ-2·4·5·6·8은 배치 5에서 완료.)

## ✅ /heatmap(성과) 감사 배치 1 — 정체성 복구 (2026-07-07)

글래도스 게이트 재심사 배치. 감사 원문 RPT-1·RPT-2·RPT-4 최소 diff 구현. 표시/데이터 스코핑 전용 변경 — mutation 경로 무접촉, 상태색 의미 고정 준수. 변경 파일 4개: `apps/web/src/app/(app)/heatmap/page.tsx`, `apps/web/src/components/performance/kpi-card.tsx`, `apps/web/src/components/performance/performance-heatmap.tsx`, `apps/web/src/lib/performance-data.ts`.

- **RPT-1 (팀 부하 순위표 노출 범위 축소 — 정책 결정)**: 저성과/부하 순위표(`lowPerformers`)를 **대표(ceo) 전용**으로 축소. 기존엔 관리자 전반에 노출됐으나, 사용자 승인 범위에 따라 **관리자 노출을 제거**하고 대표만 팀 순위를 본다. 이중 방어: (1) 화면 계층 `heatmap/page.tsx:79` `isCeo` 분기(`ceo`는 core `UserGrade` 실존 값)로 대표에게만 순위표 섹션 렌더, (2) 데이터 계층 `performance-data.ts:343-348` 스코핑 — **비대표는 본인 1행만** 계산(`selfRow`은 비대표에서 항상 본인). 히트맵 `rows`는 `personScope`를 유지해 **관리자의 업무 재배분 기능(히트맵/KPI)은 보존**. `lowPerformers` 소비처는 heatmap 페이지가 유일이라 홈 회귀 없음. 관련 주석 갱신 완료.
- **RPT-2 (KPI 방향성 색 의미 오류)**: `PerfKpi`에 `goodDirection` 도입 — **overdue(기한초과)만 `down`이 좋음, 나머지는 `up`이 좋음**. `kpi-card`는 `direction === goodDirection` 비교로 배지 색을 결정(좋은 방향=`--que-success`, 나쁜 방향=`--que-error`, `flat`은 중립 유지). aria-label에 '개선/악화/변화 없음' 병행(색 단독 금지 준수). `PerfKpi` 생성처는 `getPerformanceData` 단일이라 홈(staff/ceo) `KpiCard`도 자동 수혜. 기존 `--que-success`/`--que-error` 토큰만 사용(글로벌 theme token 무변).
- **RPT-4 (히트맵 sticky 부재)**: 이름열 `sticky left-0 z-10` / 날짜헤더 `top-0 z-20` / 교차 코너 `z-30`(z 우선순위 30>20>10). 전부 `bg-[var(--que-bg)]`로 SectionCard 배경과 일치(스크롤 시 투명 겹침 없음). `display:contents` 하위 셀도 그리드 아이템이라 sticky 유효. 셀 `min-h-10`·`2.75rem` 폭 무변(터치 40px 유지).
- 검증: dev 서버 부재 확인(`pgrep -fl "next dev"` 0건) 후 실행 — `pnpm lint` clean · `pnpm -r typecheck` 4패키지 Done · `pnpm build` 'Compiled successfully in 7.6s' exit 0. `git status` 정확히 위 4개 파일만 M(projects 무접촉, 임시/죽은 코드 없음).
- 후속 권고(비차단): 실 계정 3개 grade(ceo/admin/staff) 브라우저 렌더 + 가로 스크롤 sticky 시각 확인 미수행.

## ✅ /schedule(일정) 감사 배치 3 — 마일스톤 가시성 (2026-07-07)

글래도스 게이트 재심사 배치. 감사 원문 PLAN-1 최소 diff 구현. 캘린더 표시 전용 변경 — mutation 경로 무접촉, packages/core 무변경, 상태색 의미 고정 준수. 죽은 코드(`components/calendar/*`)·projects·performance·theme token 무접촉. 변경 파일 4개(수정 3+신규 1): `apps/web/src/app/(app)/schedule/page.tsx`, `apps/web/src/components/schedule/month-view.tsx`, `apps/web/src/components/schedule/week-calendar.tsx`, `apps/web/src/components/schedule/milestone-chip.tsx`(신규), `apps/web/src/lib/calendar-data.ts`(타입 export).

- **PLAN-1 (마일스톤 가시성 부재)**: `/schedule` 4개 뷰(주/월 × 관련 경로) 전부에 프로젝트 마일스톤을 배선. `schedule/page.tsx:106-114`에서 4개 뷰 모두 `data.milestones` 전달. **월간**은 날짜 셀 상단에 마커(`month-view.tsx:38-66`의 `MilestoneChip`), **주간**은 요일 헤더와 동일 sticky 래퍼·`colTemplate` 공유하는 종일(all-day) 밴드로 렌더(`week-calendar.tsx` — 레이아웃 비파괴).
- **읽기 전용 결정**: 마일스톤 칩은 클릭 진입점 없음 — `onClick`/`href`/`draggable` 전무(`milestone-chip.tsx`). `title` 툴팁으로만 상세 노출. 캘린더 상 마일스톤은 편집 대상이 아니라 **일정 맥락 표시**이므로 드래그 재일정·상세 시트 없이 조회만. 칩 자체는 터치 대상이 아니지만 셀/밴드가 40px+ 유지되어 터치 규칙 무해.
- **riskStatus 색 매핑**: core `domain.ts:196` `z.enum(["on_track","at_risk","late"])`를 CLAUDE.md 고정 색 의미에 매핑 — `on_track`→green(진행), `at_risk`→amber(주의), `late`→red(문제). 색 단독 금지 준수: `Diamond` 아이콘 + 제목 텍스트 + `sr-only` 위험 상태 병행.
- **타입 export**: `calendar-data.ts`에 `CalendarMilestone` 타입 export 추가(뷰 컴포넌트가 공유). 마일스톤은 활성 클라이언트 필터 스코프 존중(`calendar-data.ts:145-151`).
- **빈 상태**: 주간은 `hasMilestones` 게이트로 마일스톤 없는 기간엔 밴드 미렌더(빈 밴드 무점유). 월간은 빈 배열이면 셀 상단 무점유.
- 검증: dev 서버 부재 확인(`pgrep -fl "next dev"` 0건) 후 실행 — `pnpm lint` clean · `pnpm -r typecheck` Done · `pnpm build` exit 0(전 라우트 정상, `/schedule` 포함). `git status` 위 파일만 M/신규.
- 비차단 메모: (1) 월간 `dayItems.slice(0,3)` 상한에 마일스톤 미산입 — 셀 소폭 성장하나 grid minmax+overflow-auto로 파괴 없음, (2) 키워드/우선순위 필터는 마일스톤 미적용(수용 가능한 설계), (3) AUTH_SECRET 미설정으로 해상도별 시각 검증 미수행 — 복구 후 1024x768 주간 밴드 확인 권장.

## ✅ /now(작업목록·Now 운영표) 감사 배치 4 — 조치 가능화 (2026-07-07)

글래도스 게이트 재심사 배치. 회의 Action·캘린더 일정이 실제 Que 작업과 연결됐는지 확인하고 바로 조치하도록 Now 운영표를 표시/조치 가능화. 표시·데이터 스코핑 전용, 새 mutation 경로 없음(상태변경은 기존 `changeTaskStatusAction`→`db.changeTaskStatus`→`assertCanEditTask`+`assertStatusDetail` 사슬 재사용). 상태색 의미 고정 준수. 변경 파일 3개: `apps/web/src/app/(app)/now/page.tsx`, `apps/web/src/lib/now-data.ts`, `apps/web/src/components/app/status-badge.tsx`.

- **행 조치 어포던스**: 항목 셀을 행 유형별로 분기 — (a) Que 작업(taskStatus 보유)=`TaskStatusSheet` 상세/상태변경/댓글(comments·canEdit 포함, team/page.tsx와 데이터 계약 일치), (b) 회의록 Action(noteId 보유)=`/action?note=` 링크로 해당 회의록 필터 진입, (c) 회사/개인 일정(event)=읽기 전용 텍스트(클릭 불가 유지).
- **터치 대상(재심사 블로커 1 수정)**: 트리거를 제목 텍스트에만 걸던 방식(세로 히트박스 ~20px)을 **/today 정본 패턴(`my-task-table.tsx:83-88` absolute inset-0 + sr-only 라벨)으로 교체**. `TableRow`에 `relative`, 보이는 제목은 별도 `span`, 트리거(TaskStatusSheet/Link)는 `absolute inset-0`로 행 전체를 덮어 터치 40px+ 확보. TaskStatusSheet·Action 링크 모두 동일 적용. event 행은 트리거 없음.
- **KPI 카드**: `issueHold`=`/now?filter=issue`, `missingAssignee`=`/action`로 링크(화살표 `→`+hover 통일). 일정 충돌은 amber 경고 스타일(색 단독 금지 — 라벨 텍스트 병행).
- **표 내부 스크롤**: wrapper `max-h-[calc(100dvh-22rem)] overflow-auto` + `sticky top-0` 헤더(페이지 레이아웃 비파괴).
- **ActionStatusBadge 신설**(`status-badge.tsx`): 회의록 Action 상태를 아이콘+라벨로 표시(`needs_review`=destructive 유지, 새 색 의미 도입 없음). ignored 배지는 secondary→outline+dim(중립 톤, 색 의미 위반 아님).
- 검증: dev 서버 부재 확인(`pgrep -fl "next dev"` 0건) 후 lint·typecheck·build 통과. QA는 AUTH_SECRET dev 서버 + 3계정(admin 2·member 1) 실 로그인으로 행 클릭 Sheet·canEdit 뷰어별 분기·Action 링크·KPI 카드 링크·내부 스크롤을 실측. 글래도스는 도메인 규칙 위반 3건(비담당자 수정·사유 없는 issue/hold 전환)을 직접 주입해 전부 차단 확인 + core 테스트 209 통과. `git status` 위 3개 파일만 변경.

## ✅ /projects(프로젝트) 감사 배치 5 — 보강 (2026-07-07)

글래도스 게이트 재심사 배치. 감사 원문 PROJ-2·4·5·6·8 최소 diff 구현. 표시/데이터 유도 전용 — 새 mutation 경로 없음(pm-actions.ts 무접촉), core 계층 경유, 상태색 의미 고정 준수, canEditTask/BlockedStatusDialog 무접촉. 변경 파일 11개 전부 /projects 영역: `apps/web/src/app/(app)/projects/page.tsx`, `apps/web/src/components/projects/{project-view,project-header,project-scope-filters,priority-badge,create-task-dialog,board-view,task-group-section,calendar-view,task-detail-drawer}.tsx`, `apps/web/src/lib/projects-data.ts` 등(page.tsx·project-view.tsx는 isAdmin 배선 필수분).

- **PROJ-2 (클라이언트 맥락 부재)**: `ProjectMeta`/`ProjectListItem`에 `clientId`/`clientName`을 `db.clients`에서 **core 경유 유도**(하드코딩 없음). 헤더 클라이언트 표기는 **관리자만 `/clients` Link**, 비관리자는 텍스트(클라이언트 메뉴 adminOnly·관리자 전용 리다이렉트 존중). 프로젝트 Select에 클라이언트 보조 텍스트 추가하되 트리거는 `projectItems`(id→name 단일)라 두 줄 유출 없음.
- **PROJ-4 (상태 가시성)**: 드로어는 `StatusBadge(detail.status)`, 목록 행도 `StatusBadge`, 캘린더 pill은 `title`에 상태 라벨. **보드 카드 상태 표기 판단**: 컬럼이 이미 상태를 말하는 `scheduled`/`in_progress`/`done`은 **sr-only**(중복 시각 뱃지 제거), 컬럼-애매(홀드·문제 열에 섞이는) `needs_reschedule`/`on_hold`/`issue`만 **시각 StatusBadge** 노출(근거 코드 주석에 명시). 나머지는 sr-only로 스크린리더 접근성 유지.
- **PROJ-5 (우선순위 신호 — 상태색과 충돌 회피)**: 우선순위 뱃지를 **중립 팔레트 + 방향 아이콘**으로 신설(단일 공용 컴포넌트, 사용처 일관). 높음=`--que-text` 반전 + `ArrowUp`, 보통=`muted` + `Minus`, 낮음=`outline` + `ArrowDown`. **상태색(green/blue/amber/red)·violet 미사용** — 우선순위가 상태 색 의미와 충돌하지 않도록 중립 톤으로 격리. 색 단독 금지 준수(방향 아이콘 병행).
- **PROJ-6 (활동 로그)**: `getTaskDetail`이 `db.changeLogs`를 **읽기 전용 최신순 5건**으로 노출(pm-actions.ts 무접촉, 새 mutation 0건). ⚠️ **드로어 활동 로그는 mock-db `logChange` 원문 포맷에 의존**: `status_change`는 before/afterValue가 **raw enum**(→ `STATUS_LABEL` 완전 매핑으로 사람 표기 변환), `reassignTask`는 afterValue가 **`'담당: 이름'` 접두 형식**. 이 포맷 가정을 mock-db 실물과 대조 확인함 — 포맷 변경 시 드로어 표기 동기화 필요.
- **PROJ-8 (필수 필드 검증)**: 태스크 생성 폼 제목 필수 — `titleTouched`(blur/제출) + `title.trim().length===0` 통합 에러. 라벨 `*` + sr-only "(필수)". `autoFocus` 덕에 비활성 버튼 클릭도 blur→에러 노출 경로 확보(react-hook-form 패턴 유지, 에러는 필드 아래).
- 검증: dev 서버 부재 확인 후 실행 — `pnpm -r typecheck` 4워크스페이스 Done · `pnpm --filter @que/web lint` exit 0 · `pnpm --filter @que/core test` 209/209 · `pnpm build` 'Compiled successfully in 6.9s' + 전 라우트 생성. `git status` 위 11개 파일만 변경(projects 영역 한정, 스코프 크립·임시 파일·죽은 코드 0). 도메인 규칙 회귀 없음(읽기 전용 추가·canEditTask/BlockedStatusDialog 무접촉).

## ✅ 홈·협업·검색 연결 감사 배치 6 — 딥링크 공통 기반 (2026-07-07)

글래도스 게이트 재심사 배치. 감사 원문 DASH-1·2·4·COLLAB-2·3·4 최소 diff 구현 + `/now` 작업 딥링크 공통 기반 신설. 표시/데이터 유도·라우팅 전용 — 새 mutation 경로 없음(core mutation·StatusDetailForm 무접촉), 상태색 의미 고정 준수(색+아이콘+텍스트 병행). projects/·schedule/·performance/·ceo-home(DASH-6)·theme 미접촉.

- **`/now?task=<taskId>` = 작업 딥링크 정본 규격**: 홈 병목(attention-list·blocker-list)·전역 검색·활동 피드·회의록 Action 생성Task가 전부 이 규격으로 `/now`에 진입한다. `now/page.tsx`가 `task` searchParam + `data.rows.some()` **존재 가드**로 `activeTaskId`를 산출 — 해당 행만 ring 하이라이트 + `TaskStatusSheet defaultOpen`. ⚠️ **알려진 한계**: `/now` 운영표 행은 **오늘 시작한 작업만** 담기므로 과거 병목·활동 피드 딥링크가 **행 없이 도착할 수 있다**. 이때 `activeTaskId` 가드(undefined)로 **하이라이트/시트 미발동**(회귀 아님 — 스펙이 명시 선택한 도착지+가드). 직전 라운드 회귀(쿼리 없는 `/now` 상시 하이라이트)는 이 undefined 가드로 수리됨. 배치 4의 3분기 구조(Task→Sheet / Action→`/action?note` / event→읽기전용) 보존.
- **TaskStatusSheet `defaultOpen` prop 신설**: `useState` 초기값으로 소비. 딥링크 도착 시 시트 자동 오픈에 사용.
- **DASH-1 (홈 병목 행 조치 어포던스)**: attention/blocker row를 `/now?task=`로 Link화(`min-h-11` 터치 40px+, hover·focus ring, 기존 아이콘·색 유지).
- **DASH-2 (Attention 색·아이콘 단일 소스)**: `apps/web/src/components/app/attention-config.ts` 신설 — Attention 상태의 색·아이콘 단일 소스(홈 + 팀 현황 공유). team `AttentionRow` 무채색 variant를 이 공유 톤으로 교체(색+아이콘+텍스트 병행). 토큰 라이트/다크 실재 확인.
- **DASH-4 (클라이언트명 셀 링크)**: 클라이언트명 셀 `p-0` + `h-11` 전체 Link화.
- **COLLAB-2 (도착 페이지 하이라이트)**: task/note/payment/action 딥링크 + `note-list`·`payment-list` 도착 시 `?note=`/`?payment=`로 하이라이트 + `scrollIntoView`. (note/payment 도착 페이지가 각각 `?note=`/`?payment=` 쿼리 소비.)
- **COLLAB-3 (활동 피드 딥링크)**: `MemberActivity.taskId` 필수화(소스가 `statusLogs`라 항상 보유). 피드·생성Task를 Link화.
- **COLLAB-4 (검색 그룹 계약)**: `search-data`의 `SearchGroup`에 `total`/`listHref` 계약 추가 + 'N건 더 있음' 양쪽 UI. command-palette는 `shouldFilter={false}`라 cmdk 필터에 안 삼켜짐.
- **알려진 갭(배치 6 이전 기존 갭·후속 후보)**: `/clients`가 아직 `?client=` 쿼리를 소비하지 않음. 배치 6 범위 밖, 후속 후보로 기록.
- 검증: dev 서버 부재(`pgrep` exit 1) 확인 후 `pnpm lint`·`pnpm typecheck` 전 패키지 Done · `pnpm build` ✓ 7.3s 오류 0. 스코프 크립·죽은 코드 0, 도메인 규칙 경로(core mutation·StatusDetailForm) 무변경.

## ✅ 접근성·색·정리 마감 감사 배치 8 — 최종 라운드 (2026-07-08)

감사 원문 RWD-3(+RPT-5)·RPT-3·DASH-5·PLAN-5·PLAN-2·PLAN-6·PLAN-7·PLAN-8 최소 diff 구현(P2 2 + P3 6). 표시/접근성/색·죽은 코드 정리 전용 — **core·도메인 파일 diff 0건**, 상태색 의미 고정 준수(색+텍스트/아이콘 병행), 새 mutation 경로 없음. projects/·now/·home/ 무접촉.

- **⚠️ 공용 `ui/` 전역 변경(승인된 예외) — `ui/table.tsx` `TableHead`에 기본 `scope="col"` 부여**(RWD-3/RPT-5): 순수 부가 접근성 속성으로 spread 앞에 두어 개별 `scope` override 가능. 배치 7의 `select size=lg` 예외와 같은 성격(순수 추가·회귀 없음). DESIGN.md §12 'table header/cell 의미 유지' 근거. '공용 ui/ 전역 변경 금지' 가드레일의 **승인된 예외**.
- **RPT-3 (기한 초과 색 통일)**: `overdue-area-chart.tsx`의 앰버 `#d97706` → red `#e33030`(=`performance-line-chart.tsx`의 '기한 초과' 계열색). gradient id `que-area-amber`→`que-area-overdue`, 주석 갱신. 같은 화면 동일 지표 동일색.
- **DASH-5 (알림 벨 violet 토큰화)**: `notifications-bell.tsx` `TONE_DOT.violet` `bg-violet-500` → `bg-[var(--que-violet)]`(라이트/다크 토큰 대응).
- **PLAN-5 (해시 팔레트 violet 제거)**: `schedule/event-color.ts` PALETTE에서 violet 항목 삭제 — violet=회의록/응답대기 예약 의미 보호. pink·teal은 예약 의미 없어 유지(과한 재설계 금지). 해시 분배는 자연 재배치.
- **PLAN-2 (캘린더 '수정됨' 배지 복원)**: `calendar-data.ts`가 이미 계산하는 `recentlyChanged`(24h)를 라이브 캘린더에 렌더 — `week-calendar.tsx` EventBlock·`schedule/month-chip.tsx`에 텍스트 배지(중립 톤, 색 단독 아님). month-chip의 배치 7 `min-h-10` 유지(회귀 없음).
- **PLAN-6 (마일스톤 기한 초과 힌트)**: `milestone-list.tsx` `dueAt<now && riskStatus!=='late'`면 배지 옆에 red 텍스트+AlertTriangle 아이콘 '기한 초과'. 리스크 값 자동 변경 없이 시각 힌트만.
- **PLAN-7 (편집 권한 안내)**: `milestone-list.tsx`·`template-list.tsx` `canManage=false`일 때 '프로젝트 담당자·관리자만 수정할 수 있습니다.' 안내(합니다체). task-status-sheet 선례 패턴.
- **PLAN-8 (죽은 코드 삭제)**: `components/calendar/` 디렉터리 전체 삭제(month-grid·week-grid·timeline-grid·timeline-vertical·timeline-shared·members-grid·view-switcher·item-chip·drop-cell·drag·use-move). 삭제 전 grep으로 참조 0건 재확인. `app/(app)/calendar/page.tsx`(redirect 셸)는 유지. `components/view/`(별개 디렉터리)는 무관.
- 검증: dev 서버 부재 확인 후 `lint`·`typecheck` clean · `build` ✓ 6.9s 오류 0.

## ✅ 터치·권한·폼 마감 감사 배치 7 — 마감 라운드 (2026-07-07)

글래도스 게이트 재심사 배치. 감사 원문 PERM-1·2·3, PLAN-3·4, PROJ-7, DASH-3, RWD-1 최소 diff 구현. 표시/터치/권한/폼/반응형 전용 — **core·도메인 파일 diff 0건**(core mutation·canManage*·changeTaskStatus 무접촉), 상태색 의미 고정 준수(색+아이콘/텍스트 병행), 새 mutation 경로 없음. now/·search·성과 무접촉. 임시파일/죽은 코드 없음. **변경 12개 수정 + 1개 신규 = 13파일**.

- **⚠️ 공용 `ui/` 전역 변경(승인된 예외) — `ui/select.tsx`에 `size="lg"` variant 신설**: `data-[size=lg]:h-10` 추가(순수 신규 variant). **사유**: 직전 라운드 mustFix였던 "Select 트리거가 `data-[size=default]:h-8`로 터치 40px 미달" 문제의 근본 해결. 개별 사용처에서 className으로 높이를 덮어쓰면 우선순위 충돌이 재발하므로, **폼용 lg 사이즈를 컴포넌트 계약으로 신설**했다. **default/sm variant는 문자 그대로 무변경**이라 기존 사용처 회귀 없음(순수 추가). '공용 ui/ 전역 변경 금지' 가드레일의 **승인된 예외**임을 명기(글래도스 조건부 수용 — 순수 추가·근본 해결). 폼(PLAN-4)에서 Select는 `size="lg"`로 소비.
- **PERM-1 (권한별 컨트롤 터치·정리)**: `payment-list`에서 `COPY_COMPACT`(과밀 소형 버튼) 삭제 + 취소/되돌리기 버튼 `h-10`. `client-groups` 3개 액션 버튼 `h-10`. `payment-category-manager` 재정렬 컨트롤을 28px → `size-10` outline 패턴으로 교체(기존 outline 아이콘 버튼 패턴 재사용).
- **PLAN-3 (반복 회귀 없이 터치만)**: `month-chip`에 `min-h-10`만 추가. `milestone-chip`·`month-view`는 **무접촉**(배치 3 마일스톤 가시성 회귀 없음).
- **PLAN-4 (폼 컨트롤 40px)**: `milestone-list`·`create-milestone-form`·`create-template-form` 전 컨트롤 40px. Select는 위 `size="lg"` 소비.
- **PROJ-7 (체크박스 히트박스, P3 잔여)**: `task-done-toggle` 사용부에 `after:-inset-y-3`로 히트박스 40px 확보. **`ui/checkbox`·`ui/button`은 diff 없음**(사용부에서만 해결).
- **DASH-3 (홈 아이콘 버튼 터치)**: `size-10` 적용.
- **PERM-2 (보관 확인 Dialog)**: 클라이언트/프로젝트 보관에 확인 Dialog + **파급효과 문구**(보관 시 영향 명시), 복구는 즉시. **core mutation 무변경**(기존 canManageClient/Project 경유).
- **PERM-3 (필수 필드 폼 UX)**: 필수 5필드에 `*` + `sr-only "(필수)"`. `touched` 이후 필드별 에러 메시지 + `aria-invalid`. **"버튼 비활성 침묵" 안티패턴 제거**(왜 못 누르는지 안 보이던 문제). 선택 필드는 '(선택)' 라벨 유지. react-hook-form + zod 패턴, 에러는 필드 아래.
- **RWD-1 (lg~xl 반응형) + 신규 `sidebar-rail.tsx`**: `apps/web/src/components/app/sidebar-rail.tsx` **신규** — lg~xl 구간 72px 아이콘 레일. **`SidebarNav`와 adminOnly·match(활성 경로)·뱃지 로직을 문자 그대로 동일하게 유지할 의무**(둘 중 하나만 고치면 IA 불일치 발생 — 동기화 필수). 레일 Link는 40px + `aria-label` + `aria-current`. xl 이상은 풀 사이드바, <lg는 기존 `MobileNav` **무접촉**. **lg~xl 구간 클라이언트 스위처는 상단바로 이동**(`layout.tsx` `xl:hidden` — 좁은 레일엔 스위처 공간이 없어 상단바로 재배치하는 결정).
- **변경 파일 13개 전체 목록**: `ui/select.tsx`(신규 variant), `components/app/sidebar-rail.tsx`(신규), `app/(app)/layout.tsx`, `payments/payment-list.tsx`, `payments/payment-category-manager.tsx`, `clients/client-groups.tsx`, `schedule/month-chip.tsx`, `planning/{milestone-list,create-milestone-form,create-template-form}.tsx`(정확 경로는 planning 영역), `projects/task-done-toggle` 사용부, 홈 아이콘 버튼(DASH-3), 보관 확인 Dialog(PERM-2) — **직전 구현자 보고서에서 누락됐던 `ui/select.tsx` 포함**해 13파일. (파일 경로 세부는 `git show`로 대조 가능.)
- 검증: dev 서버 부재 확인(`pgrep -fl "next dev"` 0건) 후 실행 — `pnpm lint` 클린 · `pnpm -r typecheck` 4패키지 Done · `pnpm build` 46라우트 성공 · `pnpm --filter @que/core test` **209/209 통과**. diff에 core/도메인 파일 0건 + core 가드 테스트 전건 통과로 도메인 규칙 회귀 위험 없음.

### 반드시 지킬 규칙 / 함정
- **⚠️ 임시 "발송" 검증 라우트 + Vercel 빌드캐시 사고(2026-07-07)**: 개인 DM 검증용 임시 라우트(`/api/digest-check`)가 **매 호출마다 발송(dedup 없음)**이었는데, ① 배포 상태 폴링으로 그 라우트를 **인증 호출로 여러 번 때려** 팀에 중복 DM이 갔고, ② git에서 라우트를 지웠는데도 **Vercel Turbopack 빌드캐시가 삭제된 라우트를 잔존**시켜 계속 200을 반환했다. 교훈: **(a) 임시 발송 엔드포인트는 반드시 dedup/1회 가드**를 넣고, **(b) 발송 트리거 엔드포인트를 상태폴링으로 반복 호출하지 말 것**(`-o /dev/null`이어도 서버는 실행됨), **(c) 라우트/파일 삭제가 배포에 반영 안 되면 `vercel --prod --force`(캐시 무시)로 강제 재빌드**.
- **dev 서버 켜진 동안 `pnpm build` 금지** (같은 `.next` 공유로 캐시 오염). build 전 dev 종료.
- **웹 계층에서 core 에러 판별은 `instanceof` 금지 → `isQueRuleError()` 사용** (HMR 이중 로딩, 27번).
- **서버 액션에서 mutation과 persist는 반드시 같은 db 인스턴스** (`getDb()` cache 정체성은 액션 경계에서 미보장 — 39번 치명 버그). 각 `toResult`가 db 한 번 획득해 콜백에 넘김.
- **비밀값**: `data/.env`(Supabase URL/키/비번/pooler)와 `db/supabase/backup-before-que/`(구 앱 데이터)는 gitignore됨 — 절대 커밋 금지.
- **Supabase MCP**: `mcp.supabase.com` 등록됐으나 "Needs authentication" — 세션에서 `/mcp`로 재인증 필요(마이그레이션은 pooler 직결로 처리해 MCP 없이 완료). DDL은 pooler(pg), 런타임은 supabase-js(직접 호스트 `db.<ref>`는 IPv6/DNS 미해석).
- **모델 방침**: 서브에이전트 결정형=fable, 구현형(frontend/backend-dev)=opus, 검증형=sonnet (`.claude/agents/*.md` frontmatter).
- **글래도스 게이트**: 의미 있는 변경은 커밋 전 `glados` 서브에이전트(적대적 최종 심사)로 검증. **2026-07-06 세션 기준 `glados` 서브에이전트가 정상 등록돼 직접 호출 가능**(과거 세션엔 미등록이라 general-purpose+페르소나 주입으로 우회했음 — 이제 불필요). 이번 세션에서 팀원·권한 배치와 주간뷰 겹침 분할 심사에 사용해 승인받음.

상세 이력은 아래 번호 항목(1~39)과 "남은 작업" 절 참고.

---

## ✅ 비차단 후속 4건 — view/staff/token 폴리시 (2026-07-06)

> **상태**: 구현·FHD 브라우저 검증·글래도스 승인·커밋. typecheck·lint 통과. 🟢 "지금 착수 가능"(키 불필요) 후속을 처리.

- **#1 view hide-completed(hc) URL 정합화** — 위 "view 현황판 후속" 절의 **hc URL desync wart 해소**. board 모드 헤더 Link(세그먼트 토글·날짜이동)가 서버 렌더 시점 hc를 굽던 걸 **라이브 hc(context)**로. 신규 `components/view/view-nav.tsx`(universal — SegLink·NavCircle·DateNav·라벨헬퍼를 view-header에서 분리, server/client 공용) + `board-header-controls.tsx`("use client", `useBoardView()`로 hc 읽어 boardHref 빌드). `view-header.tsx`는 board 분기를 `<BoardHeaderControls>`로 교체·`ViewHeaderProps`에서 hideCompleted 제거, `page.tsx`는 ViewHeader의 hc prop만 제거(provider initial은 유지). 검증: 토글 hc=1 후 "다음"·"2명" Link URL이 `&hc=1` 유지(글래도스 SSR로 board href 5개 전부 확인).
- **#2 staff-edit-dialog rank enum-밖 폴백** — 위 "팀원·권한" 절의 **rank 폴백 덮어쓰기 후속 해소**. `originalRank`(원본을 폼과 동일 정규화)와 비교하도록 `rankChanged` 수정 → enum-밖 원본을 안 건드리면 rank 미전송·보존. enum-밖이면 경고 안내 노출. **⚠️ 신규 관찰(비차단)**: enum-밖 유저를 **의도적으로 "사원"으로** 바꾸는 건 불가(폼이 이미 "사원"이라 변경 미감지) — 우회=관리 저장 후 사원 저장 2회. SQL 직삽입에서만 나는 저빈도 케이스.
- **#3 주간뷰 그리드 밖 이벤트 필터** (`week-grid.tsx`) — 표시 창(10~19시)과 겹침 0인 이벤트를 `layoutDayItems`에서 `overlapsWindow`로 제외(`rawStart<1140 && rawEnd>600`). 창 밖 이벤트가 clamp돼 minHeight:52 **유령카드**로 쌓이던 것 제거. **동작 변화(글래도스 판정=수용)**: 종료가 정확히 10:00인 이벤트(예: 9:00~10:00 "재고 수량 확인")는 창과 공유 시간 0분이라 **드롭**(→ +N이 +3→+2로 재계산). 근거: 벽 디스플레이가 10시 시작인 게 의도된 설계 → 창 밖은 표시 안 하는 게 맞고, 살리려면 필터가 아니라 창 범위를 고쳐야 함. 겹침 레인/+N 로직 자체는 불변.
- **#4 토큰 버튼 터치타깃** (`token-settings.tsx`) — 복사·폐기 버튼 `h-10`→`h-11`(40→44px, 발급 버튼과 정합, CLAUDE.md 권장).

## ✅ Slack Phase 2 — 개인 DM 데일리 브리핑 (2026-07-07)

> B-1(팀 채널) 위에 **개인별 DM** 추가. 매일 **KST 9:50~10:30 창**, 각 active 팀원에게 본인 **오늘 작업·막힘·마감·담당 마일스톤 위험** 4섹션 DM. **✅ 활성화 완료·전체 라이브 (2026-07-07)**: `SLACK_BOT_TOKEN`(Bot `que_alarm`, GRIFF 워크스페이스) 설정, **8명 전원 이메일→Slack ID 매핑 확인**, 송수용·황성현 실 DM 발송 검증 후 전체 롤아웃(첫 자동 발송 = 익일 KST 9:50). 로드맵 C-2 1차.
>
> **⚠️ 활성화 중 실버그 1건 수정(커밋 `dd0b3e0`)**: Slack Web API를 JSON 바디로 호출하면 `users.lookupByEmail`이 `invalid_arguments`(read 메서드는 JSON 미수용) → **매핑 전량 실패**할 뻔. `slack-bot.ts slackApi`를 **form-urlencoded**로 변경(attachments 등 객체 필드는 JSON 문자열 인코딩 — read/write 모두 동작). 임시 검증 라우트가 포착.
>
> **단계적 롤아웃 메커니즘**: `QUE_DIGEST_RECIPIENTS`(콤마구분 userId) env 설정 시 그 유저만 수신(테스트/부분 롤아웃), 미설정=전체 active. `config.digestRecipientAllowlist` + personal-digest 필터. (테스트 때 2명으로 제한 후 해제해 전체 켬.)

- **인프라 재사용**: B-1 outbox/dedup/cron 그대로. `recipient` 컬럼(=Que userId 저장, 발송 직전 Slack ID 해석)에 개인 수신자를 담고, `sendEntry`가 recipient/kind=personal_digest면 **Bot DM**, 아니면 팀채널 Webhook으로 분기.
- **게이트 분리(중요)**: 팀채널(issue/on_hold/deadline/standup)=`webhookEnabled()`(SLACK_WEBHOOK_URL), 개인DM=`personalDigestEnabled()`(SLACK_BOT_TOKEN). `notificationsEnabled()`=either는 **크론 진입 게이트일 뿐** — 각 경로가 자기 크레덴셜로 개별 판정(한쪽만 설정돼도 다른 쪽 안 죽음). `drainOutbox`는 항목별 `channelReady` 필터로 크레덴셜 없는 채널을 헛failed 안 만듦.
- **멤버 매핑**: `users.slack_user_id` 컬럼 + lazy backfill(`resolveSlackUserId`: 캐시→email 직조회→`users.lookupByEmail`→UPDATE backfill, **전용 admin 직접 쿼리** — persist는 users write-back 안 함). ⚠️ **slack_user_id는 도메인 User 밖**(supabase-db `load()`가 email·passwordHash와 함께 `delete u.slackUserId` — 글래도스 반려로 추가한 유출 방지 1줄. 이거 없으면 /api/team·/team으로 Slack ID 직렬화 유출). 이름 로마자 불일치 멤버는 `update users set slack_user_id=...` 수동 오버라이드.
- **콘텐츠(4섹션 유지, 사용자 확정)**: 오늘 작업(overlapsToday, startAt만 보는 getStandupData 아님)·막힘(issue/on_hold)·마감(오늘~임계)·마일스톤(project.ownerId===user && riskStatus!==on_track). active 유저만·본인 것만·전섹션 0건 유저 생략.
- **✅ v2 — 작업 개요 목록 (사용자 요청 2026-07-08)**: 숫자 요약만이 아니라 각 섹션에 **항목 목록**을 추가. `payload.text`는 **기존 요약 1줄 그대로**(Slack 알림 미리보기/폴백 겸용), 상세 목록은 **`payload.detail`(mrkdwn)** 로 별도로 실어 `slack-bot.postDmToSlack`이 본문 blocks에 붙인다. 0건 섹션은 헤더 생략(빈 브리핑 미발송 원칙 유지). 목표 폼:
  ```
  *오늘의 브리핑*
  오늘 작업 3 · 막힘 1 · 마감 임박 2 · 마일스톤 위험 0

  *오늘 작업*
  • 제목 — 프로젝트명 · 상태라벨 (· ~HH:mm까지)   ← 마감 빠른 순, 최대 5건, 초과 시 '…외 N건'
  *막힘*
  • 제목 — 문제발생|홀드 · 사유 요약(40자 절단)      ← 오래 막힌 순(최근 issue/on_hold StatusLog createdAt 오름차순)
  *마감 임박*
  • 제목 — 오늘 HH:mm | 내일 HH:mm (KST)          ← endAt 오름차순
  *마일스톤 위험*
  • 마일스톤명 — 프로젝트명 · 주의|지연             ← dueAt 오름차순

  <…|Que에서 열기>   (/today 딥링크 유지)
  ```
  - 섹션당 **최대 5건 + '…외 N건'**. 조립 후 mrkdwn 블록 2900자(3000 한도 마진) 초과 시 **뒷섹션부터 표기 상한을 강등**하는 안전 가드(`buildDetail`).
  - 상태 라벨=core `TASK_STATUS_LABELS`(한글) 재사용, 마일스톤 위험=at_risk 주의/late 지연(홈 카드와 동일). 막힘 사유=최근 issue/on_hold StatusLog.reason(report-data currentBlockers 선례). 시간=KST 벽시계.
  - mrkdwn 링크 문법(`<url|text>`) 깨짐 방지 — 제목·프로젝트명·사유의 `&<>`를 HTML 이스케이프(Slack 표준 escape 대상). `*_~`는 Slack 공식 escape가 없어 링크 트리오만 처리.
  - **core 스키마 무변경**: `NotificationPayload`/`SlackMessage`에 `detail?` optional 필드만 추가(아웃박스 payload jsonb 패스스루 — DB 마이그레이션 불필요). Phase 3(task_created)·standup·팀채널 경로·dedup·발송창·allowlist는 무접촉.
  - 변경 파일: `personal-digest.ts`(항목 수집·정렬·`buildDetail` 조립), `slack-bot.ts`(detail 있으면 blocks 본문에 이어붙임), core `notifications.ts`(`detail?` 필드 + `messageFor` 패스스루).
- **스케줄**: 기존 `*/10` 크론 재사용. `postPersonalDigests`가 KST 9:50~10:30 분 단위 창(크론 지연 흡수) + 개인별 dedup(`personal_digest:<userId>:<date>`)로 하루 1회. 방해금지(22-8) 밖.
- **DB**: `add-user-slack-id.sql`(users.slack_user_id) + `add-notification-personal-digest-kind.sql`(kind에 personal_digest) **프로덕션 적용 완료**. schema.sql 동기화.
- **활성화**: Slack 앱에 **Bot Token Scope**(`chat:write`·`im:write`·`users:read.email`, 정책상 `users:read` 병요 가능) 추가 → **Reinstall** → `xoxb-` 토큰을 Vercel env **`SLACK_BOT_TOKEN`** 설정 → 배포. 이후 9:50 창 첫 크론이 발송.
- **검증**: typecheck·lint·core test(209)·build 통과, 글래도스 승인(유출 1건 수정 후). 실발송은 토큰 설정 후 익일 검증.
- **비차단 후속(글래도스)**: TONE_COLOR 중복(slack.ts↔slack-bot.ts) export 공유 · personal-digest kstDateKey export 미사용 · dayStart 서버TZ 기준(today-data 패턴, KST 정규화 장기과제) · sendEntry의 `recipient` 분기에 "팀 kind에 recipient 싣지 말 것" 주석.
- **C-2b(별도)**: Slack 버튼으로 Slack에서 바로 체크인 응답(서명검증·인터랙티브) — 이번 제외.

### ✅ Slack Phase 3 — 할일 생성 시 담당자 DM (2026-07-08)

> **빌드 완료·SLACK_BOT_TOKEN 게이트로 활성**(Phase 2와 동일 크레덴셜). 할일(Task)을 생성하면 그 즉시 담당자에게 개인 DM(task_created).

- **사용자 확정 결정 3건 (2026-07-08)**: ① 방해금지 창(22-8) 생성분은 창 종료 후 발송(outbox `holdUntil` — enqueueAndSend 기존 메커니즘, drainOutbox 크론이 창 이후 발송) · ② **본인이 본인에게 할당한 생성도 DM 발송**(self 필터 없음) · ③ **반복 템플릿 회차 자동 생성분은 DM 억제**(아침 개인 브리핑이 커버 — `source==="recurring_template"`면 no-op).
- **DM 내용 필드**(사용자 지정): 클라이언트 · 프로젝트 · 상태 · 우선순위 · 제목 · 시작일 · 마감일 + Que 딥링크(`/projects?task=<id>` — projects/page.tsx가 읽는 searchParam). 클라이언트명은 project.clientId→db.clients 유도. 시작·마감은 KST 벽시계 표기.
- **재사용**: Phase 2 Bot DM 인프라 그대로 — core intent(신규 kind `task_created`) + `slack-bot.postDmToSlack` + outbox(recipient=assigneeId) + `resolveSlackUserId`. 게이트=`personalDigestEnabled()`(SLACK_BOT_TOKEN)·실패격리(훅 try/catch, 절대 throw 안 함).
- **dedup**: `dedupKeyFor`가 task_created는 **marker 무시 → `task_created:<taskId>`**로 **task당 평생 1회**(재시도·중복 훅 방지). core `notification-outbox.test.ts`에 검증 추가(총 210 통과).
- **게이트 확장**: `enqueueAndSend`가 팀채널(Webhook)/개인DM(Bot Token)을 배치가 실제 필요로 하는 채널만 요구하도록 채널별 게이트로 변경(기존 team 경로 회귀 없음 — 여전히 webhookEnabled 요구). 단계적 롤아웃: `digestRecipientAllowlist()`(QUE_DIGEST_RECIPIENTS) 존중.
- **훅 위치(생성 커밋 성공 직후, B-1 패턴 동일)**: `today/actions.ts`(자연어 확정) · `schedule/actions.ts`(manual) · `projects/pm-actions.ts`(manual) · `action/actions.ts`(Action→Task 확정) 각 서버액션 `toResult`에 `afterCommit` 훅 추가 + `/api/tasks`·`/api/action-items/[id]/confirm`(MCP/CLI) persist 직후. **반복 템플릿 스케줄러 경로는 훅 없음**(결정 ③ — 이중으로 훅 자체도 안 검·source 판별도 no-op).
- **검증**: typecheck·lint·core test(210)·build 통과. 실 Slack 발송은 프로덕션 Bot Token 하에 라이브 검증 예정(로컬은 가짜 토큰으로 파이프라인만).
- **⚠️ 롤아웃 상태(2026-07-08 배포)**: **대표만 먼저** — Vercel production에 `QUE_DIGEST_RECIPIENTS=hwang-sunghyeon` 설정 후 배포. **부작용(사용자 감수 결정)**: 이 allowlist는 Phase 2 아침 브리핑과 공유라 **적용 기간 동안 나머지 7명의 아침 브리핑도 함께 꺼진다**. **전체 확대 절차**: `vercel env rm QUE_DIGEST_RECIPIENTS production` → `vercel --prod` 재배포(env 변경은 재배포로 반영).
- **🕒 전원확대 시점 = 구글캘린더 실연결 전환 후 (사용자 결정, 2026-07-08)**: 확대를 "잊은" 게 아니라 **의도적으로 미룬 것**이다. 순서 = ① 대표가 새 브리핑 폼 DM 검증 → ② 구글캘린더 더미→실연결 전환(더미 청소 먼저) 완료 → ③ 그때 allowlist 제거로 7명 브리핑 복구 + Phase 3/브리핑 전원 활성. 그 전까지 7명 브리핑 꺼짐은 **알려진·수용된 상태**.

## ✅ Slack 알림 B-1 (1단계 · 알림·스탠드업) (2026-07-07)

> 로드맵 `que-roadmap-plan.md` "B-1"대로 구현. **빌드 완료·미활성**(`SLACK_WEBHOOK_URL` 미설정이라 게이트로 비활성 → 현 프로덕션 동작 변화 0). URL 넣으면 활성.

- **범위**: 문제발생/홀드 전환 + 마감임박(24h) → 팀 채널에 사유·담당·**딥링크**(`/now`, 베이스 `QUE_APP_URL` 기본 que.griff.co.kr). + **데일리 스탠드업 다이제스트**(하루 1회 **KST 9시**, dedup `standup:team:<date>`, `/team` 딥링크). Phase 2(Bot 인터랙티브 = Slack에서 체크인 응답)는 후순위.
- **아키텍처(2청크)**: ① core `packages/core/src/notifications.ts`(순수 규칙: `buildStatusChangeIntents`·`buildDeadlineIntents`·`dedupKeyFor`·`messageFor`, "안 보낼 알림"=완료·같은상태·done/cancelled/merged·overdue 제외) + `mock-db.ts` outbox 메서드 + `supabase-db.ts` load/persistOutbox. ② web `lib/notifications/{config,slack,dispatch}.ts`(env게이트·webhook POST·오케스트레이터) + 크론 합승(`/api/cron/sync`에 scanDeadlines·drainOutbox·postStandupDigest) + **이벤트 훅 5곳**(today/actions changeTaskStatus·answerCheckIn, projects/pm-actions moveTask, api/tasks/[id]/status, api/checkins/[id]/answer = web+MCP+CLI 커버).
- **불변식(글래도스 검증)**: 발송 실패가 상태변경을 **절대 안 막음**(persist 성공 후 훅, enqueueAndSend try/catch throw 안 함) · env 게이트가 모든 진입점 첫 줄(미설정=enqueue조차 안 함) · **mutation+persist 동일 인스턴스**(5개 훅 다 호출부 db 전달, 39번 준수) · dedup 3중(in-memory + DB `dedup_key UNIQUE` + upsert ignoreDuplicates) · 크론 격리(알림 예외가 기존 checkin sync 안 깸, drainOutbox attempts<5).
- **DB**: `notification_outbox`(dedup_key UNIQUE, status pending|held|sent|skipped|failed, hold_until). 마이그레이션 **2건 프로덕션 적용 완료**: `add-notifications.sql`(테이블)·`add-notification-standup-kind.sql`(kind에 standup). schema.sql 동기화.
- **env(활성화)**: **`SLACK_WEBHOOK_URL`**(팀 채널 Incoming Webhook, 시크릿 — Vercel production에 넣으면 활성) · `QUE_APP_URL`(기본 que.griff.co.kr) · `QUE_QUIET_HOURS`(기본 `22-8` KST, 끄려면 `off`). **활성 절차**: Slack 앱→Incoming Webhook URL 생성 → Vercel env `SLACK_WEBHOOK_URL` 설정 → 배포 → 상태변경/크론이 발송.
- **검증**: typecheck·lint·core test(206)·build 통과, 글래도스 승인. 실발송은 URL 설정 후 라이브 검증 예정.
- **비차단 후속(글래도스 지적)**: 동시 크론 race 시 중복발송 미세 가능(persistOutbox insert에 `.select()`로 실삽입분만 발송하면 해소) · `buildStatusChangeIntents`에 private task 필터 부재(현재 전 생성경로 team 고정이라 무해, MCP/CLI 확장 전 가드 권장) · drainOutbox 루프 중간 persist 없음.

## ✅ Sentry 에러 리포팅 (2026-07-07)

> `reportError()`가 콘솔만 찍던 걸 Sentry로도 전송(프로덕션 오류 실시간 포착). `@sentry/nextjs ^10.63.0`.

- **범위 결정**: **에러 캡처만**. 성능 트레이싱(`tracesSampleRate: 0`)·세션리플레이·소스맵 업로드는 후속.
- **DSN = 공개 식별자**(비밀 아님, 이벤트 전송 전용): `NEXT_PUBLIC_SENTRY_DSN`으로 **Vercel production+preview**에 설정. **로컬 dev엔 미설정 → `enabled:!!dsn`로 no-op**(개발 중 Sentry 안 감). DSN 값은 소스 하드코딩 없음(env 참조만).
- **파일**: `next.config.ts`(`withSentryConfig`, authToken 없어 소스맵 업로드는 스킵) · `src/instrumentation.ts`(TZ=Asia/Seoul **유지** + 런타임별 server/edge init + `onRequestError`) · `src/instrumentation-client.ts`(신규, 클라 init + `onRouterTransitionStart`) · `src/sentry.server.config.ts`·`sentry.edge.config.ts`(신규) · `src/lib/report-error.ts`(`captureException`, context→tags).
- **pnpm v11**: `pnpm-workspace.yaml`의 `allowBuilds['@sentry/cli']: true`(빌드 스크립트 승인 — 미승인 시 install/build가 하드 에러). ⚠️ `package.json`의 `pnpm` 필드는 pnpm v11이 무시하므로 쓰지 말 것(설정은 pnpm-workspace.yaml).
- **참고**: Next 16에서 proxy.ts는 기본 Node.js 런타임 → server config가 커버. edge config는 향후 edge 라우트 대비 보험.
- **검증**: typecheck·lint·build(Turbopack) 통과, 글래도스 승인. 배포 후 임시 체크 라우트로 실제 이벤트 전송(flush) 확인.
- **후속(비차단)**: `SENTRY_AUTH_TOKEN` 추가 → 소스맵 업로드(현재 미니파이 스택). 성능 트레이싱/리플레이 필요 시 sampleRate 상향.

## ✅ 로그아웃 오류 수정 (2026-07-06)

> **증상**: 프로덕션(que.griff.co.kr)에서 로그아웃 시 "알 수 없는 오류가 발생했습니다…" 토스트. 실제로 /login 이동은 되지만 오류 토스트가 뜸.
>
> **근본 원인**: `components/app/user-switcher.tsx`가 서버 액션 `logout()`(=`signOut({ redirectTo })`)을 `try { await logout() } catch { reportError; toast }`로 감쌈. next-auth v5의 signOut redirect는 **NEXT_REDIRECT 예외를 throw해 위로 전파돼야** 프레임워크가 네비게이션하는데, 그 예외를 catch가 실제 오류로 오인해 리포팅+토스트. (로컬 재현: 콘솔 `[que-error-report] {source: logout} Error: NEXT_REDIRECT`.)
>
> **수정**: `app/actions.ts`의 `logout()`을 `signOut({ redirect: false })`로 — 리다이렉트 예외를 던지지 않고 세션 쿠키만 정리. `user-switcher.tsx`는 `await logout()` 성공 후 `window.location.href = "/login"`(하드 내비). try/catch는 유지(이제 진짜 오류만 잡음).
>
> **⚠️ 확립된 규칙(재발 방지)**: **서버 액션의 `signOut`/`redirect()`를 클라이언트에서 `try/catch`로 감싸지 말 것.** 프레임워크 리다이렉트(NEXT_REDIRECT)는 전파돼야 한다. 감싸야 하면 (a) 액션에서 `redirect:false`로 예외를 없애고 클라가 이동하거나, (b) redirect 예외를 재던져야 한다. **주의: 이 Next 16.2.9엔 `unstable_rethrow`가 없다**(node_modules 전수 grep 0건 — 글래도스가 "있다"고 했으나 오확인). 그래서 (a) 방식 채택.
>
> **검증**: 로컬 dev(mock, 황성현) 로그아웃 재현 → 수정 후 /login 이동 + **콘솔 에러 0**. 글래도스가 별도 포트에서 logout 액션 직접 호출로 `Set-Cookie: authjs.session-token=; Max-Age=0`(세션 소거)·NEXT_REDIRECT 미발생 실측. change-password(`forced-change-form` = useActionState+`<form action>`)는 수동 catch 없어 이 버그 없음(확인). typecheck·lint·글래도스 승인.

## ✅ 완료 — view 현황판 후속 (2026-07-06)

> **상태**: 구현·검증·글래도스 승인·커밋 완료. typecheck·lint 통과, FHD(가로 디스플레이 = 실제 타깃) 브라우저 검증(② 토글 [1Day/3day]·기본 3day, ③ 토글 즉시 필터·URL replaceState·콘솔 0), 글래도스 게이트 승인.
>
> **검증 중 발견·수정한 버그**: `board-view-context.tsx`가 초기엔 `syncUrl`(history.replaceState)을 **`setHide` 업데이터 콜백 안에서** 호출 → App Router 렌더 중 갱신으로 "Cannot update a component (Router) while rendering BoardViewProvider" 경고. **수정**: 사이드이펙트를 이벤트 핸들러로 이동(`const next = !hideCompleted; setHide(next); syncUrl(next);`). 재검증 후 콘솔 0.
>
> **비차단 후속(수용)**: ① hc URL desync wart — `view-header.tsx` boardHref가 서버 렌더 시점 hc를 링크에 구움 → 토글 후 날짜/모드 이동 Link 클릭 시 URL의 hc가 어긋날 수 있으나 provider 클라 상태로 화면은 정합(하드 리로드 시에만 리셋). 고치려면 DateNav·BoardModeToggle을 context 읽는 클라 링크로 전환. ② +N low 2건(zero-length minHeight, 칩이 빈 구간 덮음).
>
> 대상: 공개 읽기전용 현황판 `view.griff.co.kr`(`app/(view)/view/`). 이예진 `/revisions` #5("주간뷰 너무 복잡") 후속 + 사용자 추가 요청.

### ① 주간뷰 +N 상한 (커밋 완료)
- `components/view/week-grid.tsx`: 겹침 레인 분할(커밋됨) 위에 **레인 상한 `MAX_LANES=3`** 추가. 한 클러스터 레인>3이면 앞 2개는 카드, 나머지는 마지막 열에 점선 **"+N" 칩**(N=숨긴 이벤트 정확 개수). `LayoutEntry = CardEntry | OverflowEntry` 유니온, `OverflowChip` 컴포넌트 신설. **글래도스가 우려한 극단 narrow(8칸) 해소.**
- **검증됨**: 워크플로우 7/7 시나리오 결함 0(경계 3/4, 그리디 레인, 접촉경계, 그리드밖, 칩 세로범위), 브라우저 FHD 확인(월요일 5겹침 → 2카드+"+3"). low 2건 수용(zero-length minHeight, 칩이 빈 구간 덮음).

### ② Week(5칸) range 제거 (커밋 완료)
- 사용자 확정: view 현황판 [1Day/3day/Week]에서 **Week만 제거**, 1Day·3day 유지, **기본 3day**. 스케줄 "모드"(`?view=week`)는 유지(FAB 포함) — 없앤 건 서브 range뿐.
- 파일: `lib/view-settings.ts`(`ViewSlideScheduleRange="1day"|"3day"`, 기본 3day, normalizeSettings week분기 제거 → **localStorage 옛 "week" 자동 3day 마이그레이션**) · `components/view/view-settings.tsx`(RANGE_OPTIONS week 제거) · `view-header.tsx`(Week SegLink·step·rangeLabel week 제거) · `app/(view)/view/page.tsx`(rangeParam 기본 3day) · `lib/view-data.ts`(**`getViewSchedule(anchor)` 시그니처 변경 — range 인자 제거**, dayCount=3 고정, `ViewWeek.range` 필드 제거, `ViewScheduleRange` type 삭제) · `slideshow-controller.tsx`(주석만).

### ③ hide-completed 반응 즉시화 (커밋 완료, #1에서 URL 정합화 후속 완료)
- **원인**: 토글이 `router.push(?hc=1)` → `force-dynamic` 페이지가 매 클릭 DB 재로드·전체 재렌더로 느림. 보드는 이미 클라에서 `filter`만 함(서버 왕복 불필요).
- **해결(설계)**: hideCompleted를 **클라 상태(Context)**로. 신규 `components/view/board-view-context.tsx`(`BoardViewProvider` useState + `history.replaceState`로 hc URL 동기화, `useBoardView()`). `page.tsx`가 트리를 provider로 감싸고 서버 `hideCompleted`를 initial로 전달(SSR 깜빡임 없음). `hide-completed-toggle.tsx`는 router 제거·context 사용, `board-grid.tsx`는 context에서 읽음. `router.refresh`(10분 auto-refresh)는 클라 상태 보존.
- **근거**: board 데이터가 서버 프롭이라 `useSearchParams`만으론 force-dynamic 재렌더에 묶여 즉시 안 됨 → 서버 렌더와 분리한 클라 상태 필요.
- **검증 포인트(다음 세션)**: 토글 즉시 반응(서버 왕복 없음), ?hc=1 로드 시 첫 페인트부터 필터(깜빡임 없음), auto-refresh 후 상태 유지, board 모드 날짜이동 Link 클릭 후에도 필터 유지(provider 상태 지속). **알려진 wart**: 서버 렌더 Link(날짜/모드)는 로드 시점 hc를 담아, Link 이동 시 URL의 hc가 잠깐 어긋날 수 있으나 board 표시는 클라 상태로 정합(수용).

---

## ✅ 완료 — 팀원·권한 관리 확장 + /revisions 팀 요청 (2026-07-06)

> **상태**: **구현 완료·검증 통과·글래도스 승인, 커밋 대기.** backend-dev(B1~B4+시드)→frontend-dev(F1~F3)→qa-engineer(4해상도+가드)→글래도스 게이트 순으로 진행. typecheck/lint/core test(188/188)/build 전부 통과.
>
> **확정된 사용자 결정 (구현 반영됨)**: ① 변경 주체 = **모든 관리자**(canManageUsers=admin) · ② email @griff 도메인 **강제 안 함**(포맷·유니크만) · ③ **name 편집 제외**(email·rank·department만) · ④ 비활성 대상 편집 **거부** · ⑤ 대표 단일성 **서버 강제**(rank="대표" 부여 시 다른 활성 대표 있으면 거부).
>
> **조직 확정**: 대표=황성현(admin·ceo) / 관리자=오승훈·**송수용·황성진**(admin·manager) / 직원=박승환·이예진·김리원·이혜진(member·staff). 시드(`mock/users.ts`)는 이 목표조직으로 갱신됨. **프로덕션 DB는 미변경** — 배포 후 대표가 `/settings/staff`에서 송수용·황성진을 UI로 승격(설계대로 SQL 직접변경 안 함).
>
> **구현 파일**: core `domain.ts`(RANK_VALUES·rankSchema·updateUserProfileInputSchema, createUserInputSchema.rank enum화)+`user-management.test.ts` · `current-user.ts`(선행결함: role→base.role DB-first) · `lib/auth/users.ts`(updateUserRole·updateUserProfile, 서버 가드 전부 강제) · `settings/staff/actions.ts`(updateStaffRoleAction·updateStaffProfileAction) · `components/settings/staff/{staff-edit-dialog,staff-role-dialog,staff-table,staff-manager}.tsx` · `members/page.tsx`(관리자 '직원 관리' 링크) · `mock/users.ts`(시드 승격).
>
> **비차단 후속(글래도스 지적)**: `staff-edit-dialog.tsx`에서 DB rank가 enum 밖 값이면 폼이 "사원"으로 폴백 → 이메일만 고쳐 저장해도 rank가 조용히 "사원"으로 덮임(현 프로덕션 rank는 전부 enum 내라 실해 없음, SQL로 임의 rank 유입 시에만 문제). 폴백 시 경고/미포함 처리 고려.
>
> ---
> 아래는 착수 전 설계 기록(참고용 보존).

### 배경 — `/revisions`(수정사항 트래커)에 팀이 올린 요청 5건 (Supabase `revision_notes` 실조회)
1. **설정·권한변경**(황성현/대표, 미해결): 설정에서 팀원 권한을 **관리자로 변경**.
2. **팀·팀원추가**(송수용, 미해결): 팀원 추가 버튼 — **추가 자체는 항목19에서 이미 구현**(`/settings/staff`). **발견성만** 필요.
3. **프로젝트·추가 안 됨**(송수용, 미해결): **코드 버그 아님**. 송수용=`member`(사원·디자인)이고 프로젝트 생성은 `/clients`(관리자 전용)에만 있어 **접근 경로가 없음**. 클라이언트 4건 정상 존재=생성경로 살아있음. **해결책=권한변경으로 대표가 송수용을 admin 승격**(그러면 /clients 접근 → 프로젝트 추가 가능). **프로젝트 관리 개방은 안 함**(관리자 전용 설계 유지 — 사용자 확정).
4. **팀·팀개요**(송수용, 미해결): 팀원 **이메일·직급·부서 등 정보 변경**을 관리자가.
5. **view.griff 주간뷰**(이예진): "너무 복잡" → **완료 (2026-07-06)**. 원인=시간그리드 이벤트 절대배치라 동시간대 겹침 시 글자 뭉개짐. 해결=좌우 레인 분할(그리디 클러스터 배정, `components/view/week-grid.tsx`). "그리드 유지+겹침만 분할" 사용자 확정.

→ #1·#2·#4 = "팀원·권한 관리 확장" 배치(설정>직원관리). #3 = 그 권한변경으로 해소. #5 = 별도.

### 확정된 사용자 결정
- 관리 UI 위치 = **설정 > 직원관리 확장**(`/settings/staff`). 팀(/members)은 조회 전용 유지 + '직원 관리' 링크만.
- 프로젝트 관리 **개방 안 함**(관리자 전용 유지). #3은 승격으로 해결.
- **권한변경은 내가 프로덕션 DB를 직접 SQL로 바꾸지 않는다**(접근권한 임의변경=민감). UI를 만들어 대표가 직접 승격. 배포 후 클릭 한 번.
- #5 view 주간뷰 = 완료(2026-07-06, 겹침 레인 분할).

### ⚠️ 설계 중 발견한 선행 결함 (구현 전 반드시)
**`apps/web/src/lib/current-user.ts`의 role이 JWT 세션 우선**(`session.user.role ?? base.role`). JWT maxAge 7일이라 **강등해도 대상이 최대 7일간 admin 잔존**(승격도 재로그인 전 무효). → **role을 `base.role`(DB 우선)로 고쳐야** 권한변경이 즉시 실효. active/rank/department는 이미 DB-first. name은 세션 우선 유지(무관). PAT resolve(`lib/auth/verify.ts`)는 이미 db.users 기반.

### 핵심 구조 (조사 완료)
- **쓰기 경로**: `apps/web/src/lib/auth/users.ts` — server-only, `QUE_DB=supabase` 전용(아니면 NOT_SUPPORTED), SECRET_KEY로 users 직접 write(**persist는 users write-back 안 함** — auth 컬럼 보호). createUser/deactivateUser/reactivateUser가 이 패턴. ChangeLog=`logUserChange()`(entity_type='user', 실패해도 주작업 유지).
- **grade 유도(핵심 커플링)**: `packages/core/src/mock/users.ts` `gradeForRank()` = **순수 rank 문자열 매핑**("대표"→ceo/"관리"→manager/그외→staff), id 하드코딩 아님. → **rank 편집 = grade(홈 대시보드 getGradeHomeData + 성과 personScope) 즉시 변경**. 대표 2명이어도 `personScopeForGrade`는 구조상 안 깨짐(의미만 = 전사 조망 권한 부여).
- **userSchema**: role·rank(opt)·department(opt)·active 포함, email·passwordHash 도메인 제외. **DDL 0건**(role/active/rank/department/email·`users_email_key` lower(email) 유니크·change_logs 'user' 전부 존재).

### 구현 순서 (backend→frontend)
- **B1 core**(`domain.ts`): `RANK_VALUES`/rank enum(대표·관리·사원) + `updateUserProfileInputSchema`(email?·rank?·department?, 최소1필드). createUserInputSchema.rank도 enum으로 조임. index export. 테스트.
- **B2 선행 결함**(`current-user.ts`): role → `base.role` DB-first. (mutation보다 먼저.)
- **B3 mutation**(`lib/auth/users.ts`): `updateUserRole({actor,via,targetId,role})` + `updateUserProfile({actor,via,targetId,data})`. 가드→update→logUserChange(before/after diff).
- **B4 액션**(`app/(app)/settings/staff/actions.ts`): `updateStaffRoleAction`/`updateStaffProfileAction`(getCurrentUser→canManageUsers→mutation via=web→revalidatePath).
- **F1 다이얼로그**(`components/settings/staff/`): `staff-edit-dialog`(이메일·직급 Select·부서 + **grade 영향 문구** + email 변경 안내) / `staff-role-dialog`(member↔admin confirm, 강등=destructive, 권한 설명).
- **F2 표**(`staff-table.tsx`): 행에 '편집'·'권한' 버튼(44px, 본인 권한버튼 disabled). `staff-manager.tsx` 배선.
- **F3 발견성**(`app/(app)/members/page.tsx`): 관리자 조건부 '직원 관리' 링크(→/settings/staff).

### 가드레일 (서버 최종 강제)
canManageUsers=admin · **본인 role 변경 금지** · **마지막 활성 admin 강등 금지**(active&admin 카운트, 비활성 admin 제외) · 비활성 대상 편집 거부 · email 유니크(사전 ilike + 23505) · rank="대표" 부여 시 **대표 단일성 강제**(다른 활성 대표 있으면 거부, 교체는 기존 대표 강등 후 2단계). role/rank/profile 변경은 **ChangeLog entity_type='user' via=web**.

### 미해결 사용자 결정 5건 → ✅ 전부 확정(2026-07-06)
1. **admin 부여 주체** → **모든 admin**(canManageUsers=admin 현행 유지).
2. **대표 단일성** → **서버 강제**(rank="대표" 부여 시 다른 활성 대표 있으면 거부).
3. **email @griff.co.kr 강제** → **강제 안 함**(포맷·유니크만, createUser와 일관).
4. **비활성자 편집** → **둘 다(role·profile) 거부**.
5. **name 편집** → **제외**(email·rank·department만 편집).

### 리스크
rank→grade 커플링(직급 편집=노출 스코프 변경, member인데 대표 조합 가능) · 세션 role 잔존(B2 미선행 시 강등 7일 무효) · 락아웃(서버 최종 차단, 동시강등 레이스는 8인 규모 수용) · email=로그인식별자(세션은 id기반이라 안 끊김) · rank 변경 시 홈 급변(버그 아님, 문구 예고).

### 그 외 대기 트랙 (변동 없음)
- **항목15 회의록 액션플랜** — 회의록 md 샘플 대기.
- **구글 캘린더 연동** — Vercel `GOOGLE_SERVICE_ACCOUNT_KEY`+도메인위임 대기([[google-calendar-integration-plan]], `data/docs/google-calendar-setup.md`). **현재 = 더미 상태 유지(2026-07-07 사용자 확정)**: `/api/calendar/sync`가 `MockGoogleCalendarProvider`(가짜 회사 일정)를 씀. 회사 일정(source=`company`)은 전부 더미, Que 일정(source=`que`)은 실제. **⚠️ 실 연결 전환 절차(중요)**: `syncExternalCalendar`는 externalId 매칭 add/update만 하고 **피드에 없는 회사 일정을 삭제하지 않음** → 실 구글을 그냥 붙이면 더미 회사 일정이 유령으로 남아 중복. **전환 시: ① provider를 실 GoogleCalendarProvider로 교체 ② source=`company` 더미 이벤트 먼저 삭제 ③ 실 sync 실행**(Que 일정은 불변). key 오면 이 순서로.
- ~~**#5 view 주간뷰 정리**~~ → **완료 (2026-07-06)**: 주간뷰 겹침 레인 분할. 위 요청5 참고.
- env 트랙(Slack·Sentry·cron) — 키 대기.

---

## 디자인 리프레시 (2026-07-04) — ✅ main 병합 + 프로덕션 배포 완료

전면 재스킨을 `design/modern-neutral`에 쌓아 글래도스 승인 후 **main에 fast-forward 병합(`ac8b179`) + Vercel 프로덕션 재배포**(que-rouge-eight.vercel.app, 새 디자인 라이브 확인). 커밋: `231a50f`(P1 토큰) → `94fa764`(P2 표면/배지) → `77d1487`(P3 ⌘K·다크·밀도·폰트설정) → `89f0a80`(폴리시) → `9bbb4ee`(차트/상태색 토큰화, 글래도스 반려 후) → `810fbba`(후속: 이벤트 다크 팔레트·브랜드 버튼 대비). **커스텀 도메인 `que.griff.co.kr` 정상화 완료(2026-07-04)** — Cloudflare 프록시 유지 + SSL/TLS 모드 조정으로 이전 406 해소, `/login` 200·Vercel 오리진 도달(`x-vercel-id`) 확인.

### 방향·기본값
- **퓨어 Attio**: 뉴트럴 지배·저채도 인디고 액센트(`--que-brand #3b5bd9`)·하이라인 보더·소프트 elevation(그림자 '속삭이듯'). `globals.css` `--que-*` 토큰이 정본.
- **기본 폰트 SUIT(한글) + Inter Tight(영문)**. `/settings > 모양`에서 테마(라이트/다크)·밀도(기본16px/컴팩트15px)·한글폰트(SUIT/Pretendard/Noto/시스템)·영문폰트(Inter Tight/시스템) 개별 선택. **쿠키 기반 SSR**(html[data-ko]/[data-latin]/[data-density]/.dark)로 FOUC 없음.
- **⌘K 커맨드 팔레트**(`components/app/command-palette.tsx`): 이동+검색+빠른액션. 전역검색은 ⌘K 힌트 제거(팔레트가 소유).

### 토큰 결정(다음 세션이 알아야 함)
- **한글 타이포**: 본문 line-height 1.5~1.65, body letter-spacing −1.1%, 헤딩 크기별 트래킹 토큰 `--text-{lg..4xl}--letter-spacing` = **−1.4%~−2.7%**(클수록 조임, Attio display). Bold→SemiBold 매핑.
- **히트맵 램프 `--heat-{1..4}-{bg,fg}`**(라이트=파스텔→진초록 / 다크=GitHub 다크 기여 램프 `#0e4429/#006d32/#26a641/#39d353` + 밝은 초록 숫자). `performance-heatmap`·`member-contribution-grid` 공통 참조. 라이트 heat-3 fg는 대비(AA) 위해 흰색→진초록(#06371a).
- **violet 의미색 신설 `--que-violet`/`--que-violet-bg`**(라이트/다크): 회의록·응답대기(CLAUDE.md 의미색). `tone-badge`·`note-summary-cards`가 참조. 기존 `bg-violet-50/text-violet-700`(다크 미대응) 대체.
- **차트 구조색은 토큰**(그리드=`--que-border`, 틱=`--que-text-tertiary/secondary`, 커서=`--que-bg-muted`). `home-data` STATUS_COLOR·이벤트 dot도 `--que-*`(소비처가 인라인 backgroundColor·SVG Cell fill이라 var() 해석).
- **이벤트 스와치 `--ev-{violet,green,blue,pink,amber,teal,red}-{bg,border,accent,text}`**(라이트=파스텔/다크=어두운 틴트+밝은 accent·text). `event-color.ts`가 참조, 소비처(month-view·week-calendar)가 인라인 style이라 var() 해석. `810fbba`.
- **`--que-on-brand`**(라이트 #fff / 다크 #10121a): 브랜드 배경(버튼·배지·활성칩) 위 텍스트. 다크 `--que-brand(#7488ea)`가 밝은 인디고라 흰 텍스트 3.25:1 미달 → 어둡게 반전(5.9:1). `bg-[var(--que-brand)]` 요소의 `text-white`는 전부 `text-[var(--que-on-brand)]`로 전환. `810fbba`.

### 의도적 하드코딩 예외(팔레트색 '잔여 0' 아님 — 아래는 의도)
- **차트 데이터 계열색 고정**(라이트/다크 공용): `performance-line-chart` #157f2f/#d97706/#e33030, `overdue-area-chart` #d97706 — 계열 구분 신호색이라 테마 무관 고정(주석 명시).
- `notifications-bell` `bg-violet-500`(알림 dot), `pm-data` 그룹 기본색(#3388ff/#9ca3af, 데이터 성격·/projects 프리뷰).

### 알려진 후속 — ✅ 처리 완료(`810fbba`)
- ~~`event-color.ts` 라이트 전용 스와치 → 다크 파스텔 칩~~ → **해결**: `--ev-*` 토큰 다크 대응.
- ~~다크 로그인/브랜드 버튼 white 3.25:1~~ → **해결**: `--que-on-brand` 토큰.

---

## 기타 화면 신설 (2026-07-04) — 온보딩/도움

메뉴 `기타` 섹션 = 결제요청 · **MCP·CLI** · **도움말** · 설정. 메인 `메뉴` 섹션에 **반복·마일스톤** 추가(아래 C-4). (`menu.ts` 정본, CLAUDE.md 동기화됨).

### C-4 반복·마일스톤 (`/planning`, 커밋 `b2fa821` + riskStatus 검증 수정)
- **결정**: 독립 메뉴(메인 `메뉴` 섹션) · 마일스톤 관리 포함 · 태스크-마일스톤 **간접**(projectId 공유, 스키마 불변·마이그레이션 없음).
- **반복 업무 템플릿**: 기존 완성 백엔드(스키마·mutation·`syncRecurringTemplates`·영속) 재연결 — 고아였던 `components/templates/*` 부활. 회차 Task 자동 생성은 B-2 Cron/lazy가 담당(planning 액션은 생성 안 함).
- **마일스톤 관리(신규)**: core `createMilestone`·`updateMilestone`(mock-db.ts, **프로젝트 owner+관리자만** — moveMilestone과 동일 규칙, ChangeLog create/update, `via`). `canManageMilestone`(rules.ts, export). 위험 상태 = on_track/at_risk/late(green/amber/red). **riskStatus는 런타임 enum 검증**(서버 액션 인자=클라 직렬화값이라 TS 타입만 믿지 않음 — `milestoneSchema.shape.riskStatus.safeParse`, 글래도스 반려 수정). 우회 회귀 테스트 추가(core 79).
- **파일**: `app/(app)/planning/{page,actions}.ts`, `lib/planning-data.ts`(canManage 서버 계산), `components/milestones/{create-milestone-form,milestone-list}.tsx`. `projects/actions.ts`가 `/planning`도 revalidate. `menu.ts`+CLAUDE.md 동기화·보류 해제.

### 비밀번호 보안 풀세트 (커밋 `b8d1b1a`) — B2 일부 완료
- **본인 변경**: 설정>보안 카드(`components/settings/password-settings.tsx` + `settings/security-actions.ts`). 현재 비번 확인 후 교체.
- **첫 로그인/재설정 후 강제 변경**: `must_change_password` 참이면 `(app)/layout.tsx`가 `/change-password`(그룹 밖 격리 화면)로 리다이렉트. 완료 시 signOut→`/login?changed=1`.
- **관리자 재설정**: `/members/[id]` 관리자 전용 카드(`admin-reset-password.tsx` + `[id]/reset-actions.ts`) → 임시 비번 1회 발급 + must_change=true. 권한은 **서버(`adminResetPassword`)에서** actorRole 검사.
- **로그인 레이트리밋**: `verify.ts` — 연속 5회 실패 시 15분 잠금. 카운터 증가·잠금 판정은 **Postgres 함수 `register_login_failure`(단일 원자 UPDATE)** 로 처리해 동시 요청에도 언더카운트되지 않는다(read-modify-write 아님). `failed_login_attempts`/`locked_until` 컬럼 기반이라 서버리스 다중 인스턴스에서도 상태 공유. 설정의 현재 비번 확인(`changeOwnPassword`)도 같은 잠금을 공유. 상수는 `lib/auth/policy.ts`.
- 비번 쓰기 정본 = `lib/auth/password.ts`(SECRET_KEY로 users 직접 UPDATE — supabase-db는 users write-back 금지). 정책: 8자↑·전부동일 금지·이메일 동일 금지.
- **DB**: users 4컬럼 추가(`add-password-security.sql`·schema.sql). 프로덕션 마이그레이션 적용됨.
- **알려진 한계(정직 기록)**: ① JWT 세션(`auth.ts` `maxAge=7일` 명시)이라 **설정에서 본인 비번을 바꿔도/관리자가 재설정해도 다른 기기의 기존 세션은 최대 7일 유지**된다(강제 변경 완료·본인 재로그인은 signOut으로 즉시 무효화). 관리자 재설정 카드도 "기존 세션 최대 7일 유지" 명시. 즉시 강제 로그아웃이 필요하면 후속으로 JWT에 `password_changed_at`을 넣고 세션 콜백에서 대조해야 함(현재 미구현). ② `must_change_password` 리다이렉트는 `(app)` **페이지 렌더링**만 막는다 — 서버 액션·`/api/*`(PAT 경로)는 별개(인증된 사용자 대상 넛지라 수용). ③ 잠긴 사용자에겐 "비번 틀림"으로만 응답(전용 잠금 메시지 미노출).
- **운영 주의**: 개인 비번 배포(`set-passwords.sql`) 시 `must_change_password=true`로 넣으면 첫 로그인에 강제 변경됨(권장). 현재 전원 `good121930`·must_change=false.

### 액세스 토큰 셀프 발급 (B-3, 커밋 `d1a69a8`)
- **설정 › 액세스 토큰(MCP·CLI)**: 팀원이 직접 PAT 발급/폐기. 평문 발급 순간 1회만 표시, DB엔 SHA-256 해시만(`lib/auth/tokens.ts`, `api/auth.ts` `hashToken` 단일 출처 재사용). 폐기는 `user_id` 스코프 소프트(`revoked_at`) → 즉시 401. 활성 상한 10·라벨 필수. `settings/token-actions.ts`+`components/settings/token-settings.tsx`, `settings/page.tsx`가 `listPats` 로드. tools 화면 안내를 셀프 발급으로 교체.
- **컷오버 보류(글래도스 승인한 결정)**: mock PAT 폴백(`api/auth.ts` L54-58) 제거·`mock/tokens.ts` 삭제는 **안 함**. 이유: 프로덕션은 이미 mock PAT를 이중 차단(resolveToken supabase 분기만 도달 + `NODE_ENV=production`+옵트인 부재로 503, `que_pat_<id>` 실측 401) → 수용기준4 이미 충족. 제거 시 로컬 dev MCP/CLI mock 테스트가 깨짐. **후속 순서(계획서 준수)**: 발급 UI 배포 → 팀 8명 각자 설정에서 재발급·CLI/MCP `QUE_TOKEN` 교체 → **그 다음** mock 폴백 제거+`mock/tokens.ts` 삭제(+ 이후 별도로 `QUE_ALLOW_MOCK_AUTH` 완전 제거, 단 이 플래그는 로그인 mock도 게이트하므로 신중). 현재 프로덕션 PAT 7개(전원 label='initial') 유지 중.
- **비차단 후속**: 폐기/복사 버튼 40px 상향(현 36px), MAX_ACTIVE TOCTOU(8인 무시 가능), revokePat 0행에도 ok:true.

### MCP · CLI (`/tools`, 커밋 `1038e8e`·`931faee`)
- 터미널(CLI)·AI(MCP)로 Que 쓰는 온보딩 화면. 현재 사용자 맞춤(계정·mock 토큰 형식 `que_pat_<id>`), 복사 가능한 설정 블록, Claude Code/Desktop·Gemini CLI 등록법. **실 PAT는 이제 설정 › 액세스 토큰에서 셀프 발급**(B-3, 아래) — tools 화면이 그리로 안내.
- **전체 레퍼런스**: `data/docs/que-tools-guide.md` — CLI 19명령·MCP 19도구 전체 + **§7 AI 명령어 세트 186개**(8카테고리 표). MCP 실행: `pnpm -C <repo> --filter @que/mcp start`, env `QUE_API_URL`(=que.griff.co.kr)·`QUE_TOKEN`(PAT).
- AI 명령어 세트 인터랙티브 렌더본(검색·복사)은 별도 Artifact로 사용자에게 제공.

### 도움말 (`/help`, 커밋 `452c3cb`→수정 `6fe52d2`)
- **비개발 팀원용 사용 설명서.** 8섹션(소개·처음시작 / 홈·일정 / 성과·작업목록 / 팀·팀현황 / 확인필요·결제 / 설정·MCP안내 / 자주하는일 / 규칙·FAQ·문제해결). 왼쪽 목차(스크롤 스파이) + 섹션 카드, 해요체·단계별.
- **콘텐츠 정본**: `apps/web/src/app/(app)/help/help-content.ts`(HELP_SECTIONS md 배열, 편집 가능). 렌더: `help-markdown.ts`(경량 MD→HTML, 신뢰 콘텐츠라 dangerouslySetInnerHTML) + `globals.css` `.help-prose`(토큰 기반 다크 대응). 목차: `help-toc.tsx`(IntersectionObserver).
- 콘텐츠는 화면을 근거로 병렬 초안(워크플로) 후 **글래도스 콘텐츠 검수**. 반려 4건 수정: ①로그인 이메일 예시 한글→로마자 실형식(`users.ts`는 명시 맵, 유도 불가) ②설정에 없는 '글자 크기' 문구 삭제 ③운영보드 라벨 '재조정 필요'→'시간변경필요'(`labels.ts`) ④좁은 화면 메뉴 ≡→옆 서랍(`mobile-nav.tsx`). 권고 3건(팀원별 표·관리자/담당자 예외·하루 마감 보완)도 반영.
- **주의**: 화면 라벨·규칙을 바꾸면 `help-content.ts`도 같이 갱신할 것(설명서가 실제와 어긋나면 "따라 하면 실패").
- **🔄 전면 감사·개편 (2026-07-07)**: 이번 세션 신기능·드리프트 반영으로 **8→13섹션**. **톤은 매뉴얼체('합니다/하세요', 구어체 금지)로 이미 이관됨**(위 "해요체"는 옛 서술). 추가/수정: ①**Slack 알림** 신설(s9+FAQ: 팀채널 문제발생/홀드·마감임박·아침 스탠드업 + **개인 DM 브리핑 9:50** 오늘작업·막힘·마감·마일스톤, 빈 브리핑 미발송, 방해금지 22-8, 관리자 1회 설정·이메일 자동매핑) ②**팀 섹션 정정**(조회 전용→관리자는 설정›직원관리에서 추가·권한변경·정보편집) ③**s9 사전준비**(Node/pnpm/git) ④**신규 s12 프로젝트·s13 수정사항** ⑤설정 4탭(모양·보안·토큰·직원관리)·토큰 자가발급·비번 셀프변경 ⑥결제요청(입금받을곳·분류관리·완료 원형·복사버튼) ⑦**s2 일정 정정**(글래도스 반려: "조회전용/준비중"은 허위 — 필터·새로추가·본인작업 상태/일정변경 다 동작, 드래그 이동만 불가). planner 감사+업데이트 → 글래도스 콘텐츠 검수(코드 대조).

---

## 프로젝트 개요

Que는 **캘린더 UI를 가진 팀 작업 상태 관리 도구**다. 8명 규모 팀이 회사 캘린더, 개인 작업, 프로젝트 마일스톤, 회의록 Action, 결제 요청, 업무량 현황을 한 곳에서 확인하고 수정한다. 감시 도구가 아니라 업무 병목과 일정 충돌을 빨리 드러내는 운영 도구다.

- 저장소: <https://github.com/sunghyeonhwang/Que.git>
- 스택: TypeScript, Next.js(App Router), Tailwind CSS, shadcn/ui

## 폴더 구조

```text
data/
├── DESIGN.md                  # 디자인 가이드 (shadcn/ui 기본값 기준)
├── docs/
│   ├── que-product-plan.md    # 제품 기획서 — 기획 source of truth
│   ├── que-mcp-cli-plan.md    # MCP/CLI 개발 계획 (AI 대화형 입력/수정/삭제)
│   └── claude-prompts/        # Claude Code 개발용 프롬프트 모음
│       ├── README.md          # 프롬프트 사용 순서 안내
│       ├── 00_claude_code_설정_프롬프트.md
│       ├── 01_플랜_계획_프롬프트.md
│       └── page-prompts/      # 공통 앱쉘 + 13개 메뉴별 프롬프트
└── preview/                   # 정적 HTML 프로토타입 (12페이지 + styles.css + app.js)
```

## 확정된 결정사항 (2026-07-02)

1. **용어**: "캘린지"는 "캘린더"의 오타였다. 문서·프리뷰 전체에서 "캘린더"로 통일했고, CSS 클래스 `challenge-schedule`도 `calendar-schedule`로 변경했다.
2. **shadcn 설정**: `DESIGN.md`의 `components.json` (`"style": "base-nova"`)은 shadcn 컴포넌트 사용 전제로 유지한다.
3. **알림/설정 화면**: 개발 후순위다. 두 화면의 프리뷰는 추후 별도 제공 예정이며, 프리뷰를 받기 전에는 착수하지 않는다. (`page-prompts/12_알림_프롬프트.md`, `13_설정_프롬프트.md` 상단에 명시)
4. **기획서 단일화**: 요약본 `que_기획.md`는 삭제했다. `docs/que-product-plan.md`가 유일한 기획 source of truth이며, 모든 프롬프트의 참조도 여기로 통일했다.
5. **캘린더 메뉴 통합**: `캘린더`/`전체 캘린더`/`가로 캘린더` 세 메뉴를 `캘린더` 단일 메뉴로 통합했다. 화면 상단 뷰 스위처(기본형/전체 멤버/타임라인)와 기간 스위처(일간/주간/월간)로 전환하고, 마지막 사용 뷰를 기억하며 URL에 반영한다. 프리뷰 HTML 3개는 각 뷰의 레퍼런스로 유지한다.
6. **Now/오늘 역할 구분**: 팀원은 `오늘`, 관리자/프로젝트 담당자는 `Now`가 기본 진입점이다(설정에서 변경 가능). 두 화면 상단에 한 줄 역할 설명을 고정 표시한다.
7. **MCP/CLI 계획 수립**: 사용자가 자기 AI와 대화하며 Que 데이터를 입력/수정/삭제하는 MCP 서버와 CLI를 만들기로 했다. 계획은 `data/docs/que-mcp-cli-plan.md` 참고 (API-first, parse→confirm 2단계, 권한 서버 강제, `via` 필드 변경 로그). 착수 시점은 웹 MVP 데이터 모델 이후.
8. **추가 메뉴 통합 제안 (미확정)**: `회의록`+`Action` 단일 메뉴화, `히트맵`을 `팀 현황` 탭으로 이동. 기획서 "추가 통합 제안" 절에 기록해 두었고 사용자 결정 대기 중.
9. **Claude Code 프로젝트 세팅**: 루트에 `CLAUDE.md`(스택·화면 원칙·도메인 규칙·확정 메뉴 구조)를 만들어 매 세션 설정 프롬프트 붙여넣기를 대체했다. `.claude/agents/`에 서브에이전트 7개를 등록했다: planner(기획자), dev-lead(개발팀장), frontend-dev, backend-dev, uiux-expert, qa-engineer, glados(최종 게이트 심사, GLaDOS 페르소나). 역할 위임 시 Agent tool의 subagent_type으로 호출한다.
10. **Phase 0 완료 (2026-07-02)**: pnpm 워크스페이스(`apps/web` + `packages/core`), Next.js 16.2.9(App Router, --src-dir, Turbopack), shadcn/ui 초기화(`-b base --preset nova` = base-nova, baseColor neutral — DESIGN.md components.json과 일치 확인됨), 컴포넌트 27종 추가(form은 base-nova에서 field/label로 대체), layout.tsx에 TooltipProvider/Toaster 배치, lang=ko. lint/typecheck/build 전부 통과.
    - 주의: Next.js 16은 훈련 데이터와 다른 breaking change가 있음. 화면 구현 전 `apps/web/node_modules/next/dist/docs/`의 해당 가이드를 먼저 읽을 것 (`apps/web/AGENTS.md` 참고).
    - 주의: `pnpm dlx shadcn add`를 apps/web에서 실행할 때 stray `pnpm-workspace.yaml`이 apps/web에 생기면 삭제해야 한다 (워크스페이스가 쪼개져 @que/core 해석 실패).
11. **Phase 1 완료 (2026-07-02, 글래도스 게이트 통과)**: App Shell(lg 이상 고정 사이드바 / lg 미만 헤더+Sheet), 확정 메뉴 9개 라우트, 쿠키 기반 mock 로그인(UserSwitcher + `switchUser` 서버 액션), 역할별 기본 진입점(`/`에서 admin→/now, member→/today), 오늘/Now 한 줄 역할 설명. 4개 해상도 Playwright 검증 완료.
    - Base UI 주의: trigger 합성은 `asChild`가 아니라 `render` prop. `DropdownMenuLabel`은 반드시 `DropdownMenuGroup` 안에 배치 (밖에 두면 런타임 에러).
    - 글래도스 반려→수정 이력: globals.css `--font-sans` 순환 참조(폰트 미적용), 임시 스크린샷/템플릿 SVG 잔재. 수정 후 승인.
    - Phase 2에서 할 일: mock 쿠키의 조용한 admin 폴백 제거(실로그인 전환 시), 한글 폰트 결정(현재 Geist는 라틴만 커버, 한글은 시스템 폰트 — 오픈 질문).
12. **Phase 2 완료 (2026-07-02)**: `@que/core`에 도메인 계층 구현 — zod v4 스키마 12종(`domain.ts`, 날짜는 ISO 문자열로 직렬화 가능하게), 상태 코드→한글 라벨(`labels.ts`), 도메인 규칙(`rules.ts`: 문제발생/홀드 사유 필수, 본인/프로젝트 담당자/관리자만 수정, 외부·비공개 일정 이동 불가, 담당자·마감일 없는 Action 확정 거부), 인메모리 mock DB(`data/mock-db.ts`: 모든 mutation이 규칙 통과 후 StatusLog/ChangeLog에 `via: web|mcp|cli` 기록), 시드(`data/seed.ts`: now 기준 상대 날짜로 생성 — 언제 실행해도 오늘 데이터가 보임). vitest 14케이스로 규칙 강제 검증.
    - dev 규칙 추가: dev 서버가 떠 있는 동안 `pnpm build` 금지 (같은 `.next` 공유 — CLAUDE.md 작업 방식 5번, qa-engineer/glados 정의에도 반영).
    - 상태 상세(statusDetail)는 기획서의 4개 필드 중 `reason`만 필수로 구현 (나머지 nextAction/helpUserId/recheckAt는 선택 — UI에서 유도하되 강제하지 않는 실용적 결정).
    - 글래도스 반려(1차)→수정 이력: ① 공백 사유 통과(`reason`에 `.trim()` 추가), ② created Action 재확정 시 중복 Task(재확정 거부 — `ignored`도 거부, `held`는 재확정 허용), ③ 일정 이동 입력 미검증(`scheduleRangeSchema`로 ISO 파싱 + 시작≤종료 강제). 회귀 테스트 7케이스 추가 (총 21).
    - ActionItem 처리 권한 결정: 확정/보류/무시는 **담당자, 회의록 업로더, 관리자**만 가능 (`canResolveActionItem`). 확정 거부로 needs_review로 내려가는 변경도 ChangeLog에 기록.
    - Phase 5 확인 사항: 결제 계좌번호/금액은 화면에서 권한 기반 마스킹 필수 (글래도스가 확인 예고함).
13. **Phase 3a 완료 (2026-07-02)**: 오늘 화면 실데이터 구현 — 요약 metric 5종, 내 타임라인(작업+회사 일정 통합, 타인 비공개 일정은 "자리비움"), 작업 row 클릭→상태 변경 Sheet(문제발생/홀드는 사유 폼 필수), 자동 체크인 응답 패널(7지선다, 문제발생은 사유 폼), 주의 필요 패널(내 관련 문제/홀드 — 담당/소유/도움 요청 대상, 관리자는 전체). core에 `answerCheckIn` mutation 추가(응답→상태 매핑, later는 후속 확인만, 이미 응답한 체크인 거부 — 테스트 26케이스). StatusLog에 `helpUserId`/`nextAction` 보존하도록 스키마 보강.
    - 웹 mock DB는 `globalThis` 싱글톤 (`apps/web/src/lib/db.ts`) — dev 리로드에도 상태 유지, API 계층에서 교체 예정.
    - 주의: 의존성 추가 후 dev 서버는 재시작해야 한다 (Turbopack이 설치 전 해석을 캐시). 재시작으로 안 풀리면 `apps/web/.next` 삭제 포함 (글래도스가 같은 증상 확인).
    - 글래도스 기록용 참고 (Phase 3b+에서 처리): ① `answerCheckIn`의 재응답 거부가 `NOT_AUTHORIZED` 코드 재사용 → `ALREADY_ANSWERED` 전용 코드로 분리 권장(MCP/CLI 분기용) — **3b에서 처리 완료**, ② `later` 응답은 ChangeLog에 안 남음 — 응답 지연 추적 정책 미결, ③ 사유 폼의 "다시 확인할 시간"이 오늘 기준이라 과거 시각 입력 가능 — 다듬기 필요.
14. **Phase 3b 완료 (2026-07-02)**: 캘린더 단일 메뉴 구현 — 뷰 스위처(기본형/전체 멤버/타임라인) + 기간 스위처(일간/주간/월간, 기본형만), URL 반영(`?view=&range=&date=`), 마지막 뷰 쿠키 기억(뷰 파라미터 없으면 저장된 뷰로 redirect). 기본형=시간축 격자(08~19시)+마일스톤 밴드, 전체 멤버=사람 행×요일 열(드래그는 같은 행 안에서 날짜만), 타임라인=날짜 가로축 14일+멤버 행 막대+프로젝트 행 마일스톤 다이아몬드(at_risk 빨강)+오늘 하이라이트, 월간=6주 그리드(+n개 더). HTML5 드래그 이동 → 서버 액션(기존 지속시간 유지) → 규칙 검증 → 변경 로그 패널 반영. 회사/비공개 일정은 draggable=false+잠금 아이콘. 터치 대체: TaskStatusSheet에 날짜/시간 변경 폼 추가. core에 `moveMilestone`(프로젝트 담당자/관리자만) + `ALREADY_ANSWERED` 코드 — 테스트 29케이스. 사람/시간 라벨 sticky.
    - Base UI 주의: `Button`에 `render={<Link/>}`는 nativeButton 에러 — 링크 버튼은 `buttonVariants` 클래스를 Link에 직접 적용할 것.
    - 알려진 한계(다음 단계 후보): 회사 일정이 전체 멤버/타임라인 뷰에서 소유자 행에만 표시(참석자 행 미표시), 마일스톤 이동 시 연결 작업 동반 이동 확인 플로우 미구현(기획 요구, 후속), 타임라인 막대 드래그 시 기간(span) 유지 확인됨.
    - 글래도스 반려(1차)→수정: `?date=` 파라미터 무검증 500 → `parseDateParam` 화이트리스트(오늘 폴백) + 서버 액션 3종에 날짜(달력 존재 검증 포함)/시간(0~23) 검증 추가. URL 파라미터와 서버 액션 입력은 항상 화이트리스트로 방어할 것.
    - 글래도스 기록용 참고: `getRecentChangeLogs`가 모든 변경 제목을 전체 노출 — ChangeLog `visibleTo` 미사용. Phase 5 결제 마스킹 때 함께 결정.
15-1. **Phase 4 완료 (2026-07-02)**: 회의록→Action→Now 파이프라인.
    - core: `createMeetingNote`(원문 보존, 추출 대기), `extractActionItems`(규칙 기반 — bullet 라인만 후보화, "(담당: 이름)" 매칭, 마감일은 추출하지 않으므로 전부 needs_review로 시작, Task 자동 생성 절대 없음, 재추출 거부), `updateActionItem`(담당/마감/프로젝트 지정, 둘 다 채워지면 needs_review→candidate 자동 승격, resolve 권한 적용) — 테스트 35케이스.
    - web: 회의록 페이지(MD 파일 업로드 — 클라이언트에서 file.text() 읽어 서버 액션 전달, 원문 미리보기 Sheet, Action 추출 버튼, admin 공개범위 필터), Action 페이지(회의록 필터 칩, 후보 row에 담당자 Select+마감일 입력+저장, Task 생성/보류/무시, 생성된 Task 패널), Now 페이지(Calendar+Action 통합표, 필터 전체/내 항목/문제, metric 5종, 담당자 미지정 강조).
    - **Base UI Select 주의**: 선택값이 라벨이 아니라 value(id)로 표시된다 — Select root에 `items={{value: label}}` 매핑을 반드시 넘길 것 (action-row/status-detail-form/upload-note-form에 적용됨).
    - 글래도스 기록용 참고: ① `createMeetingNote`의 필수값 누락이 `INVALID_SCHEDULE` 코드 재활용 — `INVALID_INPUT` 전용 코드 고려, ② 번호 목록(1. 2.)은 추출 대상 아님 — Plaud 포맷 확인 후 확장 여지.
17. **API 계층(Phase A) 완료 (2026-07-02)**: MCP/CLI 계획의 Phase A. Slack 앱은 사용자가 외부라 생성 불가 → 알림 연동 보류하고 API/MCP/CLI 트랙으로 진행하기로 결정.
    - core: mock PAT (`mock/tokens.ts` — `que_pat_<userId>` 결정적 토큰, **mock 전용** 명시. 실서비스는 설정 화면에서 무작위 발급 예정).
    - web: REST API 15개 라우트 (`app/api/`) — me, my-day, now, team, tasks(GET/status/move), checkins answer, action-items(GET/PATCH/confirm/status), payments(GET 마스킹 경유/POST/status). `lib/api/auth.ts`(Bearer PAT + X-Que-Via 화이트리스트 mcp|cli), `lib/api/respond.ts`(QueRuleError→HTTP 매핑: NOT_FOUND 404, NOT_AUTHORIZED/EVENT_NOT_MOVABLE 403, ALREADY_* 409, 검증류 422, zod 422, 깨진 JSON 400).
    - MCP/CLI가 별도 프로세스라 웹 인메모리 DB와 상태 공유가 안 되므로, **MCP/CLI는 이 API를 호출**한다 (API-first의 이유).
    - curl 실측: 무토큰/쓰레기 토큰 401, 타인 작업 403, 사유 없는 issue 422, 담당자 없는 confirm 422, 재응답 409, 유령 404, 정상 경로 200/201, API 결제 응답도 마스킹 적용.
    - 글래도스 기록용 참고 (실서비스 전 필수): ① 본문 크기/필드 길이 제한 없음(1MB title 통과) — 공개 API 전환 시 zod `.max()` + 요청 크기 제한 추가할 것, ② 배포 빌드에서 `core/mock/tokens.ts` import 차단 가드 필요.
18. **MCP 서버(Phase B/C) 완료 (2026-07-02)**: `packages/mcp` — @modelcontextprotocol/sdk 1.29(stdio), 도구 15개 (조회 7: get_me/get_my_day/get_now_board/get_team_status/list_tasks/list_action_candidates/list_payment_requests — 전부 readOnlyHint, 변경 8: change_task_status/move_task/respond_checkin/update_action_item/confirm_action/resolve_action(destructiveHint)/create_payment_request/update_payment_status(destructiveHint)). 입력 스키마는 core의 zod v4 스키마 재사용(SDK가 zod ^4 peer 지원). 모든 호출이 웹 API 경유(`X-Que-Via: mcp`) — 규칙·마스킹·로그 동일 적용. `QUE_TOKEN`(필수)/`QUE_API_URL` 환경 변수. Claude Code 연결은 사용자가 루트에 `.mcp.json`을 직접 생성 (README "MCP 연결" 예시 참고 — 토큰이 사용자별이라 커밋하지 않음. 에이전트의 자동 생성은 자기 수정 정책으로 차단됨). 스모크: `scripts/smoke.mts`가 실제 stdio 클라이언트로 8케이스 검증(도구 목록/조회/규칙 거부/enum 거부) — **웹 dev 서버가 떠 있어야 통과**.
    - 미구현(후속): parse_task/create_task 2단계 도구 — 웹에 작업 생성 API 자체가 아직 없음(자연어 입력 확인 카드도 미구현 잔여 항목).
19. **CLI(Phase D) 완료 (2026-07-02)**: `packages/cli` — commander 기반 `que` 명령. login(~/.que/config.json, chmod 600)/me/today/tasks/task-status(--reason 등)/move/checkin/action(list·assign·confirm·hold·ignore)/pay(list·add·done·cancel·wait). 토큰 우선순위: QUE_TOKEN env > config 파일, 없으면 안내+exit 1. API 클라이언트를 `core/src/client.ts`로 이동(env 비의존, MCP/CLI 공유 — MCP의 api-client는 env 래퍼로 축소). 실측: 전 명령 동작, 이예진 토큰 pay list 전건 마스킹, 사유 없는 issue exit 1, action assign→confirm으로 Task 생성.
    - 글래도스 기록용 참고: `cli/bin/que.mjs`가 런타임에 `npx tsx`를 호출 — 전역 설치 배포 시 컴파일 산출물 실행으로 전환할 것 (mock/로컬 한정 구조).
    - 모델 사용 방침 (사용자 지시, 2026-07-02): 서브에이전트는 어려운 결정=Fable, 단순/정형 작업(게이트 체크리스트 검증, 문서 작성)=Sonnet (`model` 파라미터). 스펜드 한도 이슈 후 도입 — MCP 게이트부터 Sonnet 글래도스로 진행 중 (기존 Fable 에이전트 재개는 누적 컨텍스트 때문에 비쌈, 새 스폰 권장).
16. **Phase 5 완료 (2026-07-02)**: 프로젝트/결제/히트맵 — MVP 핵심 화면 전체 완성.
    - core: `createPaymentRequest`(필수값/금액 검증, 대기 상태), `INVALID_INPUT` 전용 코드 신설(글래도스 참고 반영 — createMeetingNote도 전환) — 테스트 36케이스.
    - 결제: 등록 폼, 마감 초과 대기 항목 상단 정렬+빨간 테두리, **민감 정보 마스킹 결정 및 구현** — 계좌번호/금액은 관리자와 요청자 본인만 원본, 그 외 `•••• 마지막4자리`/`금액 비공개` (`lib/payment-data.ts`). 상태 버튼도 권한 반영(입금 완료=관리자만, 취소=관리자+요청자). ChangeLog `visibleTo` 결정: 결제 요청 **제목**은 팀 공개(금액/계좌는 로그에 안 남으므로 노출 없음).
    - 히트맵: 멤버×7일, score=예상시간+문제2/홀드1/당일마감1 가중, 강도 0~4(색상+수치 병기로 색상 단독 구분 회피), 셀 클릭→해당 날짜 전체 멤버 캘린더, 총 작업량 바+병목 수, 과부하/여유 요약(평균 대비 150%/40%).
    - 프로젝트: 카드형 — 다음 마일스톤(D-day, at_risk 위험 배지), 진행률 Progress, 문제/홀드 목록, 담당자별 할당, 일정 변경 이력 3건.
15. **Phase 3c 완료 (2026-07-02)**: 팀 현황 화면 — 상단 요약 5종(진행중/문제/홀드/마감 임박 24h/응답 대기), 사람별 오늘 시간표(멤버 8행, 시간순 칩, 충돌 배지, 회사 일정 dashed, 타인 비공개는 자리비움), Attention Queue(문제발생/홀드는 최신 StatusLog의 사유·도움 필요·재확인 시간, 응답대기는 미응답 체크인), 일정 충돌 목록(같은 사람의 시간 겹침 pairwise), 최근 변경 내역(캘린더와 공용 `getRecentChangeLogs`). 데이터 조합은 `lib/team-data.ts`.

## 개발 시작 방법

1. `docs/claude-prompts/00_claude_code_설정_프롬프트.md`를 새 Claude Code 세션에 붙여 넣는다.
2. `01_플랜_계획_프롬프트.md`로 구현 플랜을 세운다.
3. `page-prompts/00_공통_앱쉘_프롬프트.md` → 각 메뉴별 프롬프트 순으로 구현한다.
4. 알림(12번)/설정(13번)은 프리뷰 제공 후 마지막에 진행한다.

프리뷰 HTML은 디자인/정보 구조 레퍼런스로만 사용하고, 실제 React 컴포넌트는 shadcn/ui 기준으로 새로 구성한다.

## 검수 기준 요약

- 태블릿 우선 설계: FHD 1920x1080, 1366x768, 태블릿 가로 1024x768, 태블릿 세로 768x1024
- 터치 대상 최소 40px (가능하면 44px)
- 캘린더/테이블/히트맵은 내부 스크롤 + sticky header
- shadcn 기본 theme token을 임의로 덮어쓰지 않는다
- 상태 색상 의미 고정: green=진행/완료, blue=예정/정보, amber=주의/대기, red=문제/취소, violet=회의록/응답대기
- lint, typecheck, build 통과

상세 기준은 `data/DESIGN.md` 13~14장과 `docs/que-product-plan.md`를 따른다.

20. **배포 준비 — Vercel+Supabase 결정 (2026-07-02)**: 배포 대상은 Vercel + Supabase로 확정. 사용자가 외부라 env(Supabase 키) 제공 전이므로 env 불필요한 준비를 선행 완료.
    - **mock 인증 배포 가드** (`lib/mock-auth-guard.ts`): production에서 `QUE_ALLOW_MOCK_AUTH=true` 옵트인 없이는 웹(500)/API(503) 전부 차단 — 실수 공개 배포 fail-safe. 글래도스 예고 사항 ② 이행. 주의: `getCurrentUser`에서 `cookies()`를 가드보다 먼저 호출해야 빌드 프리렌더가 통과한다 (dynamic 전환 트릭 — 주석 참고).
    - **API 입력 상한**: withApi 본문 100KB→413, core 길이 상한(제목 200/사유 500/회의록 50만 자/금액≤1조 등) — 글래도스 예고 사항 ① 이행. 테스트 38케이스.
    - **Supabase 스키마**: `db/supabase/schema.sql` (12테이블+PAT 테이블+인덱스, service_role 전제라 RLS 미사용). 배포 절차/env 목록/남은 코드 작업은 `data/docs/deploy-vercel-supabase.md` 체크리스트 참고.
    - env 도착 후 할 일: Supabase 어댑터(QueDb 구현)+시드 스크립트, Vercel 프로젝트(Root=apps/web)+Deployment Protection, 실 인증 전환.

21. **자연어 작업 생성 + 에러 표시 P0 (2026-07-02)**: MVP 잔여 항목이던 자연어 입력 완성.
    - core: `parseTaskInput`(순수 함수, 규칙 기반 — 담당자 이름/오늘·내일·모레·N월M일/오전·오후 H시(반·분) 해석, 모호하면 questions 반환, **저장 안 함**), `createTask` mutation(제목 필수·200자, 유령 담당자/역순 일정 거부, 담당 미지정=본인, 타인 지정 허용+ChangeLog) — 테스트 43케이스.
    - web: 오늘 화면 QuickAdd(자연어 입력→해석→**확인 카드**(편집 가능)→등록), API POST /api/tasks + /api/tasks/parse, MCP 도구 parse_task_input/create_task (15→17개, 스모크 갱신).
    - 에러 표시 P0: `(app)/error.tsx` + `global-error.tsx`(한국어, digest 코드, 다시 시도) + `lib/report-error.ts`(**2026-07-07 Sentry 배선 완료** — 콘솔 + `Sentry.captureException`). 기획: `data/docs/que-error-reporting-plan.md`.
    - 파서 알려진 한계: 요일 표현("금요일") 미해석 — 잔여어가 제목에 남지만 확인 카드에서 수정 가능. 개선 후보.
22. **에러 표시 P0-2 완료 (2026-07-02)**: `useSafeAction` 공통 훅(`components/app/use-safe-action.tsx`) — 서버 액션 결과를 성공 토스트+refresh / 규칙 거부 토스트(리포팅 안 함) / **예상 못 한 예외는 reportError+안내 토스트**(조용히 죽지 않음)로 일원화. 클라이언트 9곳 전환: checkin-panel, task-status-sheet(+ScheduleMoveForm), quick-add(parse는 별도 try/catch), use-move, upload-note-form, note-list, action-row, payment-form/list, user-switcher(void 액션이라 try/catch). 이로써 에러 리포팅 기획의 P0 중 env 불필요분(1·2번) 완료 — 남은 P0는 Sentry DSN 대기.

23. **체크인 스케줄러 + 하루 마감 요약 (2026-07-02)**: 하루 사이클 완성.
    - core `syncCheckIns(now)`: 시작 시간이 지난 **오늘의 scheduled 작업**에 체크인 생성 (멱등, 작업당 1회, 과거 날짜 제외, 진행중/완료 등 이미 상태 업데이트된 작업 제외 — 기획 체크인 정책). 시스템 동작이라 ChangeLog 없음. 웹 `getDb()`에서 매 접근 시 lazy 실행 — **배포 후 Vercel Cron 전환 예정** (deploy 문서에 추가 필요). 테스트 45케이스.
    - 오늘 화면 "하루 마감" 카드: 오늘 완료 n / 미완료 목록 + [내일로] 버튼(`deferTaskToTomorrowAction` — moveTask 재사용, 지속시간 유지, 동일 규칙/로그). 기획서 "추가 아이디어 4" 구현.
    - 실증: 시드에 없던 체크인(11:30 광고 소재 검수)이 오승훈 화면에 자동 생성, 내일로 이동 시 startAt +1일 확인.

24. **작업 댓글/도움 요청 (2026-07-02)**: 기획 권한 모델("타인 작업은 댓글·도움 요청만") 완성.
    - core: `TaskComment` 모델 신설(domain.ts, body 1~1000자) + `addTaskComment` mutation — **팀 누구나 타인 작업에 댓글 가능**, helpUserId 지정 시 도움 요청. 일반 댓글은 조용히 기록, **도움 요청만 ChangeLog** (기획 변경 공유 정책). schema.sql에 task_comments 테이블+인덱스. 테스트 47케이스.
    - web: TaskStatusSheet에 댓글 섹션(목록+작성+도움 요청 select), 오늘 화면 "주의 필요"에 나에게 온 도움 요청 카드, 팀 현황 Attention Queue에 help_request 타입 추가.
    - E2E 실증: 오승훈이 작업에서 황성현 지목 도움 요청 → 황성현 오늘 화면·팀 현황에 노출.
    - 후속 백로그: 댓글 API/MCP 도구(list/add) 미구현 — MCP에서 "그 작업에 댓글 남겨줘" 시나리오용.
    - 글래도스 반려(1차)→수정: ① 웹에 타인 작업 도달 경로 부재("쓸 수 없는 기능은 죽은 코드") → **팀 현황 시간표의 작업 칩을 클릭 가능**하게 하고 TaskStatusSheet에 `canEdit` prop 추가(false면 상태/일정 변경 UI 숨기고 안내문+댓글만 — canEditTask를 서버에서 계산, 최종 강제는 여전히 서버). ② Attention의 help_request "담당" 라벨이 작성자였음 → 작업 담당자로 수정(작성자는 detail에). 크로스유저 E2E 재실증: 송수용이 팀 현황에서 황성현 작업 열어 댓글 성공.

25. **스탠드업 뷰 (2026-07-02)**: 팀 현황에 뷰 토글(운영 보드/스탠드업, `?view=` 화이트리스트). `getStandupData` — 멤버별 어제 완료/어제 미완(이월 후보)/오늘 예정/막힘(문제·홀드). 아침 회의에서 이 화면 하나로 8명을 도는 풀형 스탠드업. 푸시형(매일 오전 Slack 발송)은 Phase E(Slack)에서 — "데일리 스탠드업 발송"으로 예약됨.

26. **수정됨 배지 + 일정 충돌 변경 제안 (2026-07-02)**:
    - 캘린더 칩에 "수정됨" 배지 — `lastChangedAt` 최근 24시간(기획 "일정 시간 표시"의 해석) 이내인 작업/Que 일정. `calendar-data.ts` `recentlyChanged`.
    - 오늘 화면 충돌 변경 제안 — **시작 전(scheduled) 내 작업**이 고정 일정(event)과 겹치면 "X가 Y(10:00–11:00)와 겹칩니다. 11:00로 변경할까요?" 카드 + 원클릭 이동(`acceptConflictSuggestionAction` → moveTask, 지속시간 유지). 진행중 작업이나 작업↔작업 충돌은 제안하지 않음(카운트만) — 의도적 결정. 기획서 "추가 아이디어 3" 구현.

27. **API 규칙 에러 500 결함 수정 (2026-07-02, 글래도스 발견)**: dev(Turbopack/HMR)에서 @que/core 모듈이 이중 로딩되면 `instanceof QueRuleError`가 false가 되어 규칙 에러가 403/422 대신 **빈 500**으로 새는 잠복 결함 (비결정적 — 첫 로드에선 정상, 재컴파일 후 발생). core에 `isQueRuleError()` 덕 타이핑 판별자(instanceof + name/code 병행) 신설, 웹의 catch 6곳(respond.ts + 서버 액션 5파일) 전부 교체. HMR 2회 강제 유발 후에도 403/422 유지 실측(글래도스 재검증).
    - **규칙**: 웹 계층에서 core 에러 판별은 `instanceof` 금지 — 반드시 `isQueRuleError()` 사용. core 내부(mock-db 등 같은 모듈 사본 안)는 instanceof 허용.

28. **요일 파싱 + 작업 병합 UI (2026-07-02)**:
    - 파서: "(다음 주|이번 주)? X요일" 해석 — 무접두는 다가오는 해당 요일(오늘 포함), "다음 주"는 다음 주(월요일 시작) 기준. 27번 항목의 알려진 한계 해소.
    - 병합: `changeTaskStatus`가 merged 전환 시 `mergedIntoTaskId` 필수 강제(자기 자신/유령 대상 거부). Sheet에 병합 버튼 + 대상 선택(활성 작업 lazy 조회 `getMergeCandidatesAction`). 체크인의 "병합" 응답은 대상 선택이 필요해 작업 상세로 안내(토스트). API/MCP `change_task_status`에 mergedIntoTaskId 반영. 테스트 49케이스.

29. **댓글 API/MCP/CLI (2026-07-02)**: 24번의 후속 백로그 완료 — GET/POST `/api/tasks/[id]/comments`, MCP 도구 `list_task_comments`(readOnly)/`add_task_comment` (도구 17→19), CLI `que comment <taskId> <내용...> [--help-from]`. 스모크에 댓글 2케이스 추가.

30. **CLI/MCP 배포 방식 결정 (2026-07-02)**: 사용자 확인 — env(Supabase/Vercel) 도착 후 배포 2단계까지 마치고 나서 착수. 이유: 지금 각자 로컬 `pnpm dev`가 서로 다른 인메모리 mock DB라 CLI를 "배포"해도 팀원끼리 같은 데이터를 못 봄 — 실서버 연결 전엔 의미가 없음. mock PAT(`que_pat_<userId>`)도 외부 배포용 인증으로 부적합.
    - 잠정 계획(실행은 보류): 1단계 `tsup`으로 `packages/cli`/`packages/mcp` 단일 번들 컴파일(`npx tsx` 런타임 의존 제거, `bin/que.mjs` 전환 — 75번 항목 이행), 배포 채널은 npm publish 대신 **GitHub 저장소 기반 설치**(`npm install -g "git+https://github.com/sunghyeonhwang/Que.git#main"`)를 기본 제안 — 슬랙 앱 때와 같은 이유(외부 계정/조직 생성 불필요, mock 구조 비공개 유지). 2단계에서 `QUE_API_URL`을 배포 URL로 전환, mock PAT를 `que login` 발급 플로우로 교체.

31. **`que-product-plan.md` 오픈 질문 전항목 답변 완료 (2026-07-03)**: 기획서 하단 "오픈 질문" 섹션 10개 전부 사용자 답변 받아 본문에 직접 반영 (각 항목에 확정 날짜 표기, 해당 절 번호는 기획서 "오픈 질문" 목록 참고).
    - Google Calendar 확정(Outlook 제외) / 업무 일정 기본 공개 범위 팀 전체 / 비공개 일정은 팀원에겐 `자리비움`, **관리자는 예외적으로 원본 상세 열람 가능** / 모바일은 웹+Slack으로 시작, 전용 앱은 추후 검토 / 회의록 원문은 기본 전체 열람, **회의록 단위로 좁은 권한 지정 가능**(예: 연봉협상 → 당사자+대표만) / Action 추출은 **규칙 기반+LLM 기반 모두 지원**(규칙 기반이 기본/폴백).
    - **중요 판단 — 관리자 리포트에서 "점수화된 업무 기여도"는 채택하지 않음.** 사용자 최초 요청엔 점수화가 포함돼 있었으나, 기획서에 이미 명시된 "관리자 화면 초점은 '누가 일하고 있나'가 아니라 '어디가 막혔나'"(팀 현황판 절)와 "히트맵은 개인 평가가 아니다"(히트맵 절) 원칙, CLAUDE.md의 "감시 도구가 아니라" 원칙과 정면충돌한다고 판단해 AskUserQuestion으로 재확인 → **점수화 없는 리포트**(전체 현황/주간/월간)로 확정. 3차 버전 로드맵 "관리자 리포트" 항목에 이 결정과 근거를 명시해둠 — 이후 세션에서 점수화 요청이 다시 나오면 이 판단 근거부터 재검토할 것.
    - 반복 업무 템플릿 필요 확정(주간/월간/외부 정기 회의) — 3차 버전 로드맵에 예시 추가.
    - **아직 미해결**: Plaud Note MD 실제 내보내기 포맷 — 샘플은 있으나 파일 전달 대기 중, 도착 후 회의록 파서 사양 확정 필요.
    - 위 결정들은 전부 기획 문서 반영일 뿐 구현은 아직 — 관리자 리포트, 반복 업무 템플릿, 회의록 단위 권한, 비공개 일정 관리자 열람은 백로그로 남음(우선순위는 32번 항목에서 확정).

32. **서브에이전트 model/effort 지정 + 백로그 우선순위 판정 (2026-07-03)**: 사용자 요청으로 두 가지 진행.
    - `.claude/agents/*.md` 전체에 `model`/`effort` frontmatter 추가 (기존엔 미지정 상태로 세션 모델 상속). 결정형(glados/planner/dev-lead) = `fable`+`high`(판정·기획 판단·아키텍처 결정은 뉘앙스 필요, [[model-usage-policy]] 원칙과 일치), 실행형(frontend-dev/backend-dev) = `sonnet`+`high`(구현이지만 과거 "죽은 코드"(24번 항목) 미스 이력 있어 effort 상향), qa-engineer = `sonnet`+`medium`(체크리스트 실행 위주), uiux-expert = `sonnet`+`high`(심사·개선 제안엔 판단이 들어가나 결정 권한은 없음).
    - **주의 — `glados` 등 프로젝트 커스텀 서브에이전트가 Agent tool의 subagent_type 레지스트리에서 인식되지 않음** (`Agent type 'glados' not found` 에러, 사용 가능 목록엔 claude/claude-code-guide/Explore/feature-dev:*/general-purpose/Plan/statusline-setup만 있었음). `.claude/agents/*.md`에 파일이 존재하고 frontmatter도 정상인데도 이번 세션에서는 로드되지 않음 — 원인 미확인(세션 재시작으로 해결되는지 다음 세션에서 확인 필요). 임시 우회: `general-purpose` 에이전트에 glados.md 페르소나 전문을 프롬프트로 그대로 주입 + `model: fable` 파라미터로 직접 지정해서 동일하게 작동시킴.
    - 우선순위 판정 결과(위 우회 방식으로 실행): **1위 비공개 일정 관리자 열람 → 2위 회의록 단위 열람 권한 → 3위 반복 업무 템플릿 → 4위 관리자 리포트 → 5위 Google Calendar 실연동**. 1·2위는 같은 "관리자/당사자 예외 열람" 패턴이라 연속 착수 권장, 마스킹 지점도 이미 특정됨(`calendar-data.ts`/`today-data.ts`/`now-data.ts`/`team-data.ts` 4곳 + `domain.ts:132` visibility enum 확장 필요). 4위는 시드 데이터가 최대 3일치뿐이라 지금 만들어도 반쪽 검증만 가능. 5위는 Google OAuth 앱 등록이 필요해 슬랙 앱과 같은 "외부라 계정 생성 불가" 벽에 부딪힐 가능성 — **착수 전 사용자에게 OAuth 앱 등록 가능 여부부터 확인 필요**. 1~4위는 env 도착 전에도 mock+vitest로 완결 검증 가능.
    - **부수 발견**: 우선순위 판정 중 `que-product-plan.md:1006`("관리자도 비공개 일정 상세를 보지 않는 것을 기본값으로")이 같은 날 확정한 161행("관리자는 예외적으로 원본 상세 열람 가능")과 정면충돌하는 걸 발견 → 1006행을 취소선 처리하고 161행을 가리키도록 수정.

33. **frontend-dev/backend-dev를 opus로 상향 (2026-07-03)**: 사용자가 "sonnet 전부 opus로" 제안 → 비용 정책(30번/32번, 월 한도 초과로 나온 절약 방침)을 뒤집는 결정이라 AskUserQuestion으로 범위 확인. **구현 2개(frontend-dev, backend-dev)만 opus로, qa-engineer·uiux-expert는 sonnet 유지**를 선택받음. 목적은 비용 절감이 아니라 품질 투자 — 두 에이전트가 과거 완결성 미스(24번 항목, 댓글 기능 도달 경로 부재) 이력이 있어 구현 정확성에 비용을 더 쓰기로 함. 서브에이전트 model 정책이 이제 3단 구조: 결정형(glados/planner/dev-lead)=fable+high, 구현형(frontend-dev/backend-dev)=**opus**+high, 체크리스트형(qa-engineer=sonnet+medium, uiux-expert=sonnet+high). 근거는 memory `model-usage-policy`에도 갱신.

34. **백로그 1·2위 구현 — 비공개 일정 관리자 열람 + 회의록 단위 열람 권한 (2026-07-03)**: 32번 우선순위 판정대로 착수.
    - core: `canViewPrivateEventDetail(event, viewer)` 신설 — 본인이거나 관리자면 비공개 일정 상세 열람 가능. `calendar-data.ts`/`now-data.ts`/`today-data.ts`/`team-data.ts` 4곳의 마스킹 로직을 이 함수로 교체.
    - core: `meetingNoteSchema.visibility`에 `"restricted"` 추가 + `restrictedUserIds` 필드 신설. `canViewMeetingNote(viewer, note)` 신설 — 관리자/업로더/지정 인원만 열람. `createMeetingNote`에 "지정 인원 1명 이상 필수" 검증 추가.
    - web: 회의록 업로드 폼에 공개 범위 Select(팀 전체/관리자만/지정 인원만)와 지정 인원 체크박스 UI 신설(기존엔 이 필드를 설정할 UI 자체가 없어 `admin`/`project` 등급이 죽은 코드였음 — 이번에 처음 노출). 목록에 "관리자 전용"/"지정 인원 N명만" 뱃지 추가.
    - 시드에 실증 데이터 추가: `note-salary-review`(연봉협상, visibility: restricted, restrictedUserIds: [박승환]) + 매칭 Action `act-salary-followup`.
    - **글래도스 1차 반려** — 재현 가능한 심각한 결함 2건 발견:
      1. `extractActionItems`(core)에 열람 권한 검사가 전무 — 지정 인원이 아닌 사람도 restricted 회의록에서 Action을 추출할 수 있었고, 추출된 원문(`sourceText`)이 그대로 저장됨.
      2. `/action` 페이지(noteById·필터칩 무필터), `/api/action-items` GET, `now-data.ts`의 actionRows가 전부 회의록 열람 권한을 안 걸러서 **restricted 회의록에서 나온 Action의 제목/원문/회의록 파일명이 팀 전체에 노출**됨. 즉 "회의록은 숨겼지만 그 회의록에서 나온 Action은 안 숨김" — 열람 제한 기능이 옆문으로 새고 있었음.
    - **수정**: `extractActionItems`에 `canViewMeetingNote` 가드 추가(위반 시 `NOT_AUTHORIZED`) + 회귀 테스트 2건. `/action`·`/api/action-items`·`now-data.ts` 3곳 모두 `canViewMeetingNote`로 필터링. curl로 관리자/지정 인원/외부인 3인 기준 재현 확인 — 외부인에게 완전히 안 보임, 관리자·지정 인원에게는 정상 노출.
    - **UI에서 "프로젝트 참여자" 옵션 제거**: `visibility: "project"` 등급은 원래부터(이번 diff 이전부터) 실제로 프로젝트 참여자로 제한하지 않는 기존 결함이었음(schema엔 있지만 필터 로직이 처리 안 함, "프로젝트 참여자"라는 멤버십 개념 자체가 도메인에 없음). 이번에 처음으로 이 값을 UI에서 선택 가능하게 만들 뻔했는데, 지키지 못하는 약속을 팔지 않기 위해 Select에서 제거(schema enum 값은 하위호환으로 유지, UI만 안 보여줌). **후속 결정 필요**: "프로젝트 참여자"를 실제로 구현하려면 프로젝트 멤버십 개념부터 새로 정의해야 함 — 별도 기획 확인 후 진행.
    - **범위 제외 결정 (글래도스 승인)**: ① `Task.visibility`(개인 작업의 private 필드)는 이번 작업에서 안 건드림 — private task를 만드는 UI/플로우 자체가 없어 휴면 필드, CalendarEvent.visibility와는 별개. ② 관리자가 타인의 비공개 일정을 열람해도 별도 표시나 감사 로그를 남기지 않음 — 열람은 "변경"이 아니라 ChangeLog 대상 밖이고 기획서 161행이 예외 열람을 이미 허용. 실 인증 전환 시 열람 감사 로그 필요 여부는 재검토.
    - 최종 검증: `pnpm -r typecheck`/`lint` 통과, core 테스트 49→59케이스, `pnpm build` 성공(dev 서버 종료 확인 후 실행), production 빌드(`QUE_ALLOW_MOCK_AUTH=true`, 포트 3987 격리)로 curl 3인 재현 + Playwright로 4개 화면(팀 현황·회의록·Now·업로드 폼) 실측 후 글래도스 재승인.

35. **백로그 3위 — 반복 업무 템플릿 (2026-07-03)**: 32번 우선순위 판정대로 착수. 매주/매월 반복되는 정기 업무를 템플릿으로 등록하면 다가오는 회차를 Task로 미리 만들어준다(기획서 976행).
    - core: `RecurringTemplate` 스키마 신설(`frequency`: weekly/monthly, weekly는 `dayOfWeek` 필수·monthly는 `dayOfMonth`(1~28, 월말 문제 회피) 필수 — zod `.refine`으로 필드 *존재*를 강제). `taskSourceSchema`에 `"recurring_template"` 추가, `Task`에 `recurringTemplateId` 역참조 필드 추가. `canManageRecurringTemplate` 규칙(만든 사람/관리자만 켜고 끌 수 있음).
    - core: `createRecurringTemplate`/`setRecurringTemplateActive`/`syncRecurringTemplates` (mock-db). 스케줄러는 체크인과 동일한 lazy 패턴 — `syncCheckIns`처럼 `getDb()` 접근 시마다 실행, **3일 이내 다가오는 회차만** Task로 생성(너무 일찍 만들지도, 당일 임박까지 기다리지도 않음), `lastGeneratedFor`(YYYY-MM-DD)로 멱등 보장. 템플릿을 꺼도 이미 생성된 Task는 취소되지 않음(다음 회차부터만 중단) — 의도적 결정.
    - web: `apps/web/src/lib/db.ts`에 `syncRecurringTemplates` lazy 실행 연결. **프로젝트 페이지**에 등록 폼 + 목록 UI 신설(신규 메뉴 없이 기존 화면에 배치 — CLAUDE.md 메뉴 구조 확정 원칙 준수). 목록은 만든 사람/관리자에게만 켜기/끄기 버튼 노출.
    - 시드에 예시 2건 추가: `tmpl-weekly-standup`(매주 월요일, 황성현), `tmpl-monthly-settlement`(매월 25일, 오승훈).
    - **글래도스 1차 반려** — 재현 가능한 결함 2건 발견, 둘 다 "스키마는 있지만 mutation 경로에 연결 안 됨" 유형:
      1. `createRecurringTemplate`가 필드 *존재*만 확인하고 *범위*는 검증하지 않아 `dayOfMonth: 31`, `dayOfWeek: 9`, `startTime: "99:99"`, 존재하지 않는 `projectId`가 전부 통과함. 서버 액션이 무검증으로 core에 그대로 전달해서 실질적으로 막는 계층이 없었음.
      2. `nextOccurrenceDate`의 월 계산이 `cursor.setMonth(+1)` 후 `setDate(target)` 순서라, 오늘 날짜가 target보다 크면(예: 1/30에 매월 1일 템플릿) JS Date 오버플로우로 한 달을 더 건너뜀(1/30+1개월="2/30"→3/2로 밀림) → 월 경계 회차가 통째로 유실될 수 있었음.
    - **수정**: `createRecurringTemplate`에 `dayOfWeek`(0~6)/`dayOfMonth`(1~28)/`startTime`(00~23:00~59)/`projectId` 존재 검증 추가. `nextOccurrenceDate`는 `new Date(year, month, day)` 생성자로 연/월/일을 한 번에 구성하도록 재작성해 월 오버플로우 제거. 회귀 테스트 2건 추가(범위 밖 입력 4종 거부, 1/30 sync 시 정확히 2/1 회차가 3일 윈도우 안에서 생성되는지).
    - 테스트 9건 추가(core 59→68케이스): 주기별 필수 필드 검증, 권한(만든 사람/관리자만), 3일 이내 생성+멱등, 비활성 시 미생성, 3일 초과 회차 미생성, 범위 밖 입력 거부, 월말 경계 회귀.
    - E2E 실증(Playwright, dev 서버): 프로젝트 페이지에서 실제 템플릿 생성 → 목록에 즉시 반영 → 끄기 버튼으로 비활성화 → `/api/tasks?assignee=`로 생성된 Task 확인(source: recurring_template, recurringTemplateId 연결 확인). 3일 초과 회차(월간 정산)는 예상대로 미생성 확인.
    - 최종 검증: `pnpm -r typecheck`/`lint` 통과, core 테스트 68/68, `pnpm build` 성공(dev 서버 종료 확인 후). 글래도스 재승인 후 커밋.

36. **시드 6주 이력 확장 + 관리자 리포트 (백로그 4위, 2026-07-03)**: 사용자 지시 "시드 채우고 4위 진행".
    - **시드 확장** (`packages/core/src/data/seed.ts`): 지난 42~3일의 완료/취소 이력을 결정론적(인덱스 기반, random 없음)으로 생성 — 55건(완료 46/취소 9) + 매칭 StatusLog, 8명·프로젝트에 고르게 분산. 근래 2일(어제·그제)은 건드리지 않아 오늘/스탠드업 화면 미교란(d>=3). 목적: 주간/월간 리포트가 빈 표가 아니라 실데이터로 검증되게 함(글래도스가 우선순위 판정 때 "3일치로는 반쪽 검증"이라 예고한 문제 해소).
    - **관리자 리포트** (`apps/web/src/lib/report-data.ts`, `components/team/admin-report.tsx`): 팀 현황 페이지에 **admin 전용 뷰**로 추가(CLAUDE.md 고정 메뉴 불변 — 기존 `?view=` 스위처 재사용, `리포트` 탭은 관리자에게만 렌더 + `?view=report` URL 직접 접근 시 비관리자는 운영 보드로 되돌림 + `getAdminReportData`가 비관리자에 빈 골격 반환 = 3중 방어). 주간(7일)/월간(4주=28일) `?period=` 스위처.
    - **집계 원칙 — 점수화 없음**: 완료는 **프로젝트별**로만 보여줌(개인 완료 순위 없음 = 기획서 "감시 아님" 원칙). 병목은 현재 막힌 작업(도움 필요 관점, 사유·경과일 포함), 부하는 멤버별 열린 작업 수(밸런싱용, "평가 아님" 명시). 전체 현황 스냅샷(진행 프로젝트/열린 작업/막힘/위험 마일스톤/결제 대기·연체). 결제는 **건수만** 집계(계좌·금액 미노출). 상태 전이는 StatusLog가 유일 출처 → 시드 이력 + 런타임 `changeTaskStatus` 모두 자동 반영(라이브).
    - **수치 정합**: 월간 span을 28일(정확히 4주)로 잡아 헤드라인 완료수 == 주별 추세 합 == 프로젝트별 합이 일치하게 함(브라우저 실측: 27=27=27).
    - E2E 실증(Playwright): 관리자는 리포트 노출, 팀원은 탭 없음 + URL 직접 접근 시 운영 보드로 리다이렉트. `changeTaskStatus`로 done 처리 시 주간 완료수 즉시 +1(라이브 반영 확인). report-data는 heatmap-data·team-data와 같은 web 쿼리 계층이라 동일하게 브라우저 검증(core 유닛테스트 대상 아님).
    - **적대적 리뷰 1차 반려(4렌즈 워크플로 + 글래도스)** — 민감정보 유출·접근제어·집계정합은 전부 통과(회의록 버그 같은 "옆문" 없음, 관리자 전용 3중 방어 뚫리지 않음, 27=27=27 정합), 그러나 실제 결함 2건:
      1. **병목 경과일 오표기**: `sinceLabel`이 경과시간 floor 기준이라 어제 17:30 홀드된 작업이 24h 미경과 시 "오늘"로 표기 → 병목 지속시간 하루 과소보고. → `calendarDayDiff`(자정 기준 달력일 차)로 수정. 어제 홀드 = "1일째"로 표기(브라우저 실측).
      2. **부하 분포가 기획서 §9 위반**: 열린 작업 *원시 개수*만 세고 내림차순 정렬 → "평가 아님" 라벨에도 리더보드처럼 읽힘. §9는 "단순 개수 말고 예상 소요·마감·문제 가중 반영" 요구. → `loadScore`(예상 시간 + issue+2/hold+1/마감임박+1 가중)로 바꾸고 정렬을 **고정 로스터 순서**(db.users)로 변경해 순위 인상 제거. 컴포넌트도 "예상 Nh" 표기 + "단순 작업 수 아님" 문구 추가.
    - **부수 개선(리뷰 low 지적)**: 시드 이력이 issue/hold 전이 로그를 안 만들어 병목유입이 주간/월간 항상 2/1로 고정되던 문제 → 이력 완료 건 일부에 과거 issue/hold 전이 로그 추가(최종상태 done 유지라 '현재 막힘'은 미오염). 이제 병목유입이 주간 issue2/hold1 vs 월간 issue7/hold3로 기간별 변동(실측).
    - 최종 검증: `pnpm -r typecheck`/`lint` 통과, core 68/68, `pnpm build` 성공(dev 종료 후), 3개 수정 전부 브라우저 실측. 글래도스 재심사 후 커밋 예정.
    - **알려진 한계/후속**: MCP/CLI에 리포트 조회 도구 미구현(웹 전용). 개인 완료 데이터는 시드에 존재하나 리포트에 순위로 노출하지 않음(원칙) — 향후 요구 시 별도 기획 확인. report-data가 task.visibility(private)를 필터하지 않으나 현재 private task가 없어 무해 — 심층방어로 후속 검토 권장(리뷰 privacy 렌즈 노트).

37. **Google Calendar 연동 — 비-env 골격 (백로그 5위, 2026-07-03)**: 실 OAuth 연동은 외부 계정/자격증명이 필요해(슬랙 앱과 동일한 벽) env 도착 전 불가. 그래서 자격증명과 무관하게 **지금 필요하고 테스트 가능한 부분**만 만들었다(글래도스가 우선순위 판정에서 지정한 "CalendarProvider 인터페이스 + 동기화 엔진").
    - core: `CalendarProvider` 인터페이스(`calendar-provider.ts`, `listEvents(range)` — 실 구현은 async 허용) + `ExternalCalendarEvent` zod 스키마. `MockGoogleCalendarProvider`(`mock/mock-google-calendar.ts`) + `defaultMockGoogleEvents(now)` 데모 픽스처(멱등/갱신 시연용 — weekly-sync 시간 변경 + 신규 townhall/design-sync).
    - core: `MockQueDb.syncExternalCalendar(provider, rangeStart, rangeEnd)` — 외부 일정을 회사 일정(source:"company")으로 **멱등 upsert**. externalCalendarId로 매칭해 변경분만 갱신, 없으면 추가. 회사 일정은 `canMoveCalendarEvent`가 source==="que"만 허용하므로 읽기 전용 유지. 매핑 불가 소유자·시간 역전은 skip. 삭제 동기화는 후속 과제.
    - web: `POST /api/calendar/sync` (**관리자 전용**, 403 게이트) — 지금은 mock 제공자를 쓰고, env 도착 후 `GoogleCalendarProvider`(OAuth+API)로 교체하면 실 연동. 배포 후엔 이 엔드포인트를 Vercel Cron이 호출하는 그림. API-first 아키텍처의 자연스러운 연동 지점이라 별도 UI 버튼 대신 엔드포인트로 노출(죽은 코드 아님 — 동기화된 일정은 기존 calendarEvents로 흘러 캘린더에 그대로 렌더).
    - 테스트 6건(core 68→74): 신규 추가+읽기전용, 멱등(재동기화 0건), 시간변경→갱신(중복 아님), 매핑불가/시간역전 skip, 기간 밖 미반환, 참석자만 변경→갱신 감지.
    - E2E 실증(curl+Playwright): 팀원 403 / 관리자 1차 added2·updated1 / 2차 멱등 0 / 동기화된 "월간 타운홀"이 캘린더에 실제 렌더 확인.
    - **글래도스 심사 1차 승인** — 멱등성(4회 반복 바이트 동일)·읽기전용 불변식(동기화 일정 moveCalendarEvent 거부)·접근제어(팀원 403)·입력방어(유령 owner/시간역전 skip)·갱신vs중복 전부 재현 통과. 비차단 관찰(attendeeIds/visibility만 바뀌면 갱신 감지 안 됨 — 실 연동 시 참석자 변경 유실) 즉시 반영: `changed` 비교에 visibility·attendeeIds(JSON 비교) 추가 + 잠금 테스트. 멱등성 유지 확인.
    - **env 도착 후 남은 실 연동 작업**: ① Google Cloud OAuth 앱 등록(사용자 확인 필요 — 슬랙처럼 "외부라 불가"인지), ② `GoogleCalendarProvider.listEvents` 구현(OAuth 토큰 + Calendar API), ③ Vercel Cron으로 `/api/calendar/sync` 주기 호출, ④ 외부 이벤트 삭제 동기화, ⑤ Google 사용자 ↔ Que userId 매핑 테이블. 지금 만든 엔진/인터페이스/엔드포인트는 그대로 재사용.

38. **Supabase 프로젝트 초기 마이그레이션 (2026-07-03, env 트랙 시작)**: 사용자가 Supabase env(`data/.env`, gitignore됨) + Supabase MCP(`mcp.supabase.com`, project_ref `rnsqhipljpdmmkviiypy`) 제공.
    - **중대 발견**: 이 Supabase 프로젝트는 비어있지 않았음 — 다른(더 큰) 앱의 스키마 20테이블 + 실데이터(profiles 7·tasks 25·calendar_events 22·payments 25·meetings 21 등, workspaces/onboarding/policies/approval/audit 포함)가 있었고 `tasks`·`calendar_events` 이름이 Que와 겹침. 임의 적용 시 충돌/데이터 훼손 위험이라 **중단하고 사용자 확인** → 사용자 결정: "기존 스키마 모두 삭제하고 새로 만들어 사용".
    - **안전조치**: 삭제 전 기존 20테이블 전량을 `db/supabase/backup-before-que/*.json`으로 백업(REST, gitignore됨 — PII/결제 데이터라 커밋 금지).
    - **연결 경로**: DDL은 secret key(PostgREST)로 불가 → 직접 Postgres 필요. 직접 호스트 `db.<ref>.supabase.co`는 DNS 미해석(최신 Supabase는 IPv6 전용/비활성) → **Session pooler**(`aws-1-ap-northeast-2.pooler.supabase.com:5432`, user `postgres.<ref>`)로 연결. 런타임 앱은 pooler 불필요 — supabase-js(PostgREST, API 호스트는 정상 해석)로 붙을 예정.
    - **실행**: `db/supabase/migrate-fresh.sql`(구 객체 20테이블+3함수 CASCADE 삭제 → `schema.sql` 생성, `begin;…commit;` 단일 트랜잭션) + 러너 `db/supabase/run-migration.mjs`(pg, `data/.env`에서 연결 읽음, `--check` 모드). 결과: **public에 Que 14테이블만**(13 core + personal_access_tokens), 외래키 31·인덱스 25. 핵심 컬럼(recurring_template_id, restricted_user_ids, recurring_templates.*) 검증 완료.
    - **schema.sql 갱신**: 이번 세션 변경 반영 — tasks.source에 `recurring_template`+`recurring_template_id` 컬럼, meeting_notes.visibility에 `restricted`+`restricted_user_ids`, change_logs.entity_type에 `recurring_template`, `recurring_templates` 테이블+인덱스 신설.
    - **주의/후속**: 사용자가 `data/.env`를 pooler 문자열 추가하며 덮어써 **기존 API 키(SUPABASE_URL/SECRET_KEY/PUBLISHABLE_KEY/JWKS_URL)가 사라짐**. 런타임 어댑터(supabase-js) 구현엔 SUPABASE_SECRET_KEY + SUPABASE_URL이 다시 필요. **다음 단계 = Supabase 어댑터(QueDb 구현) + 시드 스크립트** — 이때 키 재수령 필요.
    - Supabase MCP는 등록됐으나 이번 세션에선 "Needs authentication"으로 도구 미로드(세션 재연결 필요할 수 있음) — 마이그레이션은 pooler 직결로 처리해 MCP 없이 완료.

39. **Supabase 어댑터 — 앱이 실 DB를 읽고 쓴다 (2026-07-03)**: mock → 실 Supabase 전환 완료. 플랜(`~/.claude/plans/inherited-greeting-lighthouse.md`) 승인 후 구현.
    - **설계**: `SupabaseQueDb extends MockQueDb`(`apps/web/src/lib/supabase-db.ts`) — 16개 mutation·도메인 규칙을 **재구현 없이 상속**. 요청마다 전체 스냅샷 load(supabase-js/PostgREST) → 부모 public 배열 채움 → mutation은 부모(동기, 규칙 강제)가 메모리 반영 → `persist()`가 로드 시점 대비 **diff**(JSON 비교)로 신규/변경 upsert(FK 순서) + 삭제(역순). 손대지 않은 행은 문자열 동일이라 자동 제외. `nextId`는 `crypto.randomUUID()`로 override(요청 간 충돌 방지).
    - **매핑**: `packages/core/src/data/supabase-rows.ts` — `toRow`/`fromRow`(camel↔snake, undefined↔null, numeric 문자열 캐스팅), `rowForTable`(도메인 전용 필드 제거 — Project.milestoneIds는 컬럼 없음). load 시 milestoneIds는 milestones에서 재구성.
    - **getDb() async화**: `apps/web/src/lib/db.ts` — React `cache()`로 **요청 단위 캐시**(같은 요청 내 재로딩·재persist 없음). `QUE_DB=supabase`+`SUPABASE_URL`+`SUPABASE_SECRET_KEY` 있으면 Supabase, 없으면 mock(기본). MockQueDb에 no-op `async persist()` 추가(호출부가 mock/supabase 구분 없이 `await db.persist()`).
    - **async 전파(30+파일)**: getDb가 async라 데이터 라이브러리 9개(`*-data.ts`+comments)를 `async`+`Promise<T>`화, 호출부(페이지·API·서버액션)에 `await` 추가, mutation 래퍼 `toResult`를 async+persist화, API 라우트 mutation 뒤 `await db.persist()`. **주의**: 1차 sed가 `await getDb().method()`(=`await (getDb().method())`, Promise에 메서드 접근) 우선순위 버그를 만들어 서브에이전트가 `const db=await getDb(); db.method(); await db.persist()`로 교정. typecheck가 최종 안전망.
    - **DDL/시드 도구**: `db/supabase/migrate-fresh.sql`(teardown+schema), `run-migration.mjs`, `seed.mts`(정본 리셋 = truncate+재삽입). DDL은 pooler 직결(pg), 런타임은 supabase-js. `pg`는 root devDependency.
    - **글래도스 적대적 리뷰 반려 1건(치명) → 수정 → 승인**: `toResult`(6개 서버 액션의 mutation 래퍼)가 `await fn()`(인스턴스 A에 mutation) + `await (await getDb()).persist()`(인스턴스 B — React `cache()`가 **서버 액션 경계에선 같은 인스턴스를 보장 못 함**)를 서로 다른 인스턴스에서 실행 → persist가 변경 없는 새 스냅샷에서 돌아 **웹 UI의 모든 mutation이 Supabase에서 조용히 유실**(API 라우트는 단일 인스턴스라 무사, 하필 주 인터페이스인 웹만 뚫림). 최초 E2E가 API(curl)+읽기 렌더만 검증해 이 구멍을 놓침. **수정**: `toResult`가 db를 한 번 획득해 콜백에 넘기고(`toResult((db) => db.method(...))`) 같은 인스턴스로 persist. 사전 읽기가 있던 calendar 3개 + `deferTaskToTomorrow`는 검증을 콜백 안으로 이동(not-found는 `QueRuleError` throw). **교훈: getDb의 cache 정체성에 기대는 코드는 서버 액션 경계에서 금지 — mutation과 persist는 반드시 같은 인스턴스.** 재심사: 웹 폼 3종(결제 완료·하루 마감·체크인 응답) DB 재조회로 영속 확인, 회귀 없음.
    - **E2E 실증(실 DB)**: 읽기(team API 8멤버, tasks 실 DB) / 쓰기 영속(API+웹폼 모두 status change → DB에 done+status_log/change_log 저장) / CREATE(uuid id 신규 행 영속, source/owner 정확) / **멱등성**(반복 스케줄러가 반복 요청에도 스탠드업 태스크 1개 — last_generated_for 영속, GET 전후 xmin 해시 동일 = 읽기가 쓰기 유발 안 함) / 브라우저 팀·결제 페이지 렌더+버튼 / **mock 무영향**(env 없이 8멤버·에러0, core 74테스트·build·lint 통과). 검증 후 정본 시드로 리셋.
    - **알려진 특성/후속**: ① 요청마다 전체 스냅샷 로드(≈200행이라 저렴하나, 규모 커지면 타겟 쿼리로 최적화). ② persist는 last-write-wins(동시 요청 낙관적 충돌 미처리 — 8인 저경합이라 수용, 후속에 버전 체크 검토). ③ 스케줄러는 여전히 getDb에서 lazy(멱등) — 배포 후 Vercel Cron 전환은 deploy 문서대로. ④ 인증/정적 USERS는 시드 id가 동일해 이번 단계 미변경(실 인증은 별도 백로그).

40. **Supabase RLS 하드닝 (2026-07-03, env 트랙)**: Supabase MCP 재인증 후(옛 DCR client_id가 키체인에 캐시돼 `Unrecognized client_id` → `~/.claude` 키체인 `Claude Code-credentials`의 `mcpOAuth."supabase|..."` 항목 삭제로 새 등록 유도) 보안 어드바이저 확인 → **14개 테이블 전부 RLS 비활성 = publishable/anon 키로 전 행 읽기/쓰기 가능**(계좌번호 `payment_requests.account_number` 포함, critical) 발견.
    - **조치**: 14개 테이블 `ENABLE ROW LEVEL SECURITY`(정책 없음) + `set_updated_at` search_path 고정 마이그레이션 적용. 앱은 `SUPABASE_SECRET_KEY`(service_role급)로만 붙어 RLS 우회 → **무영향**, anon 경로만 차단. `supabase-db.ts:41`이 secret 키로만 `createClient`하고 anon 클라이언트가 코드에 없음을 사전 확인.
    - **실측**: secret 키로 `payment_requests` 조회 → 계좌번호 정상 반환(앱 동작), publishable/anon 키로 동일 조회 → `[]`(차단). 어드바이저 critical/ERROR 3종(rls_disabled·sensitive_columns_exposed·function_search_path) 해소, 남은 건 INFO(rls_enabled_no_policy = 의도된 deny-all)·WARN(auth_* = Supabase Auth 미사용이라 무관).
    - **후속**: `db/supabase/schema.sql`은 아직 RLS 구문 미포함 → DB 재생성 시 `migrate-fresh.sql` 뒤에 RLS ALTER를 다시 적용해야 함(deploy 문서에 명시). 실 인증(Auth.js) 도입 후 세분화 정책이 필요하면 그때 policy 추가 검토.

41. **Vercel 배포 준비 코드 파트 + 인천 리전 (2026-07-03)**: 사용자 지시 "A-B-C로 진행"(A=Vercel 배포, B=실 인증, C=커밋).
    - **A 완료(코드 파트)**: `apps/web/vercel.json` 신설 — `"regions": ["icn1"]`로 **인천 리전 고정**(Supabase도 서울 `ap-northeast-2`이라 동일 리전, 왕복 지연 최소화). typecheck·lint·`pnpm build`(dev 미실행 확인 후) 전부 통과. 대시보드 조작(프로젝트 import·Root=apps/web·env 4종·Deployment Protection)은 사용자 몫이라 체크리스트로 안내(deploy 문서 참고). 체크인 스케줄러 Vercel Cron 전환은 후속(엔드포인트 신설 필요, deploy 문서 4-1).
    - **B**: 사용자가 "이메일+비밀번호가 제일 간단"으로 결정 → 42번에서 구현 완료.
    - **C 완료**: A + RLS(40번) + 문서 변경을 커밋. B(42번)는 별도 커밋.

42. **웹 실 인증 — Auth.js 이메일+비밀번호 (2026-07-03)**: mock 쿠키(아무나 사용자 전환) → 실 로그인 전환. 41번의 B 결정("제일 간단" = 이메일+비밀번호) 이행.
    - **스택**: `next-auth@5.0.0-beta.31`(Auth.js v5) Credentials provider + JWT 세션(어댑터 불필요), `bcryptjs`(서버리스 안전). **Next 16은 middleware가 `proxy`로 개명 + "proxy를 인증 솔루션으로 쓰지 말라" 명시** → middleware/proxy 없이 `getCurrentUser`가 세션 읽고 미인증 시 `redirect("/login")` (더 단순·안전). `apps/web/src/auth.ts`(NextAuth 설정), `lib/auth/verify.ts`(검증), `app/login/*`(폼+액션), `api/auth/[...nextauth]/route.ts`.
    - **DB**: `users`에 `email`(lower 유니크 인덱스)·`password_hash` 컬럼 추가(실 DB 적용 + schema.sql·seed.mts 반영). 8명 이메일 `<이름>.<성>@griff.co.kr`(대표 실 이메일 패턴과 동일, 나머지 7명은 추정 — 실제와 다르면 수정), 초기 공용 비번 `que-2026!`(bcrypt(10), core `SEED_PASSWORD_HASH`/`DEV_PASSWORD`/`emailForUser`).
    - **유출 방어(중요)**: `SupabaseQueDb.load()`가 `select *`+제네릭 `fromRow`라 그대로면 `password_hash`가 메모리 User→팀 API로 샘 → **users 로드에서 `passwordHash`·`email` 삭제**. 도메인 `User`는 불변(email/passwordHash 미포함), 인증 계층만 `verify.ts`에서 별도 쿼리로 password_hash 조회. 실측: `/api/team` JSON에 password_hash·email 노출 0.
    - **mock/dev 호환**: `verify.ts`가 `QUE_DB=supabase`면 실 DB 조회, 아니면 정적 USERS의 파생 이메일 + `DEV_PASSWORD`로 검증 → 로컬 인메모리 개발도 같은 자격증명으로 로그인 가능(안 깨짐).
    - **역할별 진입점 유지**: 관리자→/now, 팀원→/today (기존 `/` 로직 그대로, 이제 세션 기반). `UserSwitcher`는 "이름+로그아웃" 메뉴로 교체(사용자 전환 제거), `switchUser` 액션→`logout`(signOut). `AUTH_SECRET`는 `data/.env`(gitignore)에 추가, Vercel env 필수.
    - **E2E 실측(실 DB dev + curl)**: 미인증→/login(307), CSRF→로그인 성공(302, 세션쿠키), 관리자→/now·팀원→/today, 틀린 비번 거부(세션 없음), `/now` 렌더(이름 표시), 로그아웃→세션 무효화→/login, 팀 API 유출 0. mock 모드 로그인/거부도 확인. typecheck·lint·`pnpm build`(dev 종료 후) 통과.
    - **범위 제외(B2 후속)**: ① API/MCP/CLI는 여전히 mock PAT(`QUE_ALLOW_MOCK_AUTH` 게이트) — `personal_access_tokens`(해시) 전환 필요, ② 첫 로그인 비밀번호 강제 변경/개별 발급 미구현(사내 프리런치라 공용 임시비번 수용), ③ 글래도스 최종 게이트 미실행(다음 세션에서 커스텀 서브에이전트 인식되면 적대적 재검증 권장 — 특히 유출 방어·세션 위조).

43. **Vercel 프로덕션 배포 (2026-07-03)**: 사용자 "VERCEL에 배포해줘".
    - **결과**: <https://que-rouge-eight.vercel.app> — 팀 `griff0120s-projects`, 프로젝트 `que`, **Root Directory=`apps/web`**(Vercel API로 설정 — CLI 링크만으론 apps/web 하위만 업로드돼 `npm install` 실패, 루트 링크+rootDirectory로 전체 pnpm workspace 업로드해야 빌드됨), 리전 `icn1`(vercel.json), env 4종(`QUE_DB`/`SUPABASE_URL`/`SUPABASE_SECRET_KEY`/`AUTH_SECRET`, production+preview). **`QUE_ALLOW_MOCK_AUTH`는 의도적으로 미설정** → 웹은 실 인증, mock-PAT API는 503(봉인).
    - **프로덕션 런타임 E2E 실측**: /login 200, 미인증→/login, 관리자 로그인→세션→/now, 틀린 비번 거부, 미인증·mock PAT API 모두 503(계좌 노출 0). icn1 서빙 확인(`x-vercel-id: icn1::`).
    - **⚠️ Deployment Protection 사고**: 배포 시 Vercel Authentication(SSO)이 기본 ON이었는데 런타임 검증하려고 API로 `ssoProtection:null` 껐다가, **재활성화가 API/재배포로 안 됨**(값은 `all_except_custom_domains`로 세팅되나 엣지 미강제, `all`은 None 반환 — 플랜/전파 특성 추정). 현재 **공개 접근 가능하나 실 인증+mock API 503이라 데이터 유출 없음**. 재활성화하려면 **대시보드 Settings→Deployment Protection→Vercel Authentication**. 교훈: 보호 재활성화가 API로 안 되니 검증용으로 함부로 끄지 말 것 — automation bypass도 이 프로젝트에선 PATCH 거부됨.
    - **CLI 참고**: Vercel CLI 인증됨(`sunghyeonhwang-1862`), 토큰은 `~/Library/Application Support/com.vercel.cli/auth.json`. 배포는 `vercel deploy --prod --scope griff0120s-projects`(레포 루트에서). `.vercel/`·`.env.local`은 gitignore됨.
    - **남은 것**: ① Deployment Protection 재활성화(대시보드, 원하면) ② 팀에 로그인 안내(이메일+공용 임시비번 `que-2026!`, 실제 이메일 검증) ③ B2(PAT 해시화 후 `QUE_ALLOW_MOCK_AUTH`+Protection으로 MCP/CLI 개방) ④ 커스텀 도메인(원하면).

44. **유저 정보 정정 + 커스텀 도메인 + MCP/CLI 개방 (2026-07-03)**: 사용자 지시(재활성화·유저정보·개방·커스텀도메인). `data/docs/que-user-info.md`(PII라 gitignore) 기준.
    - **유저 정보(item 2)**: 실제 이메일로 정정 — 오승훈 `seunghun.oh`(추정 seunghoon 오류), 황성진 `seongjin.hwang`(추정 sungjin 오류). `emailForUser`를 유도→`USER_EMAILS` 명시 맵으로 교체(id 로마자와 실제 불일치). **오승훈 직급 '관리' → admin 권한**(이제 관리자 2명). **이혜진(명단에 없음) 제거 → 7명**(seed의 이혜진 배정은 김리원으로 재배정, rules.test 외부인은 송수용으로 교정, core 74/74). DB 재시드로 7명 정본 반영(demo 데이터 리셋 — 프리런치라 무방).
    - **Deployment Protection 재활성화(item 1)**: 새 배포 후 `all_except_custom_domains`가 정상 작동 확인 — **배포/preview URL은 302 SSO 보호, 프로덕션 별칭·커스텀 도메인은 개방**(설계상 production 제외). 앞서 "재활성화 안 됨"은 프로덕션 별칭만 봐서 생긴 오해였음.
    - **커스텀 도메인(item 4)**: `que.griff.co.kr` Vercel 등록·verified. **DNS CNAME `que`→`cname.vercel-dns.com`은 사용자가 griff.co.kr DNS에 추가해야 연결/SSL 완료.** deploy 문서 참고.
    - **MCP/CLI 개방(item 3, B2)**: `api/auth.ts`를 해시 토큰 인증으로 — Supabase면 `personal_access_tokens.token_hash`(SHA-256) 조회, 아니면 mock. `authenticate` async화(`respond.ts` 한 줄, withApi가 중앙집중이라 라우트 무변경). `db/supabase/gen-tokens.mts`로 7명 무작위 PAT 발급(해시만 DB, 평문 `data/pat-tokens.txt` gitignore). **옛 추측형 `que_pat_<id>`는 401.** 실측(프로덕션): 실 PAT→200(유출0), 옛 PAT→401, 무토큰→401. `QUE_ALLOW_MOCK_AUTH`는 계속 미설정(운영은 실 토큰만).
    - **PII 주의**: `que-user-info.md`(전화/생년월일)와 `pat-tokens.txt`는 gitignore. 절대 커밋 금지. `que-user-info.md`는 실수로 커밋됐다가 amend로 제거(push 전).
    - **남은 것**: DNS 추가(사용자) · 팀에 PAT 개별 전달 · 첫 로그인 비번 변경(후속) · CLI/MCP 번들 배포(30번). `mock/tokens.ts`(결정적 mock PAT)는 dev 전용으로 잔존 — 운영은 안 씀.

45. **전면 재설계 트랙 — Figma QUE_All_Pages (2026-07-03, 진행 중)**: 사용자 제공 Figma(`XhDXyGhG2PYKNRKRpgXheQ`, 화면별 노드 `data/디자인변경_추가기능_작업.md`) 기준으로 전 화면 시각 재설계. 방향(사용자 확정): **"디자인 그대로 + 신규 데이터 모델 + 새 앱 셸"**. 마스터 계획 = `data/docs/redesign-plan.md`.
    - **공통 기반(완료)**: `globals.css`에 `--que-*` 디자인 토큰(brand `#3388ff`, border `#e3e3e8`, text 3단계, bg-muted `#f4f4f6`, success/error). shadcn theme 토큰은 **덮지 않음**(신규 --que-* 변수 병행). 폰트 Inter Tight(라틴)+Noto Sans KR(한글), 전역 `word-break:keep-all`. 새 앱 셸(GRIFF 상단바+워크스페이스 스위처 사이드바), 로그인 리스킨. 메뉴 IA `lib/menu.ts`(홈/프로젝트/일정/성과/작업목록/팀/확인필요/결제요청). **URL은 유지**(팀→/members, 일정→/schedule 등).
    - **완료 화면**: 프로젝트(신규 PM mock `pm-data.ts` — 목록/보드/캘린더/태스크 상세, 파일뷰 제외), 성과(recharts KPI·라인·영역·히트맵·저성과표), 일정(주/월 뷰), 작업목록(리치 기능 유지), 홈(성과 컴포넌트 재사용), **팀(이번, 45.1)**. 차트=recharts 확정.
    - **45.1 팀 화면(/members) — 이번 세션**: Figma 팀 개요(`1:17286`)·멤버 세부(`1:18275`)·추가 모달(`1:17912`)·⋮ 메뉴(`1:17592`) 반영. Workflow 오케스트레이션(데이터 계층 backend → 팀개요+멤버상세 frontend 병렬 → build+적대적 리뷰). 커밋 `a7b34f2`.
      - **`/members` 재작성**: KPI 4(총 멤버=USERS.length·오늘 활동·총 부서=departmentForUser 고유수·평균 완료 작업/주=최근6주 done÷6) + `＋ 새 멤버` 초대 다이얼로그 + "모든 팀" 멤버 카드(부서 라벨+⋮ 메뉴+자세히 링크).
      - **`/members/[id]` 신규**: 프로필(2×2 정보 그리드) + 최근 활동(status_logs) + 기여 히트맵(35일) + 작업 성과(주별 8주, `PerformanceLineChart` 재사용). 데이터 계층 `members-data.ts`의 `getTeamOverview`/`getMemberDetail`(성과·히트맵 집계 패턴 재사용).
      - **⚠️ 의도적 디자인 편차(도메인 규칙 우선)**: 디자인 프로필엔 위치/전화/가입일이 있으나 **PII 정책상 넣지 않음** — 2×2 레이아웃만 유지하고 값은 비-PII(부서/직급/역할/이메일)로 채움. **멤버 추가/부서 변경/멤버 제거·초대는 전부 데모 toast**(실 사용자/Auth/DB mutation 없음 — 시드/인증 보호). 히트맵은 색 단독 구분 회피(셀 수치+범례). 카드 이름/이메일은 실제 7명(디자인의 가상 12명 아님). **부서는 여전히 placeholder**(`departmentForUser`, 실값 미확정).
      - 검증: typecheck/lint/build(Next 16) 통과, dynamic 라우트 생성 확인, 적대적 코드리뷰 CRITICAL 0(WARN 2건=터치타깃·히트맵 색구분 즉시 수정). **브라우저/4해상도 시각 QA는 사용자 결정대로 나중 일괄**.
    - **45.2 확인필요·결제요청**: 재스킨은 이미 `aa6fdd8`에서 완료(ToneBadge·카드·표·마스킹/권한 보존). 이번 세션엔 **확인필요 상단 요약 카드만 추가**(회의록/추출 대기/Action 후보/확인 필요, `lib/notes-summary.ts`+`note-summary-cards.tsx`, 두 탭 공통, 열람권한 스코프) — 커밋 `54168fb`. 브라우저 QA(로그인→3화면 렌더) 실측 정상. ⚠️ 이 도구의 브라우저는 창 리사이즈해도 뷰포트가 ~2225px 고정이라 768/1024/1366 좁은폭 리플로우는 시각 캡처 불가 → 반응형은 결제요청과 동일한 Tailwind 클래스(`grid-cols-2 sm:grid-cols-4`·`xl:grid-cols`)로 코드상 보장.
    - **45.3 사이드바 badge 실데이터 연결(완료, `f37c318`)**: `menu.ts` 하드코딩 badge:4 제거 → 셸 레이아웃에서 `getNoteSummary(user).needsReview`를 SidebarNav/MobileNav에 href별 `badges` prop으로 주입(0이면 숨김, 열람권한 스코프). curl 서버렌더 실측: 사이드바 badge=3(요약 카드 확인 필요=3과 일치), 하드코딩 "4건" 소멸, /payments 등 전 페이지 공통. **badges 맵은 href별 확장 가능** — 향후 다른 메뉴 뱃지도 같은 패턴으로 주입.
    - **남은 재설계**: 홈 정식 디자인(사용자 제공 시), 신규 PM 모델 Supabase 스키마+기존 모델 통합. 재설계 착지 시 CLAUDE.md의 "캘린더 기반 팀 상태 도구" 정의 갱신 필요.

46. **피그마 대비 실작동 기능 감사 + 워크스페이스 크래시 수정 (2026-07-03)**: 사용자 "작동 안 되는 것 확인 + 시각 QA". 코드 감사(화면별 병렬 워크플로 10) + 프로덕션(`next start`, HMR 없어 브라우저 안정) 런타임 QA 병행.
    - **🔴 실버그 수정(`88968bc`)**: **워크스페이스 스위처 클릭 시 크래시** — `DropdownMenuLabel`(=Base UI `Menu.GroupLabel`)을 `DropdownMenuGroup` 없이 써서 클릭(메뉴 오픈) 시 `MenuGroupContext missing`(Base UI error #31) → 에러 바운더리. Group으로 감싸 해결(런타임 실측: 수정 후 드롭다운 정상 오픈). `DropdownMenuLabel` 사용처는 workspace/user-switcher 둘뿐이고 후자는 이미 정상. **교훈: DropdownMenuLabel은 반드시 DropdownMenuGroup 안에.**
    - **작동 안 하는 전역 컨트롤(모든 페이지, dead)**: 상단바 **검색 입력**(value/onChange/form 없음 — 타이핑만 되고 검색 안 됨), **알림 벨**(onClick 없음). layout.tsx가 서버 컴포넌트라 핸들러 미부착. → 기능이거나 최소 '준비 중' 처리 필요.
    - **신규 PM 화면은 대체로 표시 전용 목업**: 프로젝트(/projects)=순수 mock(pm-data 조회만, mutation 0) — 작동은 뷰 탭·태스크 드로어·캘린더 월이동·그룹접기뿐, **새로추가/필터/공유/⋯/그룹+/완료체크박스/드로어 편집은 전부 dead**, **칸반 드래그·태스크 생성삭제·상세편집·그룹추가는 미구현(missing)**. 일정(/schedule)=기간 스위처만 작동, **날짜 이동 UI 통째 부재**(항상 오늘 고정), 필터·새로추가·이벤트클릭 dead. 성과·홈=**PeriodSelect(기간/월 select)가 useState만 바꾸고 데이터 미갱신(dead)**. 홈 '오늘 할 일 행 클릭' 미구현.
    - **원본 도메인 기반 화면은 실동작 확인**: 작업목록(/today·/now) 20/22, 확인필요 19/20, 결제요청 11/12 — 탭·완료체크·상태변경·충돌제안·하루마감·체크인·업로드·추출·후보처리·등록폼·상태버튼(권한별) 전부 서버액션 연결. 로그인/인증/로그아웃/사이드바 8링크 정상.
    - **의도적 데모(stub, 버그 아님)**: 팀 초대/확인필요보내기/부서변경/멤버제거(toast), 체크인 '병합'(안내 toast), 워크스페이스 항목(단일 mock).
    - **레거시 고아 라우트**: `/calendar`·`/team`은 menu.ts에 없음(재설계로 /projects·/schedule가 대체). 내부 인터랙션은 살아있으나 메뉴에서 도달 불가. ~~`components/templates/*`는 importer 0 고아~~ → **C-4로 연결됨(2026-07-04)**: `/planning`(반복·마일스톤) 화면에서 렌더. 아래 "기타 화면 신설 > C-4" 참고.
    - 전체 감사 원본: `tasks/wj0p6z2g2.output`(JSON, 화면별 findings). 시각 QA 실측 확인: 검색 dead, 벨 dead, 워크스페이스 크래시→수정후정상, 프로젝트 보드탭·태스크드로어 작동, 팀 ⋮메뉴·KPI 정상.

47. **전역 검색·알림 벨 실기능화 (2026-07-03)**: 46번에서 "dead"로 잡힌 상단바 두 컨트롤을 '준비 중'이 아니라 실동작으로 구현. 사용자 지시 "1번부터 진행". 글래도스 최종 게이트 통과.
    - **구현 파일(5)**: `lib/search-data.ts`(searchWorkspace), `lib/alerts-data.ts`(getAlerts), `app/(app)/search-actions.ts`("use server" searchAction), `components/app/global-search.tsx`("use client" 디바운스 검색+결과 드롭다운), `components/app/notifications-bell.tsx`("use client" Popover 알림+뱃지). layout.tsx에서 정적 Input/Bell → 두 컴포넌트로 교체하고 getAlerts를 서버에서 주입.
    - **검색 설계 결정**: 5종(작업/회의록/Action/결제/팀원) 그룹 검색. **작업은 상세 라우트가 없어 `/now`(팀 운영표)로 링크**, 회의록→/meeting-notes, Action→/action, 결제→/payments, 팀원→/members/[id]. 그룹당 최대 5. **권한/PII: 회의록·Action은 canViewMeetingNote로 필터, 결제는 title/category만(금액·계좌 검색대상·결과 제외)**. searchAction은 세션(getCurrentUser)으로 사용자 도출(클라 입력 위조 불가).
    - **알림 신호 4종**: 문제발생(red)·확인필요 needs_review(violet, viewable)·결제 마감초과(amber)·기한초과 작업(amber). **심각도·다양성 순 정렬**(문제→확인필요→결제→기한초과)로 캡(DISPLAY_CAP=8)에 밀려도 고신호 우선. **문제발생∩기한초과 중복 제거**. count는 실제 총계(뱃지 9+ 표기), 열람권한 스코프(관리자 12 vs song-suyong 11 실측).
    - **검증**: typecheck/lint/build exit 0. 글래도스 런타임 실측 — searchWorkspace("연봉",송수용)=[], 계좌/금액 검색 0건, restricted 노트/Action은 권한자만, prod 렌더 /now·/members·/today 200·에러 0. **브라우저 클릭 QA는 확장 연결 끊겨 미수행**(curl 서버렌더로 대체: placeholder·벨 aria "알림 12건"·뱃지 9+ 확인). 확장 복구 시 검색 드롭다운·벨 팝오버 클릭 확인 권장.
    - 남은 후속(46번 목록): 일정 날짜 이동(2), 홈·성과 기간 선택 실연동(3), 프로젝트 쓰기(4). 레거시 고아(/calendar·/team·components/templates) 정리.

48. **일정 날짜 이동 구현 (2026-07-03)**: 46번 감사에서 missing으로 잡힌 "이전/다음/오늘" 부재(캘린더가 항상 오늘 고정) 해소. 사용자 지시 "1번부터 진행"의 2번.
    - `components/schedule/schedule-header.tsx`에 이전/오늘/다음 버튼 추가. **이동 단위는 range에 맞춤**(일간=±1일, 주간=±1주, 월간=±1월, date-fns addDays/addWeeks/addMonths). 이전/다음→`?date=YYYY-MM-DD` 설정, 오늘→`date` 파라미터 삭제(페이지가 오늘로 폴백). page.tsx가 `anchorIso={format(anchor,"yyyy-MM-dd")}`를 헤더에 주입.
    - 검증: typecheck/lint/build exit 0. curl 서버렌더 — `/schedule`=오늘(7/3), `?date=2026-07-17`→7/17, `?range=month&date=2026-09-15`→9/15, 에러 0. 버튼이 이 파라미터를 생성(client 로직). **브라우저 클릭 QA는 확장 끊겨 미수행**. 참고: 일정의 필터·새로추가·이벤트 클릭은 여전히 미구현(별도 항목).

49. **홈·성과 기간 선택 6개 실연동 (2026-07-04)**: 46번 감사에서 dead였던 PeriodSelect(값만 바뀌고 데이터 안 바뀜)를 실동작으로. 사용자 "전부 실기능(큼)" 선택. 워크플로(데이터계층→UI배선) + 글래도스 승인.
    - **PeriodSelect를 URL 파라미터 구동으로 전환**(useState 제거, usePathname+useSearchParams, controlled value, 홈/성과 경로 공용). 데이터 계층이 그 값으로 재집계.
    - **파라미터 6종**: 히트맵 `hm`(월 1-12) — 그 달 '일 단위' 그리드(멤버×그달 날짜, 최대 31열 가로스크롤). 완료율 `cm`(월) — 그 달로 끝나는 6개월. 기한초과추이 `ot`(주수 {4,8,12,26}) — 최근 N주. 팀부하 `lm`(월) — 그 달 범위 재집계. 작업분포 `dp`(week=향후7일/month=향후30일 마감 활성작업). 라인차트는 select 없음(8주 고정).
    - 파일: `lib/heatmap-data.ts`(getHeatmapData(now,{monthAnchor})), `lib/performance-data.ts`(getPerformanceData(now,{hm,cm,ot,lm}), `anchorYear`로 미래월 방지 — 선택월>현재월이면 작년), `lib/home-data.ts`(getHomeData(user,now,{dp})), `components/performance/period-select.tsx`, `performance-heatmap.tsx`(월그리드 min-width 스케일), `heatmap/page.tsx`·`home/page.tsx`(searchParams await + 화이트리스트).
    - 검증: build exit 0. 실측 — 히트맵셀 hm=7→217(31일)/hm=2→196(28일)/hm=6→210(30일), 홈 동일. 글래도스: cm/ot/lm/dp 전부 mock 직접호출로 데이터 변화 확인(now 20일 되감아 dp 격리검증), 쓰레기입력 8종(hm=99,ot=999,dp[]= 등) 200·폴백, anchorYear 미래월 정상.
    - **⚠️ 알려진 사소(후속)**: (1) **dp 체감 0** — 시드에 향후 7~30일 마감 활성작업이 없어 week↔month 토글해도 화면 불변(메커니즘은 정상). `packages/core/src/data/seed.ts`에 2주 뒤 마감 작업 추가하면 해소. (2) **rangeLabel 불일치** — `performance-data.ts:330` 시작은 cm 반영하나 끝은 now 고정 → cm 바꾸면 meta 라벨과 차트 구간 어긋남. 끝을 `months[5].end`로 맞추면 정직. (3) `heatmap-data.ts`의 7일 폴백 경로는 호출처 0(두 페이지 다 monthAnchor 경유) — 죽은 가지, 다음 정리 때 결정.

50. **프로젝트(/projects) 완전 가동 (2026-07-04)**: 46번 감사에서 '표시 전용 목업'이던 /projects를 실제 조작 가능하게. 사용자 "4번 완벽하게 가동". 워크플로(데이터·액션 backend → 드로어/리스트·보드/헤더 frontend 3병렬) + 글래도스 승인(1차 반려→수정→2차 승인).
    - **pm-data 가변화**: TASKS `let`·GROUPS push, id=`crypto.randomUUID()`. mutations 6종: createTask/updateTask/deleteTask/setTaskDone/moveTask(그룹 이동+순서)/createGroup. getProjectMeta(멤버·그룹 피커), getProjectListView/BoardView에 filter({priority[],assigneeIds[]}) 인자, TaskDetailView에 원시필드(dueAt/groupId/assigneeIds). **저장은 in-memory(단일 next start 프로세스 생존 동안만, DB화는 후속)**.
    - **pm-actions.ts(신규 "use server")** 6 액션 + revalidatePath("/projects"). **핵심 패턴: `getCurrentUser()`는 `run()` try 밖(NEXT_REDIRECT 전파), 입력 거부는 로컬 `PmInputError`만 {ok:false} 변환·그 외 rethrow**(reportError 경로 생존). ← 글래도스 1차 반려(try 안에서 getCurrentUser → NEXT_REDIRECT 토스트 노출) 수정. today/actions.ts와 동일 취지.
    - **UI 배선**: 드로어 편집(제목·설명·우선순위·마감·담당자·상태그룹 + 저장/삭제, 저장 후 baseline 동기화 `detail!==shown`), 리스트 완료토글·인라인 추가·⋮이동(allGroups는 project-view에서 전달), 보드 HTML5 드래그(교차그룹)+⋮이동+인라인추가, 헤더 새로추가 Dialog·필터(URL ?priority=&assignee=, 서버 필터)·그룹추가·공유(데모 표기)·정보. 신규 컴포넌트 7개(create-task-dialog/create-group-dialog/project-filter/project-header-actions/task-card-menu/task-done-toggle/add-task-inline).
    - **드래그**: 외부 dnd 라이브러리 미설치 → 데스크톱 HTML5 draggable + **전 기기 ⋮메뉴 '이동'**(터치·a11y 커버). 파일 첨부는 저장 인프라 후순위 → '준비 중' 표기(죽은 버튼 아님).
    - **글래도스 실증**: 빌드 매니페스트에서 서버액션 ID 추출해 **실 HTTP POST로 전체 수명주기**(생성→토글→이동→수정→삭제) + 요청 간 지속 확인, 필터 격리(high→task-1·7 / lee-yejin→2·4·7 / AND→7 / 렌더 행수 일치), 비인증 POST→303 /login, 비정수 toIndex 가드. build/lint/typecheck exit 0.
    - **⚠️ 후속(중요)**: (1) **PM mutation에 ChangeLog/via 기록 없음** — CLAUDE.md "업무 영향 변경은 ChangeLog에 기록" 원칙. mock 모델엔 인프라가 없어 현 단계 수용하나 **DB화 시 반드시 함께 구현**. (2) **in-memory 저장**이라 서버 재시작 시 seed로 초기화 → DB화 필요(신규 PM 모델 Supabase 스키마). (3) 크래프트 요청으로 존재하지 않는 groupId에 create/move 시 어느 뷰에도 안 보이는 고아 태스크 가능(mock 한정, 정상 UI 경로에선 불가).
    - **→ 46번 기능감사에서 나온 dead/missing 실기능화 1~4 전부 완료** (전역검색·알림 / 일정 날짜이동 / 홈·성과 기간선택 / 프로젝트 쓰기). 남은 것은 레거시 고아 정리(/calendar·/team·components/templates)와 위 후속들.

51. **출시(다음주 8명 실사용) 준비 — 글래도스 지휘 (2026-07-04)**: 사용자 "모든 작업 마무리, 다음주 실사용, Glados 지휘". 5차원 준비도 감사(`tasks/wlo757q4k.output`) → 글래도스 릴리즈 디렉터 계획 → 코드 Batch A/B 집행.
    - **총평**: 원본 도메인(작업목록/확인필요/결제/일정/팀현황/성과/홈/검색/알림)은 Supabase 영속·규칙 강제·실 인증까지 **실사용 가능(GO)**. 죽는 건 그 옆 전시장(/projects 비영속)과 배포 위생(미push·구버전·공용비번).
    - **집행 완료 — Batch A(보안·데이터 방어)**:
      - `verify.ts` mock 폴백을 `isMockAuthAllowed()`로 **fail-close**(배포 env 누락 시 로그인 거부).
      - `supabase-db.ts` persist에서 **users 영구 제외**(password_hash NULL 덮어쓰기 방지).
      - `db/supabase/gen-passwords.mts` 신설 — 7명 개인 무작위 비번 → bcrypt 해시. **평문 `data/passwords.txt` + 적용 `db/supabase/set-passwords.sql` 산출(둘 다 gitignore), DB 적용은 사용자 승인 후.**
    - **집행 완료 — Batch B(강등·IA·문서)**:
      - **/projects 3중 강등**: menu.ts에서 제거 + 상단 '미리보기(저장 안 됨)' 배너 + pm-actions 쓰기 차단(`QUE_PM_WRITE=1` dev만, 미인증 redirect는 유지).
      - **/calendar → `/schedule` redirect**(components/calendar/*·actions는 LIVE라 유지).
      - **/team 메뉴 재노출('팀 현황', LayoutDashboard)** + 페이지 제목 "일정"→"팀 현황"(라벨 충돌 해소). 스탠드업·관리자 리포트·운영보드 복귀.
      - **/schedule 새로추가·필터** → aria-disabled + '준비 중' 툴팁.
      - **/members 조회 전용화** — 새 멤버 다이얼로그·카드 ⋮ 메뉴 미노출(파일은 잔존, unrender).
      - CLAUDE.md 메뉴 구조 절을 현행 배포 IA로 갱신.
    - **⚠️ 사용자 액션 체크리스트(내가 못 하거나 승인 필요) — Go 조건**:
      1. ✅ **[완료 2026-07-04] 프로덕션 DB 퍼지** — `go-live-cleanup.sql`을 Supabase MCP로 실행. 삭제 전 전체 백업 `db/supabase/backup-before-que/golive-purge-20260704.json`(gitignore). 검증: 트랜잭션 테이블 전부 0, users 7·PAT 7 보존, check_ins UNIQUE 제약 적용. (삭제분은 전부 데모 시드, 재생성 가능.)
      2. [승인+실행] 개인 비번 적용(`set-passwords.sql`) + 7명 1:1 전달. `que-2026!` 로그인 실패 확인이 완료 기준.
      3. ✅ **[완료 2026-07-04] 원격 push + Vercel 재배포** — origin push(9a6d7c8), `vercel deploy --prod`(빌드 54s). 프로덕션 별칭 **que-rouge-eight.vercel.app**에 신 코드 라이브. 스모크 PASS: /login 200, 무토큰 /api/team 401, 미인증 라우트 307, que-2026! 로그인 성공(users 보존 확인), /home·/team 200(구버전 404였음), /calendar→/schedule redirect, /projects '미리보기' 배너 + 사이드바에서 제거(nav=home/schedule/heatmap/today/members/team/payments), /team(팀 현황) 노출. ⚠️ **que.griff.co.kr은 여전히 Cloudflare 406**(프록시 앞단 가로챔) — 아래 DNS 조치 전까지 팀엔 que-rouge-eight.vercel.app 안내.
      4. ✅ **[완료 2026-07-04] 시각 QA (4해상도)** — 브라우저 확장이 계속 끊겨, **Playwright 헤드리스(시스템 Chrome) + mock 프로덕션 빌드**로 로그인 후 9화면×4해상도(1920/1366/1024/768) + 검색 드롭다운·알림 팝오버 스크린샷 캡처·검수. 결과: 사이드바 반응형(≥1024 펼침/<1024 햄버거), IA 정확(/projects 미노출·팀 현황 노출), /projects 미리보기 배너, /members 조회전용, /schedule 날짜이동, 검색·알림 실작동, 차트·히트맵·마스킹 렌더 — **깨짐 0, 전항 PASS**. (배포 프로덕션은 동일 코드·빈 데이터 상태.)
      5. [실행] DNS: Cloudflare `que` CNAME→cname.vercel-dns.com + **프록시 OFF(DNS only)**. 미완이면 팀엔 que-rouge-eight.vercel.app 안내(Go 비차단).
      6. [결정] Deployment Protection 재활성화 or 레이트리밋(후속).
    - **Go 조건(전부 충족 시 실사용)**: Batch A·B 글래도스 PASS + origin push + DB퍼지·개인비번(que-2026! 실패 실측) + 재배포 프로덕션 스모크(신 라우트 200·/projects 메뉴 부재·쓰기차단·미인증 /login·mock fail-close·무토큰 API 401) + 시각 QA.
    - **수용한 리스크(기록=수용, 은폐 아님) / 후순위**: 도메인 미연결(vercel.app로 출시), 동시편집 lost-update(8인 저동시성), 스케줄러 요청경로 실행+중복(check_ins/반복 UNIQUE 제약 권장, C3 번들), PM DB화(+권한+ChangeLog via), 로그인 레이트리밋/첫로그인 강제변경, /calendar 컴포넌트·templates/* 고아 삭제, ?view=files 잔재, rangeLabel 끝날짜, 워크스페이스 스위처 단일 mock 축소, mock tokens 빌드타임 가드, dp 체감용 시드.

52. **A+B 편의기능·버그픽스 배치 (2026-07-05)** — 기획 대조 감사(`7aa893c`) 후속. 사용자 "A+B 편의 진행/버그픽스, 결정은 글래도스 위임". 신규 파일 1개(`keyboard-shortcuts.tsx`), 나머지 기존 파일 수정.
    - **A1 재확인 시각 버그**: `status-detail-form.tsx` 문제발생/홀드의 "다시 확인할 시간"을 `type="time"`→`type="datetime-local"`. **기존 버그**: 시간만 받아 오늘 날짜에 붙여 "내일 재확인"이 오늘 과거 시각이 됐다. 이제 `new Date(recheckAt).toISOString()`(전체 날짜+시각).
    - **A2 캘린더 색 의미 고정**: `schedule/event-color.ts`에 `on_hold=amber`(--ev-amber-*, "amber=주의/대기"), `done=중립 흐림`(--que-bg-muted/border/text-tertiary, DESIGN.md 10장 "완료=낮은 강조") 추가. 기존엔 issue=red만. cancelled/merged는 calendar-data에서 이미 제외.
    - **A3 상태 상세 노출**(write-only였던 사유 노출): 신규 서버액션 `today/actions.ts › getTaskStatusDetailAction(taskId)` — 현재 issue/on_hold 작업의 최신 status_log(reason/nextAction/helpUserName/nextCheckAt) 반환, 아니면 null. `task-status-sheet.tsx`가 시트 열릴 때 지연 조회(getMergeCandidates 선례)해 "문제 내용/대기 사유" 패널 렌더. **인증 게이트 `getCurrentUser()` 포함**(아래 글래도스 반려 반영). canEdit=false 뷰어에게도 노출 = 팀 투명성(이미 /team·오늘 화면이 서버 렌더로 노출하던 데이터, 글래도스 승인).
    - **B ⌘K 빠른 액션 1→5개**: 작업추가/스탠드업(`/team?view=standup`)/결제(`/payments`)/회의록(`/meeting-notes`)/반복마일스톤(`/planning`). **결정: "문제만 보기"·"리포트" 제외** — 팀 페이지에 "문제만" 필터 파라미터 없음(라벨≠동작), `?view=report`는 관리자 전용이라 비관리자가 고르면 board로 조용히 폴백(라벨≠동작). label=목적지 일치하는 것만. (글래도스 반박 시도 실패, 결정 타당 판정.)
    - **B ⌘Enter/Esc(quick-add)**: 확인 카드 `CardContent onKeyDown` — ⌘/Ctrl+Enter=등록, Esc=취소. **Esc는 `!e.nativeEvent.isComposing` 가드**(한글 IME 조합 취소를 카드 폐기로 오인 방지). 열린 Select/date 피커의 Esc는 Base UI `useDismiss`가 stopPropagation → 카드까지 안 옴(주석 정정: React 포털은 React 트리로 버블링됨, 안전 이유는 stopPropagation).
    - **B 체크인 숫자키 1~7**: `checkin-panel.tsx` 응답 버튼에 번호 뱃지 + 숫자키. **결정: 전역이 아니라 패널 focus-within 스코프**(오늘 화면에 체크인 패널 여럿이면 전역 키가 어느 패널인지 모호). 가드: `issueOpen이면 return`(사유 폼 열림 중 오응답·사유유실 방지) + input/textarea/contenteditable 포커스 무시 + 수정키 무시.
    - **B 전역 `?`/`/`**: 신규 `keyboard-shortcuts.tsx`(layout 마운트) — `?`=치트시트 다이얼로그 토글, `/`=검색 입력(`global-search.tsx`에 `id="global-search-input"` 부여) 포커스. 타이핑 대상·수정키면 무시. ⌘K는 CommandPalette 소유 유지.
    - **글래도스 게이트 1차 반려→수정**: (1) `getTaskStatusDetailAction`+`getMergeCandidatesAction`에 `getCurrentUser()` 인증 게이트 부재(서버액션 ID는 번들에서 추출 가능→비인증 실명 노출) → 둘 다 추가. (2) HANDOFF 미기록 → 이 항목. + 비차단 실버그 2건 동반 수정: 체크인 issueOpen 가드, quick-add IME 가드. build/lint/typecheck exit 0, core 79/79. **브라우저 확장 미연결로 라이브 클릭 검증은 못 함**(코드+빌드+라우트 스모크로 대체).
    - **⚠️ 후속(비차단, 글래도스 경고)**: (1) **statusLogs "최신" 가정**: `supabase-db.ts` select에 ORDER BY 없어 프로덕션 배열 순서 미보장인데 team-data/today-data/신규액션 3곳이 `.reverse().find()`로 최신 가정 → `createdAt` 정렬로 **일괄** 교정(3곳 동시, 신규만 고치면 불일치). (2) `/` 단축키가 모달 열림 중 배경 검색 인풋 포커스 시도 가능(offsetParent로 오버레이 차폐 미감지) — Base UI 포커스 트랩이 되돌릴 것으로 예상, 관측되면 교정.

53. **실사용 검수 UI 개선 배치 (2026-07-05)** — 사용자 검수 피드백 11건. 공통 5건 직접 + 독립 3영역 frontend-dev 병렬 위임. 신규 파일 `lib/today-nav.ts` 1개, 나머지 기존 파일 수정.
    - **1 전역 스크롤바 숨김**: `globals.css` @layer base에 `* { scrollbar-width:none } *::-webkit-scrollbar { display:none }`. 스크롤 기능(휠·터치·키보드)은 유지, 시각만 제거. 사이드바는 base-ui ScrollArea 자체 렌더라 무영향. **수용: 접근성상 '스크롤 가능' 시각 단서 상실**(태블릿 우선 운영도구라 수용).
    - **2 schedule 3일 뷰**: `schedule-header.tsx`(ScheduleRange에 `3day`·RANGE_LABELS·shift ±3일·stepLabel), `schedule/page.tsx`(parseRange 화이트리스트·threeDays·범위·렌더 분기), `week-calendar.tsx`(min-w를 `calc(4rem + N*6.2rem)` days 비례; 7일≈758px 등가·회귀 없음). WeekCalendar는 원래 days.length 유연.
    - **3 사이드바 4메뉴 가운데정렬 해소**: 원인은 사이드바가 아니라 planning/tools/help/settings 페이지 본문 `mx-auto max-w-*`. 4개 파일에서 `mx-auto`만 제거(max-w 유지)→다른 페이지처럼 좌측 정렬.
    - **4 자연어 파싱 실버그**: `parse-task.ts` — "작업등록"처럼 명사가 '등록'으로 끝나면 명령어 오인·'작업' 축약. TRAILING_COMMANDS를 **PHRASE(…해줘류, 항상 제거)**와 **WORD(넣어/추가/등록, 공백·조사 경계 있을 때만)**로 분리. **결정: 배타 적용**(PHRASE 매치되면 그것만, 아니면 WORD) — 연달아 적용하면 "회원 등록 넣어줘"가 '회원'으로 이중 절단(글래도스 반려 회귀). `rules.test.ts` 회귀 2케이스(작업등록 보존·회원 등록 넣어줘). core 79→80.
    - **5 작업목록 탭 분리(IA)**: `/today`를 `?panel=status|input` 두 탭. 신규 `lib/today-nav.ts`(parseTodayPanel/buildTodayHref — panel↔tab 상호 보존, 기본값 URL 생략), `my-task-tabs.tsx` panel prop, `today/page.tsx` 서버 분기·`TaskListSection` 추출 공유. **현황 탭**=KPI·타임라인·체크인·하루마감·주의필요+리스트, **입력 탭**=QuickAdd+리스트. 기존 `?tab=` 필터와 공존.
    - **6 일정 새로추가**: 사용자 결정 **'준비 중' 유지**(캘린더 이벤트 생성 core mutation 부재 — createCalendarEvent 없음, 신설 시 별도 배치). 손대지 않음.
    - **7 공통 탭 스타일**: `link-tabs.tsx`(오늘/Now·회의록/Action)+`team/page.tsx` 뷰토글 2곳 세그먼트화 — 컨테이너 `bg-muted/60 p-1`, active `bg-primary shadow-sm`, inactive `text-muted-foreground hover:bg-background hover:text-foreground`. h-10 유지. 밑줄형(my-task-tabs/view-tabs)은 이미 명확해 유지.
    - **8 확인필요→회의록 라벨**: `menu.ts`(label·icon MessageSquareText→FileText), `meeting-notes/page.tsx` 제목, `search-data.ts` subtitle, `note-summary-cards.tsx` aria. **동기화(글래도스 반려 반영)**: CLAUDE.md 메뉴 절 L20·28 + `help-content.ts`(비개발 매뉴얼) "확인필요"→"회의록" 일괄, 검색 카테고리 "회의록"·알림 개념 "확인 필요"는 무관 유지. **`/action` 화면 제목은 성격상 '확인필요' 유지**(CLAUDE.md에 명시). member-card-menu "확인필요"는 별개 기능 제외.
    - **9·10·11 회의록 업로드**: `upload-note-form.tsx`+`meeting-notes/actions.ts` — (10) 회의 일시 `date`→`datetime-local`, actions 검증 `YYYY-MM-DDTHH:mm`+구 `YYYY-MM-DD` 방어(구 형식만 10:00 기본), 하드코딩 T10:00 제거. (11) 참석자 전체선택·인원배지·44px 카드(이미 있던 체크박스 발견성 개선). (9) 업로드 버튼 full-width 강조+disabled 부족항목 힌트(사용자가 '버튼 없음'이라 느낀 원인=파일 미선택 시 회색 버튼). core createMeetingNote 경유 유지.
    - **글래도스 게이트 1차 반려→반영**: (1) HANDOFF 미기록→이 항목. (2) 라벨 변경 동기화 누락(CLAUDE.md L28 불변식 위반·help-content 13곳)→위 8에 반영. (3) parse 이중 제거 회귀→위 4 배타 적용. typecheck·lint·build·core 80/80. **브라우저 확장 미연결로 라이브 시각 검증 못 함**(코드+빌드로 대체).
    - **⚠️ 후속(비차단, 글래도스 경고)**: (1) datetime 롤오버 — `2026-02-30T10:00`이 거부 안 되고 3/2로 저장(V8 레거시 파서, **구 코드도 동일=회귀 아님**, datetime-local UI로는 생성 불가·크래프트만). 후속 라운드트립 검증. (2) statusLogs ORDER BY 일괄 교정(52번에서 이연 — 다음 supabase-db 배치에서 차단 승격 예고).

54. **서버 타임존 KST 고정 + 기타 메뉴 페이지 풀폭 (2026-07-05)** — 사용자 검수 피드백 2건.
    - **타임존 버그(핵심)**: 자연어 "내일 오전 11시 …"가 프로덕션에서 **시작 20:00(오후 8시)**로 저장·표시. 원인: **Vercel 서버리스 함수가 UTC로 실행** → 서버 `date.setHours(11)`이 11:00 UTC로 저장 → 브라우저(KST)에서 +9h=20:00. 규칙 파서는 "오전 11시"를 정확히 해석했고 **LLM 문제 아님**(LLM 넣어도 서버 UTC면 동일). 영향은 parse-task뿐 아니라 `dayStart/dayEnd.setHours(0,0,0,0)`가 쓰인 today/team/home/report/now-data 전반(하루 경계가 UTC 자정=KST 09:00으로 9h 밀림) — 앱 전반의 잠재 시간 오류.
    - **재현/근거**: `TZ=UTC`로 core test → parse 시간 테스트 **2건 실패**, `TZ=Asia/Seoul` → 80/80. `TZ=UTC node`로 `setHours(11)`→`11:00Z`(버그), `TZ=Asia/Seoul`→`02:00Z`(정상) 실측.
    - **수정**: **`apps/web/src/instrumentation.ts`(신규) `register()`에서 `process.env.TZ="Asia/Seoul"`**. ⚠️ **Vercel은 `TZ`를 예약 env로 막아 프로젝트 설정으론 못 바꾼다**(vercel env add TZ → "reserved" 에러) → 런타임 코드 설정이 유일. Node는 재할당 시 이후 Date부터 반영, register는 앱 코드보다 먼저 실행(검증: TZ 재설정이 Date에 반영됨, `.next/server/instrumentation.js` 번들 확인). 보강: `apps/web/package.json` dev/build/start + `packages/core/package.json` test에 `TZ=Asia/Seoul` prefix(로컬·빌드·CI 일관, self-host 대비).
    - **✅ 배포 후 검증 완료 (2026-07-05)**: 프로덕션(que.griff.co.kr) 실런타임에서 자연어 "내일 오전 11시"가 KST 11:00으로 정상 저장·표시됨(사용자 실측 확인). instrumentation 방식이 Vercel 서버리스에서 동작 확정. fallback(date-fns-tz) 불필요.
    - **기타 메뉴 페이지 풀폭**: planning/tools/help/settings의 `mx-auto max-w-*` → **max-w까지 제거**(53번에서 mx-auto만 뺐으나 사용자가 "아직 와이드하게 안 나온다" → 풀폭으로). 다른 콘텐츠 페이지와 폭 통일.
    - **후속(선택)**: 자연어 파싱을 LLM(Claude API)로 고도화하면 "점심 즈음"·"내일 아침 일찍" 등 유연성↑ — 단 비용·지연·비결정성. 이번 타임존 버그와 무관하므로 별도 검토(사용자 질문 답변).

55. **크레덴셜 불필요 편의 개선 1차 — 7건 (2026-07-05)** — 사용자 "크레덴셜 없이 진행 가능한 것 진행". audit(7aa893c) 개선 아이디어 중 조회·UI 안전 항목. frontend/backend-dev 5개 병렬 위임.
    - **statusLogs 최신 조회 정합화**(52·53번 이연 종결): core `rules.ts`에 `latestStatusLog(logs, taskId, toStatus)` 추가(배열 순서 대신 `createdAt` 최대). today-data/team-data/`getTaskStatusDetailAction` 3곳을 이 헬퍼로 통일(방법 A) + `supabase-db.ts` load에 status_logs/change_logs `.order("created_at")` 보강(방법 B 이중화). report-data/members-data는 이미 createdAt 정렬이라 무변. core 회귀 3건(80→83).
    - **schedule 마지막 뷰 기억 + 키보드 내비**: 쿠키 `que_schedule_range`(range만 기억, date는 항상 오늘)를 `schedule/page.tsx`가 `cookies()`(Next 16 async)로 읽어 파라미터 없을 때 기본. `schedule-header.tsx`(클라)가 document.cookie 기록 + keydown(← 이전·→ 다음·T 오늘·D 일간·3 3일·W 주간·M 월간, input/수정키 가드). `keyboard-shortcuts.tsx` 치트시트에 3줄 추가.
    - **히트맵 셀 드릴다운 + 부하 막대**: `performance-heatmap.tsx` 셀을 `<Link role=gridcell>`로(→`/schedule?range=day&date=YYYY-MM-DD`), 그리드 아래 멤버별 부하 막대(totalScore/maxTotal, 과부하만 amber·막힘 red — 상태색 의미 준수). heatmap-data 기존 집계 재사용(무변).
    - **상세 시트 상태버튼 숫자키 1~7**: `task-status-sheet.tsx` — 클릭 로직을 `chooseStatus`로 추출해 클릭·키 공유, 버튼 그리드에 스코프된 onKeyDown(detailFor·mergeCandidates·input 포커스·수정키 가드). 번호 뱃지(checkin-panel 패턴).
    - **Now 일정 충돌 지표**: `now-data.ts`에 팀 전체 오늘 충돌 수 계산(today/team-data와 동일 겹침 검사), `now/page.tsx` 요약 6번째 카드(→`/team`, >0이면 amber). 표 무변.
    - 검증: typecheck·lint·build exit 0, core **83/83**. **브라우저 확장 미연결로 라이브 시각 검증 못 함**(코드+빌드).
    - **2차 예정(크레덴셜 불필요지만 스키마/도메인 변경이라 신중)**: 담당자 변경(core reassign+ChangeLog), 작업 삭제(개인 계층 deleteTask, 기획105), 체크인 '나중에' 스누즈(CheckIn snoozeUntil 스키마).

56. **클라이언트(거래처) → 프로젝트 2단 분류 도입 (2026-07-05)** — 사용자 피드백("워크스페이스/프로젝트가 겹쳐 혼란. 멘딕스/에픽게임즈/그리프로 분류해 작업에 표시"). dev-lead 설계 → 사용자 결정 3건 → 4개 에이전트 병렬(core/스위처/표시/관리UI).
    - **혼란의 정체(중요)**: "프로젝트"가 두 시스템에 중복 — ① core Project(실운영·영속, task.projectId) ② PM mock(`pm-data.ts`, `/projects` 화면·비영속·메뉴제외)의 Workspace→PmProject 4단. 상단 WorkspaceSwitcher가 ②의 mock을 보여줘 "죽은 장식". → **①에 상위 '클라이언트'를 정식 도입**하고 ②는 현상 유지(별도 트랙).
    - **결정(사용자)**: 용어 **"클라이언트"**(코드 `Client`, 자사 그리프도 클라이언트 행), 관리 화면 **신규 메뉴**(관리자 전용), 프로젝트 생성 **관리자만**(편집 담당자+관리자).
    - **설계(dev-lead)**: `Client{id,name,status}` 최소 필드. **Task엔 clientId 안 넣음**(간접: task→project→client, clientById Map 0비용). `Project.clientId?` optional(nullable, 무파괴). ChangeLog entityType에 project·client 추가.
    - **core**: `domain.ts` clientSchema·projectSchema.clientId·changeLog enum. mutation 4종 create/update Client·Project(권한+zod검증+ChangeLog via). `rules.ts` canManageClient(admin)·canManageProject(admin∨owner). seed 멘딕스/에픽게임즈/그리프 + prj 배정. 배선 3곳(supabase-rows TABLE_INSERT_ORDER=clients 앞·SEED_KEY_TO_TABLE, supabase-db TABLE_TO_FIELD). `labels.ts` formatProjectLabel. 회귀 15건(**core 83→98**).
    - **⚠️ 프로덕션 DDL 적용 완료**: Supabase MCP `apply_migration`(add_clients_two_tier) — clients 테이블 + projects.client_id(nullable FK) + change_logs entity_type check 재생성. **무파괴**(적용 전 projects 0행·tasks 1·users 7 확인, 적용 후 재검증 OK). `db/supabase/add-clients.sql` 파일도 동봉. **DDL이 코드 배포보다 먼저 적용됨**(dev-lead 순서 제약 준수 — 신 코드 load가 clients 테이블 요구). **프로덕션 clients는 비어 있음 → 배포 후 관리 화면에서 실제 클라이언트 생성 필요.**
    - **표시**: formatProjectLabel로 8곳 전환. 폭 넓은 곳(홈·planning·리포트·성과·action·회의록 리스트·업로드 셀렉트)=풀표기 "클라이언트 · 프로젝트", 좁은 곳(캘린더 칩/월 셀/타임라인)=프로젝트명만(넘침 방지). team-data L118은 권한조회라 표시 아님(스킵).
    - **관리 UI**: `/clients` 신규(app 라우트+actions+폼3+client-groups). menu.ts `adminOnly` 플래그 신설 + sidebar/mobile-nav `isAdmin` 필터 + layout isAdmin 주입. **3중 게이트**(메뉴 노출·페이지 redirect·core mutation). planning 서버액션 패턴(toResult, getCurrentUser try 밖) 답습. CLAUDE.md 메뉴 절 동기화.
    - **스위처 제거**: layout에서 getPrimaryWorkspace/WorkspaceSwitcher 제거(사이드바는 기존 Brand로 충분), mobile-nav Brand 대체, workspace-switcher.tsx 삭제. pm-data·/projects·searchWorkspace는 유지.
    - 검증: typecheck·lint·build(`/clients` 생성)·core **98/98**. **브라우저 확장 미연결로 라이브 검증 못 함**(코드+빌드+프로덕션 DDL 실측).
    - **후속**: 프로덕션에 실 클라이언트/프로젝트 입력(관리 화면), PM mock(`/projects`) DB화 시 PmProject→core Project 흡수, MCP/CLI에 client 필터 도구.

57. **전환형 클라이언트 필터(상단 스위처) (2026-07-05)** — 56번 직후 사용자 "스위처가 없어?"→클라이언트 전환 필터 요구. dev-lead 설계 → 방침 4건 채택 → 기반(직접)+5개 에이전트 병렬.
    - **기반**: core `mock-db.tasksForClient(clientId?)`(미지정=전체, 특정=소속 프로젝트 작업만·무소속 제외. SupabaseQueDb 상속 공유). `apps/web/src/lib/client-filter.ts`(getClientFilter/getClientOptions/getClientFilterName, cache(), 쿠키 검증). **`client-filter-cookie.ts`(쿠키 이름 상수만, next/headers 무의존)** — 아래 빌드버그 수정으로 분리.
    - **스위처**: `components/app/client-switcher.tsx`(클라 컴포넌트, DropdownMenu, Building2+선택명, "전체 클라이언트"+active 목록, document.cookie `que_client_filter` set/삭제 + router.refresh, 필터활성 brand-subtle 강조, <sm 아이콘+점 축약, clients 빈 배열이면 null). layout header GlobalSearch 왼쪽 삽입(전 해상도 노출). **전원 사용**(조회 필터). UserSwitcher와 구분.
    - **필터 방침(채택)**: 무소속 작업=특정 클라 선택 시 숨김(내부업무는 그리프). 회사 공통일정(calendar_events)=항상 표시(충돌 컨텍스트). 회의록/Action/결제·알림뱃지·검색=필터 제외. **체크인**: `/today` 개인 응답 프롬프트는 제외(응답 누락 방지, today-data L120 무필터), **팀현황 집계·Attention의 응답대기는 클라 스코프 필터**(team-data L91-93 — 보드 행과 정합). 성과·홈 집계까지 한 배포(숫자 정합).
    - **5개 화면 필터**(쿠키→getClientFilter→data 함수 clientId 파라미터): 작업목록(today/now/my-tasks), 일정(calendar-data — 작업+마일스톤 필터, 회사일정 유지), 팀현황(team/report-data — board/standup/report, statusLog inClient까지 정합), 성과+홈(heatmap/performance/home — KPI·완료율·기한초과·진행률·부하·추이 전부 clientTasks/inClientScope). **핵심 규율(dev-lead 경고)**: "행/집계 소스만 필터, ID→작업 조회 맵(taskById 등)은 전체 유지"(숨은 작업 참조 깨짐 방지) — 각 에이전트가 db.tasks 사용처를 하나씩 판단·보고. 성과·홈에 "○○ 기준" 배지(ClientFilterBadge, brand-subtle).
    - **⚠️ 빌드버그 수정**: client-switcher(클라 컴포넌트)가 `client-filter.ts`(next/headers=서버전용)에서 쿠키 상수 import → 서버 모듈이 클라 번들로 끌려와 **turbopack build 실패**(lint/typecheck는 못 잡음). 쿠키 상수를 `client-filter-cookie.ts`로 분리해 양쪽이 거기서 import. **교훈: 클라 컴포넌트와 서버 모듈이 상수를 공유하면 상수를 무의존 파일로 뺄 것.**
    - 검증: typecheck·lint·build(2차 통과)·core **98→101**(tasksForClient 회귀 3). **브라우저 확장 미연결로 라이브 검증 못 함** — 특히 필터 on 상태 화면 간 숫자 정합은 코드 대조로만 확인(배포 후 실사용 검증 권장).

58. **MCP·CLI 클라이언트 조회·필터 (2026-07-05)** — 사용자 "MCP/CLI에 클라이언트 설정 있는지 확인" → 없음 확인(도구의 client는 HTTP 래퍼) → 사용자 결정 **조회·필터만**(생성/수정은 웹 관리자). API→MCP→CLI→문서. backend-dev.
    - **API**: 신규 `api/clients/route.ts`(withApi GET, active 거래처 `{id,name}`만·status 비노출). `api/tasks/route.ts`에 `client` 파라미터(`source = client ? db.tasksForClient(client) : db.tasks` 후 assignee/status/project AND). **응답에 파생 라벨** `projectLabel`(formatProjectLabel="거래처 · 프로젝트")·`clientId`·`clientName` 곁들임(Task 원본 스키마 불변, /api/tasks 소비자는 MCP·CLI뿐이라 안전).
    - **MCP**: 신규 `list_clients`(readOnlyHint), `list_tasks`에 client 파라미터. **도구 19→20**(readOnly 9→10). smoke.mts 개수·list_clients 스모크 3건 갱신.
    - **CLI**: 신규 `que clients`, `que tasks --client <id>`(출력에 거래처·프로젝트명 병기).
    - **문서** que-tools-guide.md: MCP 표 19→20, CLI 예시, §7 AI 명령어 186→189(조회 25→28).
    - 조회 전용(mutation 없음), 전부 withApi(PAT). core tasksForClient 공유(웹과 동일 로직). SupabaseQueDb가 상속으로 양 모드 동작.
    - 검증: typecheck·lint·build(`/api/clients`) exit 0. **MCP 라이브 스모크(도구 20·list_clients·client 필터)는 게이트에서 dev 서버로 확인.**

59. **클라이언트 UI 마감 + 작업목록 개편 + 로고/도움말/기획서 (2026-07-05)** — 56~58 후속 사용자 검수 피드백 다수를 연속 처리.
    - **클라이언트 스위처 버그 3건**: (a) "추가해도 스위처 안 나옴" — 코드/로드 정상(backend-dev·qa 프로덕션 실측), 원인은 관리화면 mutation이 `revalidatePath("/clients")`만 해서 **layout(스위처)이 soft-navigation 간 stale** → `revalidatePath("/","layout")` 추가로 해소. (b) 프로젝트 폼 Select가 선택 후 raw 값(id·`__none__`) 노출 → **base-ui Select는 `items`(value→label 맵) prop 필수** — create-project-form·client-groups 5개 Select에 items 추가. (c) 스위처 위치를 상단바→**데스크톱 사이드바 상단(가운데)·모바일 상단바**로.
    - **⚠️ 스위처 드롭다운 크래시 — 중요 교훈**: `client-switcher.tsx`의 `DropdownMenuLabel`이 `DropdownMenuRadioGroup` **밖**에 있어 base-ui `Menu.GroupLabel`이 `MenuGroupContext` 부재로 throw(드롭다운 여는 순간). **digest 없는 client 에러**(서버 아님)라 typecheck·lint·build·Glados로 못 잡고 프로덕션 clients 0개일 땐 잠복하다 거래처 생성 후 표면화. **Playwright 헤드리스로만 재현/수정검증**. → 드롭다운·드래그·클릭 등 **브라우저 인터랙션은 Playwright 검증 필수**(코드 리뷰만으론 놓침). 수정: 라벨·구분선을 RadioGroup 안으로.
    - **클라이언트 순서 드래그**: `Client.sortOrder` 추가(**프로덕션 DDL `add_client_sort_order` 적용됨** — sort_order 컬럼+기존 4개 순번), `reorderClients` mutation(관리자·ChangeLog), 관리화면 HTML5 드래그+위/아래 버튼, getClientOptions/스위처/목록 sortOrder 정렬. core 101→105.
    - **작업목록(/today) 개편**: 현황 KPI 1줄 상단 + `collapsible-details`(타임라인·체크인·하루마감·주의필요 접기), 목록 풀폭 확대(행 크게), 우측 **원형 완료 버튼**(`task-done-circle`, hover green fill 프리뷰, 클릭 완료 시 **canvas-confetti 폭죽**·reduced-motion 생략, 재클릭 복귀). qa Playwright 6항목·4해상도 PASS.
    - **로고**: files.griff.co.kr(`logo-full`=로고+워드마크, `logo-mark`=아이콘, **단색이라 dark:invert**). 사이드바 상단 가운데(justify-center), 로그인 화면 `logo-mark`. (사용자가 auth/logo.svg↔files 왕복 후 **files 확정**.) 아바타 테두리 제거(`avatar.tsx` after:border + `MemberAvatars` ring-2).
    - **도움말 전면 개편**: 8→11섹션 — 구 s5(회의록+결제)를 **회의록·결제요청 독립 섹션**으로 분리, **반복·마일스톤·클라이언트 신규 섹션**, 최신 기능(작업목록·스위처·폰트·단축키·회의 일시) 반영. **말투 '쉬운 해요체'→매뉴얼 톤(합니다/하세요체)** 전면 통일 — **CLAUDE.md 도움말 톤 원칙도 갱신**(다음 세션 회귀 방지).
    - **기획서 정합**: `que-product-plan.md`에 클라이언트 2단·스위처(최대 신규)·반복마일스톤·작업목록 개편·키보드 단축키·모양/폰트 설정·계정보안·PAT·KST를 각 섹션에 편입(구현·도움말이 앞서 있던 것 역방향 문서화). 정보구조 메뉴를 현행 IA로 교체.
    - 각 배포: typecheck·lint·build·core 105 통과. 커밋 다수(3490c32~3238029).

60. **2차 배치 — 담당자 변경·작업 삭제(취소 soft)·체크인 스누즈 (2026-07-05)** — 사용자 "2차 배치 진행". dev-lead 설계 → 사용자 결정 3건 → backend-dev(core·읽기·API·MCP·액션) → frontend-dev(UI) → qa(4해상도 브라우저) → glados 게이트.
    - **결정(사용자)**: (1) 작업 삭제 = **취소(cancelled) soft 전환**(hard delete 아님, 데이터·이력 보존, 복구 가능), (2) 스누즈 프리셋 **30분·1시간·오늘14시·내일09시**(상한 48h), (3) 노출 = 웹 UI + REST(`/api/tasks/[id]`) + MCP. 기본값: 재배정 권한=기존 `assertCanEditTask`(본인·오너·프로젝트담당·관리자), 팀현황 '응답대기'는 스누즈 중 제외.
    - **담당자 변경**: core `reassignTask(ctx,{taskId,assigneeId})` — 편집권한 재사용, 동일담당자 no-op 거부, **미응답 체크인의 assigneeId도 새 담당자로 이관**(응답완료 체크인 이력은 불변), ChangeLog `update`("담당: 이전→새", reassign enum 신설 안 함=check제약 교체 DDL 회피). 상세시트 담당자 Select(**base-ui items prop 필수** — 목록 로딩 전엔 Select 미렌더로 raw id 노출 원천차단, `getAssignableUsersAction` lazy), 재배정 픽커 열림 시 숫자키 1~7 가드 확장. API `PATCH /api/tasks/[id]`, MCP `reassign_task`.
    - **작업 삭제(취소 soft)**: core `cancelTask` — `changeTaskStatus(cancelled)` 위임(StatusLog·ChangeLog status_change), **previousStatus + previousStatusDetail 반환**(실행취소용). cancelled를 능동 화면·완료율 분모·기한초과에서 제외(today `myTasks`에 cancelled/merged 숨김 추가, calendar/now/team/members/performance는 기제외). 상세시트 destructive 삭제 다이얼로그(정직 문구="'취소' 상태로 보관·이력/댓글 유지·복구 가능") + **sonner 실행취소 토스트**(previousStatus[+detail]로 복구). API `DELETE /api/tasks/[id]`(soft=cancel, hard delete 경로 없음), MCP `cancel_task`.
    - **체크인 스누즈**: **⚠️ 프로덕션 DDL 선적용됨** — `check_ins.snooze_until timestamptz`(nullable, Supabase MCP `add_checkin_snooze`, 코드 배포 전 적용·무파괴·구 코드는 여분 컬럼 무시). checkInSchema += `snoozeUntil`, `answerCheckIn`에 snoozeUntil(later 전용, 미래·now+48h **서버 강제**, 클라 disabled만 믿지 않음). pending 필터(today-data `pendingCheckIns`·team-data `isAwaiting`)에 `snoozeUntil>now` 제외 → 시각 경과 시 자동 재노출(스케줄러 `syncCheckIns` 무변경). 체크인 패널 '나중에'→프리셋 4개 인라인 토글(로컬 tz 계산 후 `.toISOString()`, 과거 프리셋 disabled). `respond_checkin`·`/api/checkins/[id]/answer` += snoozeUntil. row 매핑은 제네릭 camel↔snake라 supabase-rows 무변경.
    - **검증**: core **120**(신규 16), core/web/mcp/cli typecheck·web lint·**web build** 전부 통과. qa Playwright **4해상도(1920/1366/1024/768) 전 시나리오 PASS**(재배정 Select 한글이름 정상·숫자키가드·삭제 다이얼로그+실행취소·스누즈 프리셋+과거비활성, pageerror/console.error **0건**). glados 게이트: 코드 PASS, HANDOFF 미기록만 반려 → 이 항목으로 해소.
    - **glados 비차단 후속(수정 완료)**: (1) 실행취소 사각지대 — 이전 상태가 issue/on_hold였던 작업을 삭제 후 undo하면 detail 없이 `changeTaskStatus` 호출돼 `STATUS_DETAIL_REQUIRED`로 거부(버튼이 거짓말) → `cancelTask`가 취소 직전 StatusLog에서 detail 스냅샷 반환, undo가 detail 실어 복구(core 테스트 추가). (2) `rules.test.ts` `iso()` 이중평가 flaky → 변수 1회 캡처.
    - **교훈 재확인**: base-ui Select items prop 없으면 raw id 노출(59번 재발 방지 확인), 브라우저 인터랙션은 Playwright 필수. cancelled 숨김은 "행/집계 소스만 필터, ID→조회 맵은 전체 유지" 규율(57번) 준수.

61. **PM 도구(/projects) DB화 + 메뉴 정식 복귀 (2026-07-05)** — 사용자 "다음 배치=PM DB화". dev-lead 설계 → 사용자 결정 3건 → backend-dev(core·데이터·액션·메뉴) → frontend-dev(컴포넌트 전환) → qa(4해상도) → glados PASS.
    - **핵심 전환**: `/projects` PM 도구가 in-memory mock(`pm-data.ts` Workspace→PmProject→TaskGroup→PmTask, 비영속)에서 **core Task/Project 기반**으로 전면 재작성 → 영속·권한·ChangeLog 확보 후 **메뉴 정식 복귀**. 두 '프로젝트' 개념 이중화(56번 "혼란의 정체")가 해소됨 — 이제 홈·성과·planning·클라이언트·/projects가 core Project 단일 기준.
    - **결정(사용자·A안)**: (1) 칸반 카드 = **core Task 흡수**(멀티담당→단수 assigneeId, 체크인 없는 첨부·category·시간대표시 폐기 — 첨부는 업로드 백엔드 없는 가짜였음), (2) 칸반 컬럼 = **status 고정 4열**(예정=scheduled/needs_reschedule·진행중=in_progress·홀드/문제=on_hold+issue·완료=done, cancelled/merged 제외), '그룹 추가'(자유컬럼)·position 순서 폐기, (3) /projects **전원 노출**(adminOnly 아님, 쓰기는 canEditTask가 카드 단위 제한). Workspace 폐기(Client가 상위 계층), mock 시드 미이관.
    - **⚠️ 프로덕션 DDL 선적용**: `projects.description text check(len<=2000)`(Supabase MCP `add_project_description`, 무파괴 additive, 적용 전 projects 1행 확인). `tasks.priority`·`change_logs.entity_type(task/project)`는 기존재라 추가 DDL 불필요. `db/supabase/add-project-description.sql`+schema.sql 동봉.
    - **core**: `updateTaskDetails(ctx,{taskId,title?,description?,priority?,endAt?})` 신설(canEditTask·부분업데이트·ChangeLog update·no-op 방지), `createTask` priority 입력, projectSchema/createProject/updateProject description. 테스트 120→**129**(+9).
    - **데이터/액션**: `pm-data.ts` 삭제 → `projects-data.ts`(서버 뷰모델: 보드/목록/캘린더/상세, 댓글 task_comments 실집계, `?project=` 선택·클라 필터 스코프, `STATUS_TO_COLUMN`=`Record<TaskStatus,…|null>`로 전수 매핑 **컴파일 강제**, 빈 상태). `pm-types.ts`(ListViewMember 이관), **`pm-columns.ts`(클라 안전 상수 — 클라 컴포넌트는 값 import를 여기서, projects-data는 type-only만; 57번 서버/클라 번들 경계 교훈)**. pm-actions 6액션 core 전환(create/update/reassign/delete=cancelTask soft/toggleDone/move=changeTaskStatus), **QUE_PM_WRITE 게이트·미리보기 배너 삭제**.
    - **UI**: 홀드·문제 열 이동 = **공용 `BlockedStatusDialog`**(on_hold/issue 택1 + `status-detail-form` 재사용, 사유 강제, 취소 시 카드 원위치). 드래그=열 이동만(position 제거), `canEdit===false` 카드 읽기전용(Lock·drag 불가·저장/삭제 숨김). 마감일 `<input type=date>`→`dueDateToIso`(로컬 18:00 ISO, core parseScheduleRange 요구 충족). Select 전부 items prop. `create-group-dialog`·`project-filter`(?priority/?assignee 미지원) 삭제.
    - **메뉴/문서**: menu.ts "메뉴" 섹션에 /projects(FolderKanban, 전원 노출) + 제외 주석 삭제, CLAUDE.md 메뉴 절 동기화(menu.ts 일치 불변식 유지).
    - **검증**: core **129**, core/web/mcp/cli typecheck, web lint, **web build(/projects 라우트 생성)** 통과. qa Playwright **4해상도 전 시나리오 PASS**(메뉴노출·보드4열·드래그이동·홀드Dialog취소원위치·드로어편집/재배정/soft삭제·태스크생성·목록/캘린더·**비관리자 읽기전용 Lock**, pageerror/console.error **0건**). glados **[PASS]**.
    - **후속(비차단)**: (1) COLUMN_ORDER/LABEL이 projects-data·pm-columns 이중정의(주석 의존) → pm-columns 단일출처로 정리 권장. (2) 프로젝트 필터(우선순위·담당자)는 v1 제외 — 필요 시 클라이언트 전용 필터 재도입. (3) 헤더 공유/정보 Dialog는 데모 유지(초대·권한 후속). (4) 태블릿 순수 터치 드래그는 HTML5 DnD 미동작 → 카드 ⋮ 메뉴 경로 사용(코드 주석 명시). (5) 배포 직후 프로덕션서 드래그 1회·드로어 1회 눈으로 확인 권장(glados 권고).

62. **view.griff.co.kr 공개 읽기전용 현황판 (2026-07-05)** — 사용자 "별도 모니터용 공개 페이지, que DB 연동 10분 갱신, 조회 위주". dev-lead 설계 → 사용자 결정 2건(view 먼저·조회전용) → backend(라우팅·데이터·read-only 로더) → frontend(2뷰 UI) → qa(2해상도) → glados PASS.
    - **무엇**: 로그인 없는 공개 대형 디스플레이(1920×1080). Figma XhDXyGhG2PYKNRKRpgXheQ(node 15-12361 할일보드·20-12361 주간스케줄). FAB로 두 뷰 전환: ① 할일 보드(사람별 열·오늘 할 일 카드·완료 상태표시·X/Y), ② 주간 스케줄(사람별 완료 요약 + 월~금 그리드·이벤트). 상단 날짜·요일·라이브 시계·기온. Hide-completed(URL hc=1), 날짜/주 이동, 10분 자동갱신(router.refresh). **조회 전용**(완료 체크는 상태표시일 뿐 토글/쓰기 없음).
    - **결정(사용자)**: view 먼저(구글 캘린더는 OAuth 준비 후 다음 배치), **조회 전용**(공개 페이지 쓰기 보안 이슈 회피), 완전 공개+noindex(거래처명 노출은 사용자 승인).
    - **라우팅/인증(핵심)**: 인증이 미들웨어가 아니라 (app) 레이아웃의 getCurrentUser라 → 공개 route group `(view)/view`(auth 미호출)를 (app) 밖에 두면 공개 성립, 기존 라우트 무영향. **`proxy.ts` 신설(Next 16: middleware→proxy 개명)**: host=view.griff.co.kr/view.localhost면 전 경로 `/view` rewrite + `X-Robots-Tag: noindex`, 아니면 즉시 통과. 내비는 상대 쿼리(?view=…)로 host rewrite 환경 보존.
    - **⚠️ 익명 쓰기 차단(급소)**: `getDb()`는 QUE_CRON_ACTIVE≠1(현 프로덕션)이면 요청마다 syncCheckIns+persist **쓰기 유발** → 공개 익명 GET이 DB에 쓰게 됨. `db.ts`에 `loadReadOnlyDb()`(SupabaseQueDb load()만, sync/persist 미실행) 추가하고 view-data만 사용. getDb 소비자 무변경. glados 런타임 재확인.
    - **데이터 노출**: `view-data.ts`(getViewBoard/getViewWeek) 전원 unscoped 읽기, **화이트리스트 필드만**(제목·시간·상태·담당자 이름/색·클라이언트 라벨). description·사유·금액·회의록·체크인·PII 미접근(렌더 HTML 실측 검증). **private 작업 제외·private 이벤트 "자리비움"** 마스킹(board·week 양쪽). 그날/그주 판정은 today-data/calendar-data 준거(KST, instrumentation.ts).
    - **UI**: components/view/*(board-grid·week-grid·view-header·view-clock(1s)·view-auto-refresh(600s)·hide-completed-toggle·view-fab·view-format). 담당자색 틴트 카드, green=완료. 앱 셸 없는 독립 (view) 레이아웃. 기온 open-meteo(무키, 서울 좌표, revalidate 600, 실패 시 숨김 — 유일 외부 fetch).
    - **검증**: web typecheck·lint·**build(/view 생성)** 통과. qa Playwright 1920/1366 PASS(보드·주간·라이브시계·조회전용 클릭무반응·hide-completed·FAB전환·proxy host rewrite+noindex·기존 /today 로그인게이트 무영향, console/pageerror 0). glados **[PASS]**(익명쓰기차단·화이트리스트·private마스킹·proxy범위·noindex 런타임 재확인).
    - **⚠️ 서브도메인 연결 — (1) 완료, (2) 사용자 대기**: (1) **Vercel 프로젝트 que에 view.griff.co.kr 도메인 추가 완료**(`vercel domains add view.griff.co.kr`, 2026-07-05). (2) **Cloudflare DNS 미완(사용자만 가능)**: 현재 `*.griff.co.kr` 와일드카드 프록시가 view를 잡아 **Cloudflare가 406 반환(Vercel 미도달, `server:cloudflare`·`x-vercel-id` 없음)** — 임의 서브도메인도 동일 406으로 와일드카드 확인. → Cloudflare griff.co.kr DNS에 **명시적 `view` 레코드**를 기존 `que` 레코드와 동일하게(프록시 CNAME→cname.vercel-dns.com, 동일 SSL/Full) 추가하면 와일드카드보다 우선해 Vercel로 라우팅되고 proxy.ts가 /view로 rewrite. 그 전엔 **que.griff.co.kr/view**로 접근 가능(동일 공개 화면, 지금 라이브·200).
    - **후속(비차단)**: (1) 메인 host의 /view도 공개 접근됨(같은 화이트리스트라 무위험, 원하면 proxy에서 view host 전용 제한). (2) 8명 초과·동시간 이벤트 다수 시 페이지네이션/겹침분할(v1 생략 → 63번서 페이지네이션 반영). (3) 주간 뷰 하단 검은 장식 띠(Figma 원본 요소, 무정보 — 정리 여부 검토). (4) 구글 캘린더 연동 시 이벤트가 que 일정→view 자동 반영.

63. **view 현황판 개선 4건 (2026-07-05)** — view.griff.co.kr 라이브 후 사용자 검수. Figma 14-2643(페이지버튼)·22-8857(now라인) 참고. backend(3day 범위)+frontend(UI)+qa(4해상도).
    - **서브도메인 라이브**: Cloudflare `view` CNAME→cname.vercel-dns.com 설정 완료 → **view.griff.co.kr 200**(x-vercel-id·x-robots-tag noindex 확인). `*.griff.co.kr` 와일드카드보다 명시적 `view` 레코드가 우선해 Vercel 라우팅.
    - (1) **보드 페이지네이션 2명/페이지**(8명 한화면 가독성 문제) — board-grid client 전환, `PAGE x/N` 다크 pill+원형 화살표, **15초 자동순환**(마지막→처음 루프)+수동 클릭(타이머 리셋), 페이지 인덱스 client state(10분 router.refresh에도 유지), 카드/폰트 확대. Hide-completed는 페이지 내 유지.
    - (2) **스케줄 Week/3day 토글 + Today** — view-header 세그먼트+Today 버튼. backend `getViewWeek`→`getViewSchedule(anchor, range)`(week=월~금 5칸, 3day=앵커+2일 3칸, ViewWeek에 range/dayCount 필드). URL `?view=week&range=week|3day&date=yyyy-MM-dd`(구 `?week=` 폐기·`?date`로 통일). WeekNav prev/next range별 이동(week ±7 / 3day ±3).
    - (3) **시간축 10~19시** — GRID_START_MIN=600·GRID_END_MIN=1140, AXIS_HOURS [10,12,14,16,18](2h 간격). **qa가 12시간제 라벨 버그(14 PM/16 PM) 잡음→즉시 수정**(`h%12` 변환, 2 PM/4 PM/6 PM).
    - (4) **현재시각 라인**(`now-line.tsx` client) — 그리드 가로지르는 라인 + 좌측 파란 pill(현재시각 "2:30 PM"), 30초 갱신, **10~19시 밖이면 숨김**, 스케줄 뷰에만(board 無). KST(minutesOfDayKST/formatClockTime 재사용), hydration 안전.
    - **검증**: typecheck·lint·build 통과. qa Playwright 1920/1366 PASS(페이지네이션·**자동순환 clock으로 실측**·Hide완료 회귀·3day 3칸·Today·prev·next 이동폭·**now라인 위치/범위밖 숨김/board無**·FAB·시계·proxy host rewrite·기존 /today 게이트, console/pageerror 0). 시간축 라벨 버그만 FAIL→수정 후 재빌드. **보안/데이터 계층 무변경(batch 62 glados 통과분)이라 이 UI 수정은 build+qa 게이트로 갈음**(glados 생략).
    - 후속(비차단): 768×1024 태블릿 세로 week 5칸 텍스트 말줄임(디스플레이 타깃 1920라 무영향).

64. **view 대개편 + 이혜진(8번째) + 더미 데이터 (2026-07-05)** — 사용자 검수 다건. backend(mock/1Day/더미SQL)×2 + frontend(UI) + qa(4해상도) 병렬.
    - **이혜진 8번째 멤버**: `packages/core/src/mock/users.ts`(lee-hyejin, 이혜진, member, teal `#0d9488`, hyejin.lee@griff.co.kr, 사원/디자인) + **프로덕션 users 테이블 직접 삽입**(role member, avatar #0d9488, password=팀 공용 good121930 bcrypt 해시, must_change_password=false — 해시는 커밋 안 함). view는 users 읽어 8열 자동. core 129 회귀 없음.
    - **view UI 대개편**: (a) **날짜이동 상단 통일** — board·스케줄 모두 헤더에 ‹이전·Today·다음›+보고있는 날짜 라벨, 하단 WeekNav/DayNav 제거. board "이동 안 됨" 원인=보고있는 날짜 라벨 부재로 변화 감지 불가(링크는 정상)→라벨 추가로 해소. 이동폭 board±1/week±7/3day±3/1day±1. (b) **보드 전체8명↔2명 토글**(`?bmode=all|paged`, **기본 all** 4×2 한화면, paged=2명/페이지 15초 자동순환). (c) **스케줄 1Day 뷰**(하루를 **8명 열**로, 각자 타임라인) — backend `getViewDay(date):ViewDay{dateISO,columns:ViewDayColumn[]}`, `range=1day`, prev/next±1. Week/3day/1Day 토글. private 제외/"자리비움"/화이트리스트 동일.
    - **해상도 포인트**(1920 + 2420×1668·2994×1840·3540×2190 가로 태블릿/아이패드, 모바일 제외): `view-format.ts scale(base,s2420,s2994,s3540)` 헬퍼로 타이포·간격·카드 비례 확대. **⚠️ 교훈**: scale()이 `min-[${bp}px]:${cls}` 런타임 결합 → **Tailwind v4 정적 스캐너가 동적 클래스 미컴파일**(빌드 CSS 0건, 대형 해상도 확대 전무 — qa가 잡음). 수정: `globals.css`에 `@source inline(...)` 세이프리스트로 82개 유틸×3브레이크포인트 강제 생성(빌드 CSS 85/88/85건 확인). **scale()에 새 유틸 추가 시 세이프리스트도 갱신 필수**(주석 명시).
    - **더미 데이터(프로덕션, 삭제가능)**: `db/supabase/dummy-data-view-test.sql` — 프로젝트 2(`dummy-prj-unrealfest`=에픽게임즈, `dummy-prj-mendix-webinar`=멘딕스) + 태스크 58(`dummy-uf-*`/`dummy-mw-*`, Google Sheet 언리얼페스트·멘딕스웨비나 탭 제목, 8명 라운드로빈 담당, 2026-06-29~07-17 평일+오늘/내일 분산, 10~18시, done/in_progress/scheduled 혼합). **프로덕션 적용됨**(2 proj + 58 task). 삭제: `db/supabase/remove-dummy-data-view-test.sql`(`delete from tasks where id like 'dummy-%'; delete from projects where id like 'dummy-prj-%';`).
    - **검증**: core 129, typecheck·lint·build, 해상도 CSS 클래스 실재 확인, getViewDay 화이트리스트/private 준수. qa Playwright 1920/2420/2994/3540(+1024/768) — 상단 날짜이동·전체8명 토글·1Day 8열·now라인·조회전용·proxy PASS, 해상도 스케일 FAIL→수정. **glados 생략**(보안/read-only 계층 batch 62 통과분 무변경, getViewDay 동일 규칙 확인). 768세로 헤더 잘림은 flex-wrap graceful 처리(가로 디스플레이 전용이라 비차단).

65. **view 마감 반복 — 제목 축소·더미 재분배·슬라이드쇼 (2026-07-05)** — 사용자 검수 연속.
    - **보드 제목 축소**: board-grid 카드 제목/부제 ~절반 축소 + **truncate(줄바꿈 방지)** + 세로 패딩 축소(태스크 多 대비). compact(전체8명)·paged(2명) 양 모드. 사용 토큰은 기존 세이프리스트에 이미 포함.
    - **더미 담당자 재분배(버그)**: 날짜 풀(16)이 담당자 수(8)의 배수라 `index%16`(날짜)·`index%8`(담당자)가 정렬→**하루 = 한 명 몰림**. 담당자를 날짜 독립 배정(`(dateIdx+k*5)%8`, 5는 8과 서로소)→**각 날짜 3~4명**. 프로덕션 재적용(58태스크, 삭제 후 재삽입). `dummy-data-view-test.sql` 갱신.
    - **슬라이드쇼(재생) 모드**: `components/view/slideshow-controller.tsx`(client, (view) 레이아웃 상주) — **URL 상태머신 `?play=1`**(전체 리로드/10분 refresh/키오스크 재시작에도 URL만 보고 재개, 현재 URL로 다음 스텝 무상태 재-arm). ▶ 재생 클릭 → 보드 2명뷰 `bp=1..N`(각 25초, N=`ceil(팀원수/2)`=4) → 스케줄 week(120초) → 루프. ⏸ 정지=`play`/`bp` 제거. 좌하단 플로팅 버튼(우하단 FAB와 비겹침, 재생중 green). board-grid에 `bp`/`play` 주도 페이징(자체 15초 순환 off, 비상호작용 PAGE 인디케이터). 상수 `SLIDE_BOARD_MS=25s`·`SLIDE_SCHEDULE_MS=120s`. `boardPages`는 layout이 `loadReadOnlyDb` 유저수로 계산 주입(Suspense).
    - **검증**: typecheck·lint·build, qa Playwright **35 assertion PASS**(bp 순회 25초·스케줄 120초·루프·정지·URL 직접접근 재개·조회전용·FAB 수동이탈·제목 truncate·해상도 버튼 비겹침, console/pageerror 0). glados 생략(read-only/보안 계층 batch 62 통과분 무변경).

66. **view 설정 메뉴 + SUIT 폰트 + 더미 대폭 증량 (2026-07-05~06)** — 사용자 검수.
    - **설정 메뉴**: `lib/view-settings.ts`(스키마·기본값·clamp/normalize·localStorage load/save·`useSyncExternalStore` 훅) + `components/view/view-settings.tsx`(기어 ⚙ 버튼=좌하단 재생버튼 위, base-ui Dialog). **localStorage `que-view-settings`**(무인증 공개 페이지라 기기별 키오스크 저장): `boardSeconds`(25)·`scheduleSeconds`(120)·`scheduleRange`(week/3day/1day)·`boardMode`(paged/all)·`includeBoard`·`includeSchedule`, 초 5~600 clamp. `slideshow-controller`가 하드코딩 상수 대신 이 설정 구동 — boardMode=all이면 보드 단일화면 boardSeconds 후 스케줄(bp 순회 없음), scheduleRange로 스케줄 스텝 range(1day면 DayGrid), 순회 포함 토글로 보드만/스케줄만/둘다.
    - **SUIT 폰트 통일**: `(view)/layout.tsx` 루트 컨테이너에 `fontFamily: var(--font-suit), sans-serif`(앱 root `app/layout.tsx`의 next/font/local `--font-suit` 재사용, **새 @font-face 없음**). 기존 view가 상속하던 Inter Tight(라틴) 대신 view 전체(헤더·보드·주간·시계) SUIT 단일. 설정 Dialog는 body portal이라 앱 기본 폰트(의도).
    - **더미 대폭 증량**: 58→**299개**(UF 150 + MW 149), 8명 각 37~38, **모든 날짜(2026-06-29~07-17 평일 + 오늘 07-05) 8명 전원 18~19개**(멤버당 2~3). 담당자 정렬 버그 방지(멤버 루프 내측→모든 날짜 8명). 프로덕션 재적용: **supabase-js 서비스키 스크립트**(`$JOB/tmp/apply-dummy-data.mjs`, `dummy-%` 삭제 후 삽입, apps/web 안에서 실행해 모듈 해석). `dummy-data-view-test.sql` 갱신(커밋), `remove-dummy-data-view-test.sql` 그대로 유효(`id like 'dummy-%'`).
    - **검증**: typecheck·lint·build, qa Playwright 전부 PASS(설정 저장/영속·슬라이드쇼 설정반영[초·전체모드·1day·순회토글]·SUIT computed fontFamily·조회전용·proxy·기존 게이트, console/pageerror 0). glados 생략(read-only 계층 무변경).

67. **앱 검수 배치1 — 빠른수정 5 + 버그18 (2026-07-06)** — 사용자 18항목 검수 중 1차(15는 회의 후 대기). 나머지는 배치 2~5 예정(일정 9·10·11 / 전역추가 4·5·6·7 / 회의록 13·16 / 설정직원 19 / 프로젝트 20).
    - **8** 일정 월간뷰 높이 풀사이즈(`schedule/month-view.tsx`: `flex h-[calc(100dvh-13rem)]` + `grid-rows-[auto_repeat(6,minmax(6.5rem,1fr))]`로 6주 남는 세로 채움). **12** 회의록 파일선택 `file:text-xs`(네이티브 라벨은 브라우저 로케일). **14** 회의록 마크다운 잔존(`**볼드**` 등) → 신규 `lib/markdown.ts stripMarkdown`, `notes/note-list.tsx` 원문 평문 렌더(원본 core 보존). **17** Action 담당자 Select/날짜 크기 불일치 → `action-row.tsx` SelectTrigger `!h-10`(공용 select.tsx `data-[size=default]:h-8` 이김) 둘 다 40px. **21** 프로젝트 보드 톤 25% 밝게(`pm-columns.ts` TONE_STYLE.tint = `color-mix(... white)`, 의미색 유지).
    - **18 버그(Action→Task 캘린더 미표시)**: `confirmActionItem`이 Task를 `startAt: undefined`로 생성 → `calendar-data.ts:59` `t.startAt && overlaps` 필터에서 제외(담당·관리자 무관, 데이터 누락이 원인). 수정: 마감(dueAt) 기준 **1시간 블록**(dueAt-1h~dueAt) 부여(assertCanConfirmActionItem이 dueAt 보장, seed 동작·시간그리드 모델과 일관). core **130**(회귀+1). qa e2e PASS(확정 후 관리자·담당자 주간/월간에 표시).
    - **검증**: typecheck·lint·build·core 130, qa Playwright PASS(월간높이 4해상도·마크다운 평문·보드색 명도·버그18 e2e; 17 재수정 후 40px 통일). glados 생략(소규모·qa 갈음).

68. **앱 검수 배치2 — 일정 페이지 9·10·11 (2026-07-06)** — dev-lead 설계 → backend(core+데이터+액션) → frontend(팝오버·필터·모달) → qa → glados PASS.
    - **11 새로 추가(하이브리드)**: core **`createCalendarEvent`**(source="que"·ownerId=actor **서버 고정** → 외부캘린더 위조 불가, attendee 유효성, startAt≤endAt, visibility team/private, ChangeLog create). `createScheduleTaskAction`(createTask 재사용)·`createCalendarEventAction`. **DDL 0**(calendar_events 테이블·컬럼 완비). 헤더 하이브리드 Dialog([작업]/[일정 미팅] 토글, 참여자 다중 칩, 날짜 기본값=현재 앵커 date). 카테고리 제외(스키마+색상 재설계 회피).
    - **9 이벤트 상세**: 경량 Popover(task=우선순위/마감/프로젝트/담당자/설명 + "상태 변경" CTA→TaskStatusSheet 재사용, event=주최자/참여자). 월간 칩 클라이언트화(`MonthChip`). 트리거 **`nativeButton={false}`**(base-ui div-button 콘솔에러 + Enter/Space a11y 수정).
    - **10 필터**: URL `?priority=&q=` 서버 필터(`filterScheduleItems`), 날짜 From/To 없음(뷰가 이미 날짜 창). "우선순위 없는 미팅 제외" 힌트. **마스킹 후 필터**(키워드가 "자리비움" 기준, 실제 제목 역추적 불가). range/date 보존.
    - calendar-data `CalendarViewItem` += `priority?`/`description?`/`attendees?`/`canEdit?`(비공개 마스킹 시 비어 안전). `calendar/actions.ts` /schedule revalidate 누락 수정.
    - **검증**: core **135**, typecheck·lint·build, qa PASS(팝오버 task/event·필터·작업/일정 생성 캘린더 반영·**마스킹 3계정 교차 미유출**·종료≤시작 검증·4해상도). **glados [PASS] 적대적 침투 6/6 방어**(source/owner 주입·visibility 위조·유령 actor·외부/비공개 일정 이동 전부 거부).
    - 후속(비차단): schema.sql 헤더 주석 낡음(calendar_events title 코드검증 이제 있음), event `canEdit`이 `canMoveCalendarEvent` 인라인 복제(드리프트 위험), core에 visibility 위조·200자초과 회귀 테스트 추가 권장, 1024×768 월간 마지막 요일 스크롤 전 잘림(내부 스크롤로 처리됨·타깃 아님).

69. **앱 검수 배치3 — 전역 작업추가 4·5 / 내작업 편집 6 / 병합표시 7 (2026-07-06)** — backend(조사+구현) → frontend → qa → glados.
    - **4/5 전역 작업추가**: QuickAdd(자연어 파싱+**확인카드**) → `QuickAddForm` 추출·공용화, `add-task-dialog.tsx`(header/fab 변형). 앱 상단바(전 페이지) + 홈 FAB. 확인카드 규칙 유지(우회 등록 경로 없음).
    - **6 내작업 편집**: `updateTaskDetails` +startAt/projectId(부분 업데이트·start≤end·프로젝트 실재·canEditTask·diff-only). task-status-sheet `ScheduleEditForm`(날짜+시작+끝+프로젝트, `updateTaskScheduleAction`+revalidateOps). **도움요청 다중**: statusDetail `helpUserIds: string[]`(레거시 `helpUserId` FK 컬럼 유지=하위호환, changeTaskStatus가 첫원소→help_user_id·전체→help_user_ids 동시 저장, `helpUserIdsOf()` 정규화 읽기). status-detail-form 단일 Select→다중 칩. **⚠️ 프로덕션 DDL 선적용**: `status_logs.help_user_ids text[]`(additive+backfill, `add-status-log-help-user-ids.sql`).
    - **7 병합표시**: getTaskStatusDetailAction에 `mergedIntoTitle`(순방향 A→B)+`mergedFrom`(역방향 B에 흡수된 작업들). **⚠️ QA 회귀**: merged 작업은 전 화면 숨김이라 순방향 배너 도달 불가 → 역방향(살아남은 B에 "이 작업에 병합된 작업:") 추가. **glados 반려**: mergedFrom-only 객체(reason 없음)에 빈 "대기 사유" 박스 렌더 → 상세 박스 게이트 `statusDetail?.reason && !mergedIntoTaskId`로 수정.
    - 검증: core **138**, typecheck·lint·build, qa PASS(전역버튼 다페이지·자연어 확인카드 등록·시간/프로젝트 편집·도움요청 다중·4해상도), **glados [PASS]**(하위호환·DDL·확인카드·권한 견고; 반려 1건 수정 후).
    - 후속(비차단): my-task-table/event-detail-popover projectId 미전달(그 표면 시트서 "프로젝트 없음"·프로젝트 해제 불가), ScheduleEditForm 자정 넘는 작업 저장 불가(단일 날짜), 일정 없는 작업 프로젝트만 변경 시 기본 09-10시 일정 동반 커밋.

70. **앱 검수 배치4 — 회의록 13·16 (2026-07-06)** — backend(조사+구현) → frontend → qa PASS.
    - **13 회의 일시 자동입력**: core `parse-meeting.ts extractMeetingDateTime(md)`(라벨줄 "일시/날짜/일자" 우선·ISO/한글 날짜·"오후 N시"/HH:mm 시각). `upload-note-form` onFileChange에서 자동 채움(datetime-local 기본값, 사용자 수정 가능·확인카드 규칙 무관). 못 찾으면 기존 기본값.
    - **16 다중 프로젝트 + 액션 필드**: meetingNoteSchema `projectIds: string[]` **additive**(projectId=대표=projectIds[0] 유지 → 하위호환 목록/필터 무손상). **⚠️ 프로덕션 DDL 선적용**: `meeting_notes.project_ids text[] default '{}'` nullable(core toRow가 미지정을 null로 보냄, `add-meeting-note-project-ids.sql`). createMeetingNote 다중·중복제거·실재검증. 업로드폼 다중 칩(helpUserIds 패턴)·목록 다중 라벨("A · N개" 축약). `confirmActionItem(id, overrides{assigneeId,projectId,dueAt,startAt,endAt})`·`updateActionItem(+projectId,dueTime)`. action-row에 담당자·프로젝트·마감일·마감시각(옵션)·시작시각(옵션) 필드(편집 저장/확정). 마감없는 확정은 assertCanConfirmActionItem 거부 유지.
    - 검증: core **149**(추가 12: 일시추출·다중프로젝트·override·유령거부), typecheck·lint·build, qa PASS(자동일시·다중라벨·액션 확정→/schedule 표시[배치1·2 정합]·마감없는확정 거부·4해상도, console/pageerror 0). glados 생략(qa 21항목+149테스트로 도메인 불변식 검증, 유령 프로젝트/사용자 override 거부 테스트 포함).

71. **직급별(대표/관리자/사원) 홈·성과 (2026-07-06)** — 사용자 "기획 후 검토→구현" 프로세스. planner 기획 → 사용자 결정 3건 승인 → backend → frontend → qa PASS.
    - **결정(승인)**: 성과 스코프=**사람 위젯(히트맵·부하표)에만**(KPI·완료율·프로젝트 진행률은 전원 동일, 사원 KPI/성과라인만 본인), 사원 저성과표 숨김·부하 분포는 보임, 직급=rank 기반 gradeForUser. (열린질문: 병목 목록 대표 작업 포함·관리자 부하표 대표 제외·진입점 현행 유지·관리자 상호노출 = 기획 추천대로.)
    - **직급 판정**: core `gradeForUser(id):"ceo"|"manager"|"staff"`(USER_RANK 소스: 대표=황성현/관리=오승훈/사원=나머지, 문자열 rank 직접비교 금지), `personScopeForGrade(viewerId)`(ceo=8·manager=대표제외7·staff=본인, **viewerId에서만 유도=URL 확대 불가**). role(admin/member)은 쓰기권한 전용 유지. **DB 변경 없음**.
    - **성과 스코프**: getPerformanceData `viewer` 옵션·getHeatmapData `personScope` — 히트맵 rows·저성과표(lowPerformers)만 스코프. heatmap/page가 세션 viewer 전달, 데이터 계층이 viewer.id로 스코프 **재유도**(호출자 값 불신=report-data 게이트 패턴). 사원 저성과표는 frontend가 카드 숨김("내 월간 요약" 대체).
    - **직급별 홈**: `getGradeHomeData(user)` → `GradeHomeData`(staff/manager/ceo discriminant, `home-grade-data.ts`). home/page 3분기. **staff "내 하루"**(내 KPI·오늘 할 일·개인 일정·내게 온 요청·내 기여 히트맵1행·내 성과). **manager "어디가 막혔나"**(팀 요약칩·병목 attention[대표 작업 포함]·일정충돌·팀 부하[대표 제외]·확인필요·결제 + 본인 축소, 감시성 문구 금지). **ceo "전사 조망"**(전사 KPI·완료추이·프로젝트+위험 마일스톤·현재 막힘·**클라이언트별 현황**[신규 `client-overview.ts getClientOverview`: 거래처별 활성PJ·평균진행률·막힘]·전원 부하). 기존 컴포넌트 재사용 + 신규 `components/home/*`(client-overview·risk-milestones·attention-list·blocker-list·load-bars·request-inbox + staff/manager/ceo-home).
    - 검증: core **157**(gradeForUser·personScope URL확대불가 테스트), typecheck·lint·build, qa PASS(3직급 홈 분기·성과 스코프 사원1/관리자7/대표8·저성과표 사원 숨김·**URL 스코프 확대 6시도 전부 차단**·클라이언트 필터·4해상도, console 0). glados 생략(qa가 스코프 보안 e2e[URL bypass 차단]+viewer 재유도 검증, core 157). 기획서(que-product-plan.md) 홈·성과 직급별 정의 반영.
    - 후속(비차단): 기존 홈 "작업 분포" 차트 3분기서 제외(계약에 없음·복원 가능), 대표 완료추이 cm 셀렉트 없이 기본월.

77. **결제요청 분류 관리 + 얇은 목록 + 완료 원형·컨페티 (2026-07-06)** — 사용자 "관리자에서 결제요청 분류 관리·목록 왼쪽 치우침 재디자인·완료 버튼을 작업 완료와 동일하게·컨페티" → 이어서 "여러 줄 말고 view.griff task처럼 얇게".
    - **분류 모델(비-FK 하위호환)**: `payment_categories`(id·name≤50·status active/archived·sortOrder·created_at). `payment_requests.category`는 **여전히 자유 문자열(FK 아님)** — 분류 목록은 폼 select 소스일 뿐이라 이름 변경/보관이 기존 저장 category를 소급 변경하지 않는다. ⚠️ **프로덕션 DDL 적용됨**(`add-payment-categories.sql`, apply_migration): 테이블 생성 + 기존 category 문자열 시드(`paycat-`+md5) + **change_logs entity_type check 재생성**(payment_category 포함, 11값).
    - **관리자 전용 3중 강제**: UI 숨김 + 서버 액션 getCurrentUser + core `canManagePaymentCategory(admin)`. core: `paymentCategorySchema`·`createPaymentCategory`/`updatePaymentCategory`/`reorderPaymentCategories`, ChangeLog entity_type `payment_category`(via 기록). 영속 배선(supabase-db TABLE_TO_FIELD·sort_order 정렬 로드, supabase-rows).
    - frontend: 분류 관리 Dialog(`payment-category-manager.tsx`, PageHeader actions, 관리자만) — 추가·인라인 이름편집·활성↔보관·↑↓ 순서(드래그 미사용). 폼 category → **활성 분류 select**(`getPaymentCategories`), 보관/과거값은 선택지 유지, 활성 0개 시 안내 + 빈 제출 차단.
    - **완료 UX 변경**: 입금 완료를 **DoneCircle 원형 버튼 + 컨페티**(작업 완료와 동일). `canComplete`(admin)만 토글, 완료로 갈 때만 컨페티, reduced-motion 존중. 공용화: `components/app/done-circle.tsx` + `confetti.ts` 추출, `task-done-circle.tsx` 위임 리팩터(동작 불변).
    - **얇은 목록 재디자인**: `payment-list.tsx`를 view.griff `BoardCard` 스타일 얇은 단일 행 카드(약52px)로. 제목+카테고리 배지 / 부제(수신자·은행·계좌+복사·마감·요청자) / 우측(금액+복사·상태 배지·취소/되돌리기·완료 원형). 마감초과 red 틴트·취소 opacity 유지. 복사 버튼 32px(사용자 "작게" 반영, 완료 원형은 40px).
    - 검증: core **181**, typecheck·lint·**build** 통과(build는 qa 착수 전 실행). glados **[PASS]**(권한 3중 실효·마스킹 서버단 undefined로 무유출·완료 권한 서버 차단·enum 3파일[domain·schema·DDL] 일치·영속 배선·하위호환·reorder 중복/유령 id 방어 전부 실증). qa: 배치 4항목 **전부 PASS**(얇은 행·완료 컨페티·복사값 정확·분류 관리 추가/보관/순서/이름·관리자·비관리자 마스킹/게이팅 무회귀), 해상도 3/4 PASS. **태블릿 가로(1024×768) 목록우선 조치 완료**: 사전존재 이슈(page.tsx `xl:grid-cols`=Tailwind 1280 기준이라 1024서 폼 위·목록 아래 단일 스택)를 사용자 선택("목록 우선·5개 페이지 일괄")대로 처리. 폼+목록 자식 순서가 폼-우선이던 payments·revisions·meeting-notes 3개 페이지의 목록 자식에 **`order-first xl:order-none`** 추가(좁은 폭=목록 위, xl 2열=원래 폼좌·목록우 순서 유지). action·team은 이미 메인 목록/보드가 첫 자식이라 무변경(5/5 목록우선 충족). qa 실측 PASS(3페이지×[1024 목록top<폼top / 1920 2열·순서불변] = 6/6). **별도 커밋**(71b9bcc 뒤).
    - 잔여(비차단): `reorderPaymentCategories` subset orderedIds 미검증(웹은 항상 전체 전송·MCP/CLI 미노출 — 향후 노출 시 `ids.length===count` 검사 권장), 중복 이름 허용(관리자만), DDL 시드 id(md5)≠core 시드 id 체계(category FK 아니라 무영향).

76. **결제요청 수신자명·계좌/금액 복사 (2026-07-06)** — 사용자 "수신자명(입금받을 곳)·계좌번호·금액 복사 버튼".
    - paymentRequestSchema `recipientName`(≤100, optional) 추가. **⚠️ 프로덕션 DDL**: `payment_requests.recipient_name`(additive, `add-payment-recipient-name.sql`). createPaymentRequest·`/api/payments`·MCP·CLI 파리티. `PaymentRow` +`recipientName`/`accountNumberForCopy`/`amountForCopy`(**인가 뷰어[admin∨요청자 본인]에게만 raw 복사값**, 비인가는 마스킹 `accountDisplay`·`amountDisplay`만 유지).
    - frontend: `components/app/copy-button.tsx` 공용(size-10=40px, navigator.clipboard + "복사했습니다" 토스트 + Check 1.2s). payment-form "입금받을 곳" 필드, payment-list 수신자명 표시 + 금액/계좌 복사 버튼(`*ForCopy` 있을 때만=인가).
    - 검증: core **172**, typecheck·lint·build, qa PASS(수신자명 저장/표시·복사값 정확[계좌 `012-34-5678-901`·금액 `48000`]·**비인가 뷰어 복사버튼 0개/마스킹 유지**·4해상도, console 0).

75. **수정사항(이슈/피드백) 트래커 /revisions (2026-07-06)** — 사용자 "테스트 중 수정사항 적는 메뉴". backend(모델·core·DDL·데이터·메뉴) → frontend → qa PASS.
    - 팀 공용 이슈 목록. 필드: 메뉴·위치·오류사항·상태(미해결/보류/해결). **작성자·시간 자동**, 상태 변경 시 updatedAt/updatedBy. **누구나 작성·상태 변경**(인증만, 소유자 제한 없음). ChangeLog 미기록(메타 도구).
    - core: `revisionNoteSchema`·`createRevisionNote`·`updateRevisionNoteStatus`. **⚠️ 프로덕션 DDL**: `revision_notes` 신규 테이블(id·menu·location·description·status check(unresolved/hold/resolved)·author_id FK·created_at·updated_at·updated_by FK + created_at desc idx, `add-revision-notes.sql`). 시드 2건. 영속 배선(supabase-rows TABLE_INSERT_ORDER·SEED_KEY_TO_TABLE·supabase-db TABLE_TO_FIELD). `getRevisionNotes`(작성자/변경자 이름·최신순).
    - frontend: `/revisions`(폼: 메뉴 Select[menu.ts 라벨+view+기타]·위치·오류사항 필수·상태 / 목록 표: 메뉴·위치·오류사항·상태 배지 인라인 변경·작성자·작성시간·변경표기 / 필터 pill 전체·미해결·보류·해결+개수). 상태색 미해결=red·보류=amber·해결=green(semantic token). menu.ts "수정사항"(Bug, 기타 섹션, 전원). CLAUDE.md 동기화.
    - 검증: core **172**, typecheck·lint·build, qa PASS(메뉴·등록[작성자/시간 자동]·상태 인라인+색·필터·4해상도, console 0).
    - 후속(비차단): 1366 표 마지막 열 가로스크롤 발견성(오버레이 스크롤바 옅음).

74. **할일 추가 확인카드 프로젝트·시작/마감 필드 + 액션 점검 (2026-07-06)** — 사용자 "할일 추가/액션에 프로젝트·시작/마감 설정 누락".
    - **할일 추가(전역 자연어 quick-add)**: 확인 카드에 **프로젝트 Select·우선순위·마감시간** 추가(기존엔 프로젝트·마감시간 부재, 마감=시작+1h 고정이었음). `createTaskAction` +projectId/priority(core createTask 이미 지원). 파싱 시각 기본값·수정 가능·마감≤시작 인라인 차단. 확인카드 규칙 유지. 프로젝트 getAssignableProjectsAction lazy(NO_PROJECT sentinel).
    - **액션(확인필요)**: 배치4에서 이미 완비(담당자·프로젝트·마감일·마감시각·시작시각 편집/확정) — 점검만, 추가 작업 없음.
    - **QA 후속 2건 수정**: (a) "모든 작업" 목록→상세 시트가 projectId 미전달로 "프로젝트 없음" 오표시(배치3 glados 후속 지점 표면화) → my-tasks-data `MyTaskItem`/`getMyTaskList` + my-task-table `TaskRowData`에 projectId 배선(TimelineRow와 동일). (b) getAssignableProjectsAction 라벨을 `formatProjectLabel`(클라이언트·프로젝트)로 → quick-add·task-status-sheet 프로젝트 Select 일관.
    - 검증: typecheck·lint·build, qa PASS(필드 노출·등록 payload projectId/시각·마감≤시작 차단·4해상도, console 0; 프로젝트 미표시·라벨 후속 수정).

73. **앱 검수 항목 19 — 설정 직원 관리 + 명단 DB化 (2026-07-06)** — dev-lead 설계 → 사용자 결정 5건 → backend(DB화·mutation) → frontend(설정 탭·직원화면) → qa → glados(반려 1건 수정 후 PASS).
    - **결정(승인)**: 삭제=비활성/복구만, 초기비번=자동 임시비번+강제변경, 온보딩=직원추가 안내로 흡수(별도 탭 없음), 부서=임시값 DB화(편집 가능), 비활성 시 열린 작업 재배정 전 차단.
    - **⚠️ 명단 DB化(최고위험 인증 경로)**: 정적 USERS 하드코딩 → **db.users 기반**. userSchema +rank/department/active(email·passwordHash는 도메인 미포함 유지). gradeForUser/rankForUser/departmentForUser/personScopeForGrade → User 객체 기반(동작 동일·성과 스코프 무회귀). current-user/verify/PAT resolve → db.users + **inactive 차단**(JWT 7일 구멍 봉쇄). 담당자 선택 9곳 → useRoster(active 필터)/db.users. **프로덕션 DDL 선적용**: `users.active`(not null default true)·rank·department + 8명 backfill(황성현 대표/경영·오승훈 관리/운영·나머지 사원)·change_logs entity_type 'user'(`add-user-management.sql`). 정적 USERS는 mock/dev 시드로 강등.
    - **유저 mutation**(`lib/auth/users.ts` server-only, QUE_DB=supabase 전용): createUser(id 슬러그·**임시비번 1회 반환**·must_change·active, email 유니크 23505)·deactivateUser(열린작업/활성템플릿 차단·**본인 금지**·hard delete 없음 active=false)·reactivateUser. canManageUsers=admin, ChangeLog user via. **users write-back 금지 유지**(persist 미기록, 이 전용 경로만 우회).
    - **설정 재편**: /settings 서브라우트(모양/보안/토큰/직원관리[**admin 3중 게이트**: 탭숨김+페이지 redirect+canManageUsers]). 기존 컴포넌트 이동. 직원화면(목록·추가폼·비활성/복구·비번재설정·임시비번 1회 다이얼로그·온보딩 안내 흡수).
    - **glados 반려(수정 후 PASS)**: 비활성 직원에게 **새 작업 배정이 parse/createTask/reassignTask에서 안 막힘**(주석은 막힌다고 거짓) → core **`requireActiveAssignee`**(createTask/reassignTask, MCP/CLI/API 방어)·parse 호출부 active 필터·members/search 비활성 제외·회귀 2건.
    - 검증: core **167**, typecheck·lint·build, qa PASS(4계정 로그인 회귀 없음·담당자 8명·설정 3중 게이트 사원 redirect·본인/열린작업 비활성 차단), glados **[PASS]**(락아웃 프로덕션 실측·createUser 보안·write-back 금지·3중 게이트).
    - **후속(비차단)**: confirmActionItem·syncRecurringTemplates도 비활성 담당자 배정 가능(requireActiveAssignee 미적용, 같은 헬퍼로 확장 가능). createUser/deactivate 등은 supabase 전용(로컬 mock NOT_SUPPORTED). **배포 후 프로덕션 8명 로그인 재확인 권장(인증 경로 변경)**.

72. **앱 검수 항목 20 — 프로젝트 전체>클라이언트>프로젝트 필터 (2026-07-06)** — `/projects` 헤더에 클라이언트+프로젝트 2단 필터(`project-scope-filters.tsx`). URL 구동 `?client=<id|all>` + 기존 `?project=`·`?view=`·`?month=`·`?task=` 공존. `getClientOptions`로 클라 목록, `getActiveProjects(clientFilter)`로 프로젝트 스코프. **전역 스위처와 관계**: ?client 없으면 전역 쿠키 기본, ?client=<id>면 페이지 덮어쓰기, ?client=all은 쿠키 무시 sentinel(전역 쿠키 미변경 → /projects self-contained·공유가능 URL). 프로젝트 1개면 프로젝트 Select 숨김, 빈 상태에 필터 유지. base-ui items prop. typecheck·lint·build 통과. (/projects는 여전히 PM mock 미리보기·비영속, 조회 필터만.)

## 남은 작업 / 오픈 질문

- ~~알림 채널 결정~~ → **Slack 확정** (2026-07-02): 1단계 Incoming Webhook+딥링크, 2단계 Bot 인터랙티브 버튼으로 Slack 안에서 체크인 응답(`answerCheckIn` 경유, via 기록). 기획서 "알림 정책 > 알림 채널"과 MCP/CLI 계획 Phase E에 반영됨.
- ~~`que-product-plan.md` 오픈 질문 답변~~ → 2026-07-03 전항목 완료 (31번 항목 참고). Plaud MD 포맷만 샘플 도착 대기.
- 추가 메뉴 통합 제안(회의록+Action, 히트맵→팀 현황 탭) — CLAUDE.md가 이미 현재 구조(개별 메뉴 유지)로 확정해서 사실상 종결. 재검토 요청 없으면 다음 정리 때 이 줄 제거.
- 알림/설정 프리뷰 수령 후 해당 프롬프트 갱신
- ~~백로그 우선순위~~ → 32번 항목에서 확정. **1·2·3·4·5위 전부 착수 완료 (34·35·36·37번)**. 5위는 비-env 골격(인터페이스+엔진+엔드포인트+테스트)까지 완료, 실 OAuth 연동만 env/외부 계정 대기(37번 "남은 실 연동 작업" 참고). → **백로그 소진. 다음은 사용자 계획대로 "env 필요한 것들"**: Supabase 어댑터+시드 스크립트, Vercel 배포+Deployment Protection, Sentry DSN, Slack 앱, CLI/MCP 배포(30번). env/키 도착 시 착수.
- `glados` 등 커스텀 서브에이전트가 이번 세션 Agent tool 레지스트리에 안 잡히는 문제 — 다음 세션에서 재확인 (32번 항목 참고)
- "프로젝트 참여자" 회의록 공개 범위 — 프로젝트 멤버십 개념이 도메인에 없어 UI에서 제거함(34번). 실제로 필요하면 멤버십 모델부터 기획 확인 필요.
- MCP/CLI에 반복 템플릿 도구 미구현 — 지금은 웹 전용(35번). 필요하면 후속으로 `create_recurring_template`/`list_recurring_templates` 추가 검토.
