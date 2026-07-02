# Que 사용자 매뉴얼

Que를 처음 쓰는 팀원을 위한 가이드다. 웹 화면이 아니라 **CLI**와 **MCP(AI 대화형 사용)** 사용법에 집중한다.

---

## 1. 개요

Que는 캘린더 UI를 가진 팀 작업 상태 관리 도구다. 우리 8명 팀이 회사 캘린더, 개인 작업, 프로젝트 마일스톤, 회의록 Action, 결제 요청, 업무량 현황을 한 곳에서 확인하고 수정한다. 누군가를 감시하기 위한 도구가 아니라, 업무 병목과 일정 충돌을 빨리 드러내서 팀이 더 빨리 움직이게 돕는 운영 도구다.

- **CLI (`que` 명령)** — 터미널에서 오늘 일정을 확인하고, 작업 상태를 바꾸고, 결제 요청을 등록하는 등 웹 화면과 동일한 조작을 명령어로 할 수 있다.
- **MCP** — Claude Code, Codex 같은 AI 도구에 Que를 연결해서 자연어로 "오늘 내 일정 보여줘", "이 작업 문제발생으로 바꿔줘" 같은 대화로 조작할 수 있다.

두 경로 모두 내부적으로는 같은 웹 API(`/api/*`)를 거치기 때문에, 권한·검증·마스킹·변경 로그가 웹 화면과 완전히 동일하게 적용된다.

> ⚠️ **전제 조건**
> - CLI/MCP를 쓰려면 먼저 웹 dev 서버(`pnpm dev`)가 떠 있어야 한다. 서버가 꺼져 있으면 모든 명령이 `fetch failed`로 실패한다.
> - 지금은 mock 데이터 단계다. 데이터는 서버 메모리에만 저장되고, **dev 서버를 재시작하면 시드 데이터로 초기화**된다. 등록했던 결제 요청이나 바꿨던 작업 상태가 사라져도 정상 동작이다.

---

## 2. 준비하기

### 2.1 설치 및 서버 실행

레포 루트에서:

```bash
pnpm install
pnpm dev        # apps/web 개발 서버 (http://localhost:3000)
```

`pnpm dev`가 켜져 있는 동안에만 CLI/MCP가 동작한다. 다른 터미널 탭에서 CLI 명령을 실행하면 된다.

### 2.2 토큰 개념

Que는 아직 mock 인증 단계다. 실제 로그인 대신 **Personal Access Token(PAT)** 형식의 문자열로 "나"를 식별한다.

- 토큰 형식: `que_pat_<userId>`
- 토큰 해석 우선순위: **`QUE_TOKEN` 환경 변수** > **`que login`으로 저장한 값** (`~/.que/config.json`)

내 `userId`를 토큰에 넣으면 그 사람으로 로그인한 것과 같다. 8명의 `userId`는 다음과 같다.

| 이름 | userId | 역할 | 토큰 예시 |
| --- | --- | --- | --- |
| 황성현 | `hwang-sunghyeon` | 관리자 | `que_pat_hwang-sunghyeon` |
| 오승훈 | `oh-seunghoon` | 팀원 | `que_pat_oh-seunghoon` |
| 황성진 | `hwang-sungjin` | 팀원 | `que_pat_hwang-sungjin` |
| 박승환 | `park-seunghwan` | 팀원 | `que_pat_park-seunghwan` |
| 송수용 | `song-suyong` | 팀원 | `que_pat_song-suyong` |
| 이예진 | `lee-yejin` | 팀원 | `que_pat_lee-yejin` |
| 김리원 | `kim-riwon` | 팀원 | `que_pat_kim-riwon` |
| 이혜진 | `lee-hyejin` | 팀원 | `que_pat_lee-hyejin` |

관리자(황성현)는 모든 작업/결제 요청을 제한 없이 조회·수정할 수 있고, 나머지 팀원은 본인 작업, 본인이 담당자인 프로젝트, 본인 요청 건 등으로 권한이 제한된다 (자세한 규칙은 [4. 명령어 레퍼런스](#4-명령어-레퍼런스)와 [8. 문제 해결(FAQ)](#8-문제-해결faq) 참고).

---

## 3. CLI 사용법

레포를 clone한 상태를 기준으로, CLI를 실행하는 방법은 두 가지다.

**① 레포 루트에서 한 줄로 실행**

```bash
pnpm --filter @que/cli start -- <명령> [인자...]
# 예
pnpm --filter @que/cli start -- today
```

`--` 뒤에 오는 것이 실제 `que` 명령에 전달되는 인자다.

**② packages/cli 안에서 실행**

```bash
cd packages/cli
pnpm -s start <명령> [인자...]
# 예
pnpm -s start today
```

**alias로 편하게 쓰기**

매번 `pnpm --filter @que/cli start --`를 치기 번거롭다면 쉘 설정(`~/.zshrc` 등)에 alias를 하나 걸어두면 좋다. `<레포 경로>`는 내 로컬 clone 경로로 바꾼다.

```bash
alias que="pnpm -C <레포 경로> --filter @que/cli start --"
```

이후로는 어느 디렉터리에서든 `que today`, `que login <토큰>`처럼 짧게 쓸 수 있다.

### 3.1 로그인

```bash
que login que_pat_hwang-sunghyeon
# → 토큰을 저장했습니다: /Users/<나>/.que/config.json
```

한 번 저장해두면 이후 명령에서 매번 토큰을 넘길 필요가 없다. 다른 사람으로 전환하려면 `que login`을 다시 실행하거나, 그때만 `QUE_TOKEN` 환경 변수를 앞에 붙여 쓴다.

```bash
QUE_TOKEN=que_pat_oh-seunghoon que today
```

---

## 4. 명령어 레퍼런스

### 4.1 명령 목록

| 명령 | 인자 · 옵션 | 설명 |
| --- | --- | --- |
| `login <token>` | — | 토큰을 `~/.que/config.json`에 저장 |
| `me` | — | 현재 토큰의 사용자 확인 |
| `today` | — | 오늘 요약 — 내 타임라인, 응답 대기 체크인, 주의 필요 |
| `tasks` | `--status <status>` `--assignee <userId>` `--project <projectId>` | 작업 목록 조회 (필터 조합 가능) |
| `task-status <taskId> <to>` | `--reason <reason>` `--next <nextAction>` `--help-from <userId>` `--recheck <iso>` | 작업 상태 변경. `issue`/`on_hold`는 `--reason` 필수 |
| `move <taskId> <startAt> <endAt>` | — | 작업 일정 이동 (ISO 8601) |
| `checkin <checkInId> <response>` | `--reason <reason>` | 자동 체크인 응답. `issue` 응답 시 `--reason` 필수 |
| `action list` | `--note <meetingNoteId>` | 회의록 Action 후보 목록 |
| `action assign <actionItemId>` | `--assignee <userId>` `--due <iso>` | 후보에 담당자/마감 지정 |
| `action confirm <actionItemId>` | — | 후보를 Task로 확정 (담당자·마감 필수) |
| `action hold <actionItemId>` | — | 후보 보류 |
| `action ignore <actionItemId>` | — | 후보 무시 |
| `pay list` | — | 결제 요청 목록 (계좌/금액은 권한에 따라 마스킹) |
| `pay add` | `--title` `--bank` `--account` `--amount` `--category` (모두 필수) `--due <iso>` `--desc <설명>` (선택) | 결제 요청 등록 (기본 상태: 대기) |
| `pay done <paymentId>` | — | 결제 상태를 완료로 변경 (관리자만) |
| `pay cancel <paymentId>` | — | 결제 상태를 취소로 변경 (관리자 또는 요청자 본인) |
| `pay wait <paymentId>` | — | 결제 상태를 대기로 되돌림 (관리자만) |

각 명령의 옵션/설명은 `que <명령> --help`로도 확인할 수 있다.

### 4.2 상태 코드표

**작업 상태 (`TaskStatus`, 8종)**

| 코드 | 한글 라벨 |
| --- | --- |
| `scheduled` | 예정 |
| `in_progress` | 진행중 |
| `done` | 완료 |
| `needs_reschedule` | 시간변경필요 |
| `on_hold` | 홀드 |
| `issue` | 문제발생 |
| `cancelled` | 취소 |
| `merged` | 병합 |

**체크인 응답 (`CheckInResponse`, 7종)**

| 코드 | 한글 라벨 |
| --- | --- |
| `working` | 작업중 |
| `done` | 완료 |
| `needs_reschedule` | 시간변경필요 |
| `issue` | 문제발생 |
| `not_needed` | 필요없어짐 |
| `merged` | 병합 |
| `later` | 나중에 답변 |

**Action 후보 상태 (`ActionItemStatus`)**

| 코드 | 한글 라벨 |
| --- | --- |
| `needs_review` | 확인 필요 |
| `candidate` | 생성 대기 |
| `created` | Task 생성됨 |
| `held` | 보류 |
| `ignored` | 무시됨 |

**결제 상태 (`PaymentStatus`)**

| 코드 | 한글 라벨 |
| --- | --- |
| `waiting` | 대기 |
| `done` | 완료 |
| `cancelled` | 취소 |

> `working`/`issue` 등 `checkin` 응답값은 작업 상태로도 자동 반영된다 — 예를 들어 체크인에 `issue`로 답하면 연결된 작업도 `문제발생`으로 바뀐다.

### 4.3 핵심 도메인 규칙 (알아두면 오류를 덜 만난다)

- **작업 상태 변경**: 본인, 프로젝트 담당자, 관리자만 가능. 그 외는 수정 불가.
- **`issue`(문제발생) / `on_hold`(홀드) 전환**: 반드시 `--reason` 필요. (권장: `--next`, `--help-from`, `--recheck`도 함께)
- **체크인 응답**: 담당자 본인 또는 관리자만 가능.
- **Action 확정(`action confirm`)**: 담당자·마감일이 둘 다 있어야 함. 처리(확정/보류/무시)는 담당자, 회의록 업로더, 관리자만 가능.
- **결제 상태 변경**: 완료 처리는 관리자만. 취소는 관리자 또는 요청자 본인도 가능.
- **일정(ISO 8601) 값**: `startAt`/`endAt`/`--due`/`--recheck` 모두 **타임존 오프셋을 포함**해야 한다 (`2026-07-03T14:00:00+09:00` 또는 `...Z`). 오프셋이 없으면 거부된다.

---

## 5. 케이스별 예제

아래 예제는 오늘 날짜(2026-07-02)를 기준으로 한 시드 데이터를 그대로 사용한다. 각자 실행 시점에 따라 id 번호나 표시 시각이 조금 달라질 수 있다.

### 케이스 1: 하루 시작 (login → today)

```bash
que login que_pat_hwang-sunghyeon
# → 토큰을 저장했습니다: /Users/hwang/.que/config.json

que today
```

```
── 오늘 타임라인 ──
  7/2 09:30  랜딩페이지 문구 수정 [진행중]
  7/2 10:00  광고 소재 검수 회의 [회사 일정]
  7/2 13:00  상세페이지 QA [예정]
── 응답 대기 체크인 ──
  chk-detail-qa  7/2 13:00 "상세페이지 QA"
    → que checkin chk-detail-qa <working|done|needs_reschedule|issue|not_needed|merged|later>
── 주의 필요 ──
  [문제발생] 결제 페이지 QA — API 응답 오류로 멈춤
  [홀드] CS 응대 매크로 정리 — FAQ 개편 방향 확정 대기
```

관리자는 "주의 필요"에 팀 전체의 문제발생/홀드가 보이고, 일반 팀원은 본인이 담당/소유하거나 도움 요청을 받은 항목만 보인다.

### 케이스 2: 체크인 응답 ("작업중" / "문제발생"은 `--reason` 필수)

`today`에 뜬 대로 `chk-detail-qa`에 응답해보자.

> 참고: **하나의 체크인에는 한 번만 응답할 수 있다** (다시 응답하면 `오류 [ALREADY_ANSWERED]`). 아래 세 예시는 순서대로 이어지는 게 아니라 각각 별개 상황이다. 예외적으로 `later`(나중에 답변)로 응답한 체크인은 이후 실제 응답이 가능하다.

먼저 `--reason` 없이 `issue`로 답하면 거부된다. 거부된 경우 체크인은 미응답으로 남으므로 다시 응답할 수 있다.

```bash
que checkin chk-detail-qa issue
```

```
오류 [STATUS_DETAIL_REQUIRED]: 문제발생/홀드 전환에는 사유가 필요하다 (다음 액션, 도움 필요한 사람, 재확인 시간 권장)
```

(이때 CLI는 `process.exit(1)`로 종료된다.)

`--reason`을 붙이면 성공한다.

```bash
que checkin chk-detail-qa issue --reason "QA 환경 접속 안 됨"
# → 체크인 응답 완료: 문제발생
```

반대로 `working`처럼 사유가 필요 없는 응답은 `--reason` 없이 바로 된다.

```bash
que checkin chk-detail-qa working
# → 체크인 응답 완료: 작업중
```

체크인 응답은 내부적으로 연결된 작업 상태도 함께 바꾼다 (`working` → `진행중`, `issue` → `문제발생` 등).

### 케이스 3: 작업이 막혔을 때 (task-status)

작업 자체를 직접 `issue`로 바꾸고 싶다면 `task-status`를 쓴다. `--help-from`으로 도움이 필요한 사람을, `--recheck`으로 다시 확인할 시각을 함께 남길 수 있다.

```bash
que login que_pat_kim-riwon
que task-status task-banner-design issue \
  --reason "폰트 라이선스 미승인으로 작업 중단" \
  --next "라이선스 승인 확인 후 재개" \
  --help-from oh-seunghoon \
  --recheck "2026-07-02T16:00:00+09:00"
```

```
"프로모션 배너 시안" → 문제발생
```

`--reason` 없이 `issue`/`on_hold`로 바꾸려 하면 케이스 2와 동일하게 `[STATUS_DETAIL_REQUIRED]` 오류가 난다.

### 케이스 4: 일정 이동 (move)

```bash
que login que_pat_kim-riwon
que move task-final-review "2026-07-03T14:00:00+09:00" "2026-07-03T16:00:00+09:00"
```

```
"상세페이지 최종 검수" → 7/3 14:00–7/3 16:00
```

**ISO 형식 주의**: `startAt`/`endAt`은 반드시 타임존 오프셋이 붙은 ISO 8601 문자열이어야 한다 (`+09:00` 또는 `Z`). `2026-07-03T14:00:00`처럼 오프셋을 빼면 거부된다. 화면에 찍히는 `7/3 14:00` 같은 시각은 CLI를 실행한 컴퓨터의 로컬 타임존 기준으로 표시된다 — 서버와 다른 타임존에서 실행하면 표시 시각이 달라 보일 수 있다.

```bash
que move task-final-review "2026-07-03T14:00:00" "2026-07-03T16:00:00"
```

```
오류 [INVALID_SCHEDULE]: 유효하지 않은 일정 범위: ...
```

작업 이동도 상태 변경과 동일한 권한 규칙(본인/프로젝트 담당자/관리자)을 따른다.

### 케이스 5: 회의록 Action 확정

회의록에서 뽑힌 Action 후보를 확인하고, 담당자·마감을 채운 뒤 Task로 확정한다.

```bash
que login que_pat_hwang-sunghyeon
que action list
```

```
act-api-schema  [Task 생성됨] 결제 API 응답 형식 확인 (담당 oh-seunghoon, 마감 7/3 18:00)
act-faq-draft  [Task 생성됨] CS FAQ 초안 정리 (담당 lee-yejin, 마감 7/3 18:00)
act-error-doc  [생성 대기] 결제 오류 재현 시나리오 문서화 (담당 park-seunghwan, 마감 7/4 18:00)
act-refund-copy  [확인 필요] 환불 정책 문구 검토 (담당 미지정, 마감 7/5 18:00)
act-banner-copy  [확인 필요] 배너 카피 후보 정리 (담당 kim-riwon, 마감 미지정)
```

`act-refund-copy`는 담당자가 없다. 이 상태로 바로 확정하면 거부된다.

```bash
que action confirm act-refund-copy
```

```
오류 [ACTION_NEEDS_ASSIGNEE_AND_DUE]: 담당자 또는 마감일이 없는 Action은 Task로 생성하지 않는다 — 확인 필요 상태로 남긴다
```

담당자를 지정하면(마감은 이미 있으므로) "생성 대기"로 올라가고, 그다음 확정이 성공한다.

```bash
que action assign act-refund-copy --assignee lee-hyejin --due "2026-07-05T18:00:00+09:00"
# → "환불 정책 문구 검토" → 생성 대기

que action confirm act-refund-copy
# → Task 생성됨: task-gen-1 "환불 정책 문구 검토" (담당 lee-hyejin)
```

(`task-gen-N`의 번호는 그때까지 서버에서 몇 번째로 생성된 항목인지에 따라 달라진다.)

담당자/회의록 업로더/관리자가 아닌 사람이 처리하려 하면 `[NOT_AUTHORIZED]`로 거부된다.

### 케이스 6: 결제 요청 (pay)

박승환이 결제 요청을 등록한다. 모든 필수 옵션(`--title` `--bank` `--account` `--amount` `--category`)을 채워야 한다.

```bash
que login que_pat_park-seunghwan
que pay add \
  --title "외주 번역비" \
  --bank "카카오뱅크" \
  --account "3333-01-1234567" \
  --amount 150000 \
  --category "외주" \
  --due "2026-07-08T18:00:00+09:00" \
  --desc "상세페이지 번역"
```

```
결제 요청 등록됨 (대기): pay-gen-1 "외주 번역비"
```

(`pay-gen-N`의 번호는 그 서버 세션에서 몇 번째로 생성된 항목인지에 따라 달라진다 — 아래 예시는 번호를 `pay-gen-1`로 고정해 표기했다.)

`pay list`로 전체 목록을 보면, **본인 요청과 관리자에게는 계좌/금액이 그대로 보이고, 그 외 사람의 요청은 계좌 뒤 4자리만 남기고 마스킹**되며 금액은 "금액 비공개"로 표시된다.

```bash
que pay list
```

```
pay-courier  [대기] ⚠마감초과 샘플 발송 택배비 — 송수용 · 국민은행 •••• 8901 · 금액 비공개
pay-gen-1  [대기] 외주 번역비 — 박승환 · 카카오뱅크 3333-01-1234567 · 150,000원
pay-stock-photo  [대기] 스톡 이미지 연간 구독 — 김리원 · 신한은행 •••• 6789 · 금액 비공개
pay-cancel-sample  [취소] 외주 촬영 선금 — 김리원 · 하나은행 •••• 1234 · 금액 비공개
pay-fonts  [완료] 폰트 라이선스 — 황성진 · 우리은행 •••• 8901 · 금액 비공개
```

목록은 "마감 초과 대기 → 대기 → 나머지" 순, 같은 그룹 안에서는 최근 등록 순으로 정렬된다. 박승환 본인 건(`pay-gen-1`)만 계좌/금액이 그대로 보이고, 나머지는 마스킹된 것을 확인할 수 있다. 마감이 지난 대기 건에는 `⚠마감초과` 표시가 붙는다.

**완료 처리는 관리자만** 할 수 있다. 요청자 본인이라도 완료로는 못 바꾼다 (취소는 가능).

```bash
que pay done pay-gen-1
```

```
오류 [NOT_AUTHORIZED]: 결제 상태는 관리자(또는 본인 취소)만 변경할 수 있다
```

```bash
que login que_pat_hwang-sunghyeon
que pay done pay-gen-1
# → "외주 번역비" → 완료
```

### 케이스 7: 권한 오류를 만났을 때

내 담당도 아니고, 내가 소유한 프로젝트도 아니고, 관리자도 아닌 작업을 바꾸려 하면 `[NOT_AUTHORIZED]`가 난다.

```bash
que login que_pat_song-suyong
que task-status task-landing-copy done
```

```
오류 [NOT_AUTHORIZED]: 송수용은(는) 이 작업을 수정할 수 없다. 댓글/도움 요청/상태 확인 요청만 가능하다.
```

`task-landing-copy`는 황성현이 소유/담당하는 작업이라 송수용은 상태를 바꿀 수 없다. 이런 경우 담당자 본인이나 관리자에게 변경을 요청해야 한다. (댓글/도움 요청 기능은 기획에 있으나 아직 구현 전이다.)

---

## 6. Claude Code에서 사용하기 (MCP)

Que는 15개의 MCP 도구를 제공한다. 조회 도구(`get_me`, `get_my_day`, `get_now_board`, `get_team_status`, `list_tasks`, `list_action_candidates`, `list_payment_requests`)와 변경 도구(`change_task_status`, `move_task`, `respond_checkin`, `update_action_item`, `confirm_action`, `resolve_action`, `create_payment_request`, `update_payment_status`)로 나뉜다.

### 6.1 연결하기

웹 dev 서버(`pnpm dev`)가 떠 있는 상태에서, **프로젝트 루트**에 `.mcp.json`을 만든다 (README 예시 그대로, 토큰만 본인 것으로 바꾼다).

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

`QUE_TOKEN`을 본인의 `que_pat_<userId>`로 바꾼다 (예: `que_pat_lee-yejin`). 저장한 뒤 Claude Code를 재시작(또는 MCP 서버 재연결)하면 도구가 인식된다.

### 6.2 자연어 사용 예

- **"오늘 내 일정 보여줘"** → `get_my_day` 호출. 오늘 타임라인, 응답 대기 체크인, 주의 필요 항목을 요약해 보여준다.
- **"상세페이지 QA 문제발생으로 바꿔줘. API 오류 때문이고 오승훈 도움 필요해"** → `change_task_status`를 `to: "issue"`, `detail: { reason: "API 오류", helpUserId: "oh-seunghoon" }`로 호출한다.
- **"팀에서 지금 막힌 거 뭐 있어?"** → `get_team_status` 호출. 진행중/문제/홀드/마감 임박/응답 대기 현황과 사람별 오늘 시간표, 일정 충돌을 정리해 보여준다.
- **"회의록 Action 중 확인 필요한 것 정리해줘"** → `list_action_candidates` 호출 후 `needs_review` 상태만 골라 정리해 보여준다.

권한·마스킹·변경 로그는 웹/CLI와 동일하게 서버(core)에서 강제되고, MCP를 거친 변경은 `via: mcp`로 기록된다.

### 6.3 안전장치

AI가 되돌리기 어려운 작업(Action **무시**, 결제 **상태 변경** 등)을 하기 전에는 사용자에게 먼저 확인을 구하도록 설계되어 있다 (`resolve_action`, `update_payment_status`에는 `destructiveHint` 표시가 붙어 있다). 사유가 필요한 상태 전환(`issue`/`on_hold`)도 사유를 먼저 물어본 뒤에 호출하게 되어 있다.

---

## 7. Codex CLI에서 사용하기

Codex CLI에서 Que MCP를 쓰려면 `~/.codex/config.toml`에 서버를 등록한다.

```toml
[mcp_servers.que]
command = "pnpm"
args = ["-C", "<레포 절대경로>", "--filter", "@que/mcp", "start"]
env = { QUE_TOKEN = "que_pat_<본인 userId>", QUE_API_URL = "http://localhost:3000" }
```

`<레포 절대경로>`는 Que를 clone한 로컬 경로로 바꾼다 (예: `/Users/griff_hq/Desktop/que`). `pnpm -C <경로>`를 쓰는 이유는, Codex가 어느 작업 디렉터리에서 실행되든 상관없이 `pnpm`이 항상 그 경로의 워크스페이스를 기준으로 `@que/mcp`를 찾아 실행하게 하기 위해서다 (레포 밖에서 Codex를 띄워도 동작한다).

---

## 8. 문제 해결(FAQ)

| 증상 | 원인 | 해결 |
| --- | --- | --- |
| `토큰이 없습니다. \`que login <토큰>\`으로 저장하거나 QUE_TOKEN 환경 변수를 설정하세요.` | `que login`을 한 적이 없어 `~/.que/config.json`이 없고, `QUE_TOKEN` 환경 변수도 안 넣음 | `que login que_pat_<본인 userId>` 실행 또는 `QUE_TOKEN` 환경 변수 설정 |
| `fetch failed` / `ECONNREFUSED` | 웹 dev 서버가 꺼져 있음 | 다른 터미널에서 `pnpm dev` 실행 후 다시 시도 |
| `오류 [UNAUTHORIZED]: ...` | 토큰 오타 또는 존재하지 않는 userId | 토큰이 `que_pat_<정확한 userId>` 형식인지 [2.2 토큰 개념](#22-토큰-개념) 표와 대조 |
| `오류 [NOT_AUTHORIZED]: ...` | 권한 부족 — 작업은 본인/프로젝트 담당자/관리자만, 체크인은 담당자/관리자만, Action 처리는 담당자/업로더/관리자만, 결제 완료는 관리자만 수정 가능 | 권한 있는 사람에게 요청하거나 해당 계정으로 로그인 |
| `오류 [STATUS_DETAIL_REQUIRED]: ...` | `issue`/`on_hold`로 바꾸면서 `--reason`을 안 붙임 | `--reason "사유"`를 추가 (필요하면 `--next`, `--help-from`, `--recheck`도) |
| 어제 등록한 데이터가 사라짐 | mock 단계라 데이터가 서버 인메모리에만 있고, `pnpm dev`를 재시작하면 시드로 초기화됨 | 정상 동작이다. 영구 저장이 필요하면 별도 안내 예정(DB 연동 전) |
| Claude Code에서 Que 도구가 안 보임 | `.mcp.json`이 없거나 위치가 잘못됐거나, 설정 후 재시작을 안 함 | `.mcp.json`이 **프로젝트 루트**에 있는지 확인, 저장 후 Claude Code 재시작(또는 MCP 재연결) |
