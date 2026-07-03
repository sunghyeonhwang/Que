# Que 핸드오프 문서

마지막 업데이트: 2026-07-02

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
    - 에러 표시 P0: `(app)/error.tsx` + `global-error.tsx`(한국어, digest 코드, 다시 시도) + `lib/report-error.ts` 스텁(Sentry DSN 결정 시 교체 지점). 기획: `data/docs/que-error-reporting-plan.md` — **Sentry 채택/피드백 폼 시점/베타 공지 문구 3가지 결정 대기**.
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

## 남은 작업 / 오픈 질문

- ~~알림 채널 결정~~ → **Slack 확정** (2026-07-02): 1단계 Incoming Webhook+딥링크, 2단계 Bot 인터랙티브 버튼으로 Slack 안에서 체크인 응답(`answerCheckIn` 경유, via 기록). 기획서 "알림 정책 > 알림 채널"과 MCP/CLI 계획 Phase E에 반영됨.
- ~~`que-product-plan.md` 오픈 질문 답변~~ → 2026-07-03 전항목 완료 (31번 항목 참고). Plaud MD 포맷만 샘플 도착 대기.
- 추가 메뉴 통합 제안(회의록+Action, 히트맵→팀 현황 탭) — CLAUDE.md가 이미 현재 구조(개별 메뉴 유지)로 확정해서 사실상 종결. 재검토 요청 없으면 다음 정리 때 이 줄 제거.
- 알림/설정 프리뷰 수령 후 해당 프롬프트 갱신
- ~~백로그 우선순위~~ → 32번 항목에서 확정. **1·2·3·4·5위 전부 착수 완료 (34·35·36·37번)**. 5위는 비-env 골격(인터페이스+엔진+엔드포인트+테스트)까지 완료, 실 OAuth 연동만 env/외부 계정 대기(37번 "남은 실 연동 작업" 참고). → **백로그 소진. 다음은 사용자 계획대로 "env 필요한 것들"**: Supabase 어댑터+시드 스크립트, Vercel 배포+Deployment Protection, Sentry DSN, Slack 앱, CLI/MCP 배포(30번). env/키 도착 시 착수.
- `glados` 등 커스텀 서브에이전트가 이번 세션 Agent tool 레지스트리에 안 잡히는 문제 — 다음 세션에서 재확인 (32번 항목 참고)
- "프로젝트 참여자" 회의록 공개 범위 — 프로젝트 멤버십 개념이 도메인에 없어 UI에서 제거함(34번). 실제로 필요하면 멤버십 모델부터 기획 확인 필요.
- MCP/CLI에 반복 템플릿 도구 미구현 — 지금은 웹 전용(35번). 필요하면 후속으로 `create_recurring_template`/`list_recurring_templates` 추가 검토.
