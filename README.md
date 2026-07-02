# Que

캘린더 UI를 가진 팀 작업 상태 관리 도구. 8명 팀이 회사 캘린더, 개인 작업, 프로젝트 마일스톤, 회의록 Action, 결제 요청, 업무량 현황을 한 곳에서 확인하고 수정한다. 감시 도구가 아니라 업무 병목과 일정 충돌을 빨리 드러내는 운영 도구다.

## 현재 상태

Phase 0 완료 — pnpm 워크스페이스 + Next.js 16 스캐폴드 + shadcn/ui(base-nova) 세팅까지. 화면 구현은 Phase 1(App Shell)부터 시작한다.

- 인수인계/결정사항: [`HANDOFF.md`](./HANDOFF.md)
- 개발 규칙 (Claude Code용): [`CLAUDE.md`](./CLAUDE.md)

## 실행

```bash
pnpm install
pnpm dev        # apps/web 개발 서버
pnpm build      # 프로덕션 빌드
pnpm lint && pnpm typecheck
```

## 구조

```text
apps/web         Next.js 16 (App Router) + shadcn/ui
packages/core    도메인 타입·검증·권한·데이터 접근 계층 (웹/MCP/CLI 공유)
data/            기획서, 디자인 가이드, 프롬프트, HTML 프리뷰
```

## 문서

| 문서 | 내용 |
| --- | --- |
| [`data/docs/que-product-plan.md`](./data/docs/que-product-plan.md) | 제품 기획서 — 기획 source of truth |
| [`data/DESIGN.md`](./data/DESIGN.md) | 디자인 가이드 (shadcn/ui 기본값 기준) |
| [`data/docs/que-mcp-cli-plan.md`](./data/docs/que-mcp-cli-plan.md) | MCP/CLI 개발 계획 (AI 대화형 입력/수정/삭제) |
| [`data/docs/claude-prompts/`](./data/docs/claude-prompts/) | Claude Code 개발 프롬프트 모음 |

## HTML 프리뷰

정적 프로토타입. 브라우저에서 바로 열 수 있다.

```bash
open data/preview/index.html
```

## 개발 시작

`data/docs/claude-prompts/README.md`의 순서를 따른다. 스택: TypeScript · Next.js App Router · Tailwind CSS · shadcn/ui.
