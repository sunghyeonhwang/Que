# Que MCP / CLI 개발 계획

마지막 업데이트: 2026-07-02
기준 문서: `que-product-plan.md` (기획 source of truth)

## 1. 목적

사용자가 자신이 쓰는 AI(Claude, ChatGPT 등)와 대화하면서 Que의 작업·일정·상태·결제·회의록을 입력, 수정, 삭제할 수 있게 한다. 웹 UI를 열지 않아도 아래가 가능해야 한다.

- "내일 오후 3시에 상세페이지 QA 잡아줘" → 작업 생성
- "그거 API 오류로 막혔어, 오승훈한테 도움 요청" → 체크인 응답 + 문제발생 기록
- "오늘 내 일정 보여줘" → 오늘 화면 요약
- "결제 요청 목록에서 어제 등록한 거 취소해줘" → 결제 상태 변경

참고: Asana도 공식 MCP 서버를 제공한다. MCP 제공 자체는 차별점이 아니며, **Que의 운영 규칙(확인 카드, 자동 생성 금지, 변경 로그, 권한)을 도구 레벨까지 관철하는 것**이 차별점이다.

## 2. 원칙

1. **API-first.** 웹 앱, MCP 서버, CLI가 모두 같은 API와 권한 계층을 사용한다. MCP/CLI는 얇은 어댑터다.
2. **확인 카드 원칙을 도구에도 적용.** 생성·수정은 `해석(parse) → 확인 → 실행(commit)` 2단계 도구로 분리한다. AI가 해석 결과를 사용자에게 보여주고 동의를 받은 뒤에만 실행 도구를 호출한다.
3. **기획의 안전 규칙을 서버에서 강제.**
   - 담당자 또는 마감일 없는 Action은 Task로 자동 생성하지 않는다 (`확인 필요`로만 남긴다).
   - 외부 회사 캘린더 원본 일정과 비공개 자리비움은 수정/이동 불가.
   - `문제발생`/`홀드` 상태 변경은 사유·다음 액션·도움 필요한 사람·재확인 시간을 요구한다.
4. **본인 것만 수정.** 개인 토큰으로 인증하며, 타인의 작업은 조회·요청(댓글/도움 요청)만 가능하다. 웹과 동일한 권한 모델.
5. **모든 변경은 ChangeLog에 남긴다.** `actorId` + `via: web | mcp | cli` 필드를 기록해 어디서 바뀌었는지 추적한다.

## 3. 아키텍처

```text
apps/web          Next.js 앱 (UI + API route handlers)
packages/core     도메인 타입, 검증(zod), 권한 규칙, API 클라이언트
packages/mcp      MCP 서버 (stdio) — core를 감싸는 도구 정의
packages/cli      CLI (que 명령) — core를 감싸는 명령 정의
```

- MVP는 mock data 기반이므로 `packages/core`에 데이터 접근 인터페이스를 두고, mock 어댑터 → API 어댑터 순으로 교체한다.
- MCP 서버는 stdio 우선 (개인 로컬 사용). 팀 원격 사용이 필요해지면 Streamable HTTP로 확장.
- 인증: 사용자별 Personal Access Token. 설정 화면에서 발급/폐기. 토큰에 사용자 식별과 scope(read / write)를 담는다.

## 4. MCP 도구 명세 (초안)

### 조회 (read-only)

| 도구 | 설명 |
| --- | --- |
| `get_my_day` | 오늘 화면 요약: 내 일정, 내 작업, 응답 대기 체크인, 마감 임박, 내 관련 문제/홀드 |
| `get_now_board` | Now 운영표: 캘린더+Action 통합 목록, 문제/홀드/담당자 누락 요약 |
| `list_tasks` | 필터 조회 (담당자, 프로젝트, 상태, 기간) |
| `get_task` | 작업 상세 + 상태 로그 |
| `get_team_status` | 팀 현황: 진행중/문제/홀드/마감 임박/응답 대기, 일정 충돌 |
| `get_workload` | 히트맵 데이터: 멤버별 일자별 작업량 |
| `list_action_candidates` | 회의록별 Action 후보 (확인 필요 항목 포함) |
| `list_payment_requests` | 결제 요청 목록 (권한에 따라 계좌/금액 마스킹) |

### 생성/수정 (2단계)

| 도구 | 설명 |
| --- | --- |
| `parse_task_input` | 자연어 → 작업 초안 해석 (작업명/담당자/일시/프로젝트). **저장하지 않음.** 모호하면 질문 목록 반환 |
| `create_task` | 확인된 초안으로 작업 생성 |
| `update_task` | 본인 작업의 시간/제목/설명/프로젝트 수정 |
| `move_schedule` | 작업/마일스톤 일정 이동 (드래그 이동과 동일 규칙, 마일스톤 연결 작업 영향 시 확인 요구) |
| `change_task_status` | 상태 변경. `문제발생`/`홀드`는 사유·도움 필요한 사람·재확인 시간 필수 |
| `respond_checkin` | 대기 중인 체크인에 응답 (작업중/완료/시간변경/문제발생/필요없어짐/병합/나중에) |
| `delete_task` | 본인 작업 삭제. destructive — AI가 반드시 사용자 확인 후 호출 |
| `upload_meeting_note` | 회의록 MD 등록 (회의명/프로젝트/회의일/참석자/공개 범위) |
| `confirm_action` / `hold_action` / `ignore_action` | Action 후보 확정/보류/무시. 담당자·마감일 없으면 confirm 거부 |
| `create_payment_request` | 결제 요청 등록 |
| `update_payment_status` | 대기/완료/취소 변경 (결제 담당자/관리자만) |

도구 annotation: 조회 도구는 `readOnlyHint`, `delete_task`·`ignore_action`·`update_payment_status(취소)`는 `destructiveHint`를 명시해 AI 클라이언트가 확인을 유도하게 한다.

## 5. CLI 명령 (초안)

MCP와 같은 core를 사용한다. AI 없이 터미널에서 직접 쓰는 용도.

```bash
que login                        # PAT 저장
que today                        # 오늘 요약
que now                          # Now 운영표
que task add "내일 3시 상세페이지 QA"   # 해석 → 확인 프롬프트 → 등록
que task list --mine --status 진행중
que task done <id>
que task status <id> 문제발생 --reason "..." --help-from 오승훈 --recheck 14:30
que move <id> 2026-07-04 15:00
que checkin                      # 대기 중인 체크인 응답 (대화형)
que note upload ./회의록.md --project 여름프로모션
que action list / confirm <id> / hold <id> / ignore <id>
que pay add / list / done <id> / cancel <id>
```

## 6. 개발 Phase

| Phase | 내용 | 완료 조건 | 시점 |
| --- | --- | --- | --- |
| A. API 계층 | `packages/core` 분리, zod 스키마, 권한 규칙, PAT 발급/검증, API route | 웹 UI가 core를 통해서만 데이터 접근. PAT로 API 호출 가능 | 웹 MVP Phase 2(데이터 모델)와 병행 |
| B. MCP 조회 | read-only 도구 8종 | Claude에서 "오늘 내 일정" 질의가 동작 | 웹 MVP 핵심 화면 완성 후 |
| C. MCP 쓰기 | parse/commit 2단계, 상태 변경, 체크인 응답 | 자연어 작업 생성과 체크인 응답이 대화로 완결. ChangeLog에 `via: mcp` 기록 | B 직후 |
| D. CLI | core 재사용, 대화형 확인 프롬프트 | 위 명령 세트 동작 | C 직후 (공수 낮음) |
| E. 원격/알림 연계 | Streamable HTTP, Slack 체크인 알림 연동 (채널 확정됨 — Webhook → Bot 인터랙티브 순) | Slack 발송 + 딥링크 동작, 2단계에서 Slack 내 응답이 `answerCheckIn` 경유 | D 이후 |

## 7. 리스크와 대응

- **자연어 해석 오류로 잘못된 데이터 입력** → parse/commit 분리를 서버가 강제. commit은 parse 결과 토큰을 요구해 확인 단계 우회를 막는다.
- **AI가 destructive 도구를 임의 호출** → destructiveHint + 서버 측에서 삭제는 본인 소유만 허용, ChangeLog로 복구 근거 유지.
- **권한 우회** → 권한 검사를 MCP/CLI가 아니라 API(서버)에서 수행. 클라이언트는 신뢰하지 않는다.
- **mock 단계와의 간극** → core의 데이터 어댑터 인터페이스를 먼저 고정하고 mock/API 구현을 교체 가능하게 유지.

## 8. 성공 기준

- 팀원이 웹을 열지 않고 AI 대화만으로 하루 상태 응답을 끝낼 수 있다.
- MCP/CLI 경유 변경이 웹과 동일하게 팀 캘린더·팀 현황·변경 내역에 반영된다.
- 체크인 응답률이 웹 단독 대비 상승한다 (성공 지표와 연동).
