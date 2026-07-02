# Que

캘린더 UI를 가진 팀 작업 상태 관리 도구. 8명 팀이 회사 캘린더, 개인 작업, 프로젝트 마일스톤, 회의록 Action, 결제 요청, 업무량 현황을 한 곳에서 확인하고 수정한다. 감시 도구가 아니라 업무 병목과 일정 충돌을 빨리 드러내는 운영 도구다.

## 현재 상태

**MVP 핵심 화면 완성** (2026-07-02) — 오늘, Now, 캘린더(3뷰+드래그), 팀 현황, 히트맵, 회의록, Action, 프로젝트, 결제. mock data 기반이며 매 Phase마다 게이트 심사(정적 검증 + 브라우저 실측 + 규칙 우회 공격)를 통과했다. 남은 것: 알림/설정(프리뷰 수령 후), API 계층 + MCP/CLI([계획](./data/docs/que-mcp-cli-plan.md)).

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
apps/web         Next.js 16 (App Router) + shadcn/ui + REST API (/api/*)
packages/core    도메인 타입·검증·권한·데이터 접근 계층 (웹/MCP/CLI 공유)
packages/mcp     MCP 서버 — AI와 대화하며 Que 조회/조작 (도구 15개)
data/            기획서, 디자인 가이드, 프롬프트, HTML 프리뷰
```

## MCP 연결 (Claude Code / Claude Desktop)

웹 dev 서버(`pnpm dev`)가 떠 있는 상태에서, 프로젝트 루트에 `.mcp.json`을 만들면 된다:

```json
{
  "mcpServers": {
    "que": {
      "command": "pnpm",
      "args": ["--filter", "@que/mcp", "start"],
      "env": {
        "QUE_API_URL": "http://localhost:3000",
        "QUE_TOKEN": "que_pat_hwang-sunghyeon"
      }
    }
  }
}
```

`QUE_TOKEN`은 mock 단계에서 `que_pat_<userId>` 형식(본인 id로 교체 — 예: `que_pat_lee-yejin`). 권한·마스킹·변경 로그는 웹과 동일하게 적용되고, 변경 출처는 `via: mcp`로 기록된다. 스모크 테스트: `QUE_TOKEN=que_pat_hwang-sunghyeon pnpm --filter @que/mcp test`

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
