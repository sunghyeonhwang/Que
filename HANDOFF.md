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

## 남은 작업 / 오픈 질문

- 추가 메뉴 통합 제안(회의록+Action, 히트맵→팀 현황 탭) 확정 여부 결정
- 알림/설정 프리뷰 수령 후 해당 프롬프트 갱신
- `que-product-plan.md` 하단 "오픈 질문" 섹션 (캘린더 제공자, 알림 채널, 공개 범위 기본값 등) 답변 필요
- Next.js 프로젝트 세팅은 아직 시작 전 (현재 저장소에는 기획/프리뷰 자료만 있음)
