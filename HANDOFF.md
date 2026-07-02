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
