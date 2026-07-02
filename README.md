# Que

캘린더 UI를 가진 팀 작업 상태 관리 도구. 8명 팀이 회사 캘린더, 개인 작업, 프로젝트 마일스톤, 회의록 Action, 결제 요청, 업무량 현황을 한 곳에서 확인하고 수정한다. 감시 도구가 아니라 업무 병목과 일정 충돌을 빨리 드러내는 운영 도구다.

## 현재 상태

기획·디자인·프로토타입 단계. Next.js 앱 구현은 아직 시작 전이다.

- 인수인계/결정사항: [`HANDOFF.md`](./HANDOFF.md)
- 개발 규칙 (Claude Code용): [`CLAUDE.md`](./CLAUDE.md)

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
