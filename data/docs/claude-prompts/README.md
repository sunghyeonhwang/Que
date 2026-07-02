# Que Claude 프롬프트 모음

이 폴더는 Que 앱을 Claude Code로 개발할 때 쓰는 프롬프트 모음이다.

권장 사용 순서:

1. `00_claude_code_설정_프롬프트.md`
2. `01_플랜_계획_프롬프트.md`
3. `page-prompts/00_공통_앱쉘_프롬프트.md`
4. `page-prompts`의 각 메뉴별 프롬프트

개발 기준 문서:

- `../que-product-plan.md` (기획 source of truth)
- `../../DESIGN.md` (디자인 가이드)

개발 순서 참고:

- `12_알림_프롬프트.md`와 `13_설정_프롬프트.md`는 **개발 후순위**다. 두 화면의 프리뷰는 추후 별도 제공 예정이므로, 프리뷰를 받기 전에는 착수하지 않는다.
- 캘린더는 **단일 메뉴**다. `03_캘린더`가 페이지 본체(뷰 스위처 포함)이고, `04_전체_캘린더`와 `05_가로_캘린더`는 그 안의 뷰 구현 기준이다.
- CLI/MCP 개발 계획은 `../que-mcp-cli-plan.md`를 따른다 (웹 MVP 이후 착수).

현재 HTML 프리뷰:

- `../../preview/index.html`
- `../../preview/now.html`
- `../../preview/today.html`
- `../../preview/calendar.html`
- `../../preview/all-calendar.html`
- `../../preview/horizontal-calendar.html`
- `../../preview/team.html`
- `../../preview/heatmap.html`
- `../../preview/meeting-notes.html`
- `../../preview/action.html`
- `../../preview/project.html`
- `../../preview/payment.html`

