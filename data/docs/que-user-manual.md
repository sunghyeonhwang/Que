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
| `comment <taskId> <내용...>` | `--help-from <userId>` | 작업에 댓글/도움 요청 등록. 타인 작업에도 가능 |
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
- **댓글**: 수정 권한과 무관하게 **팀 누구나** 작업에 댓글을 남길 수 있다. `--help-from`(도움 요청)을 지정하면 대상자의 오늘 화면·팀 현황에 노출되고 ChangeLog에도 남는다 — 도움 요청이 아닌 일반 댓글은 조용히 기록만 된다.
- **`merged`(병합) 전환**: 대상 작업(`mergedIntoTaskId`)이 필수다. 자기 자신이나 존재하지 않는 작업으로는 병합할 수 없다. **CLI `task-status`에는 대상 작업을 넘길 옵션이 없어** 병합 전환은 CLI로 할 수 없다 — 웹 작업 Sheet의 "병합" 버튼이나 MCP `change_task_status`(`mergedIntoTaskId`)를 쓴다.
- **체크인 생성**: 사람이 수동으로 만드는 게 아니라, **오늘 날짜의 예정(`scheduled`) 작업**이 시작 시간을 지나면 서버가 자동 생성한다 (작업당 1회, 이미 상태가 바뀐 작업은 제외).

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

> 참고: 체크인은 누가 등록하는 게 아니라 **작업 시작 시간이 지나면 자동 생성된다** (오늘 날짜의 예정 작업만 대상이고, 이미 상태가 바뀐 작업은 제외된다). `today`를 다시 조회했을 때 새로 뜬 체크인이 있다면 그 사이 시작 시간이 지난 작업이 생겼다는 뜻이다.

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

`merged`(병합)도 응답 선택지에 있지만, 병합에는 대상 작업이 필요한데 `checkin` 명령에는 이를 넘길 옵션이 없다. CLI로 시도하면 다음처럼 거부된다 — 이 경우 웹 작업 Sheet에서 작업을 열어 병합 대상을 고르거나, MCP `change_task_status`(`mergedIntoTaskId`)를 써야 한다.

```bash
que checkin chk-detail-qa merged
```

```
오류 [INVALID_INPUT]: 병합에는 대상 작업(mergedIntoTaskId)이 필요하다
```

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

`task-landing-copy`는 황성현이 소유/담당하는 작업이라 송수용은 상태를 바꿀 수 없다. 이런 경우 담당자 본인이나 관리자에게 변경을 요청해야 한다. 상태는 못 바꿔도 댓글이나 도움 요청은 남길 수 있다 — [케이스 9](#케이스-9-타인-작업에-댓글-남기기도움-요청-comment) 참고.

### 케이스 8: 자연어로 작업 등록하기 (웹 오늘 화면)

오늘 화면 상단 빠른 입력에 문장을 그대로 치면 해석 → 확인 카드 → 등록 순으로 작업이 만들어진다. **CLI에는 이 기능이 없다** — 웹 화면과 MCP(`parse_task_input` → `create_task`, [6.2](#62-자연어-사용-예) 참고)에서만 쓸 수 있다.

지원하는 표현:

| 구분 | 인식하는 표현 | 예시 |
| --- | --- | --- |
| 날짜 | 오늘/내일/모레/글피, `N월 M일`, `M/D`, `(다음 주\|이번 주)? 요일` | "내일", "7월 5일", "7/5", "금요일", "다음주 화요일" |
| 시간 | 오전·오후 `H시`(반 / `M분`), `HH:MM` | "오후 2시", "오후 2시 반", "오전 9시 30분", "14:30" |
| 담당자 | 팀원 이름 + (선택) 씨/님 | "황성현씨", "이예진님" |

인식하지 못한 단어는 지워지지 않고 **작업명에 그대로 남는다** — 확정 전 확인 카드에서 고치면 된다.

입력창에 다음을 치고 [해석]을 누른다.

```
다음주 화요일 오후 2시 회의 준비 등록해줘
```

"이렇게 등록할까요?" 확인 카드가 뜨고, 해석된 값이 필드에 채워진다. 담당자 이름이 문장에 없었으므로 카드에 안내 문구도 함께 뜬다.

```
이렇게 등록할까요?
· 담당자가 없어 본인 작업으로 등록됩니다.
```

- 작업명: `회의 준비`
- 담당자: (본인)
- 날짜: `2026-07-07`
- 시작 시간: `14:00`

("다음주 화요일"은 실행 시점(2026-07-02, 목요일)의 다음 주 월요일을 기준으로 계산되어 화요일인 2026-07-07로 해석된다.)

내용이 맞으면 [등록]을 누른다. 다음 토스트가 뜨고 카드는 닫힌다.

```
"회의 준비" 작업이 등록되어 캘린더와 담당자 오늘 화면에 표시됩니다.
```

담당자 이름이 문장에 있었으면(예: "황성현씨 회의 준비 등록해줘") 확인 카드의 담당자 칸이 처음부터 그 사람으로 채워져 있고, 담당자 관련 안내 문구는 뜨지 않는다.

### 케이스 9: 타인 작업에 댓글 남기기·도움 요청 (comment)

케이스 7에서 송수용은 `task-landing-copy`의 상태를 바꿀 수 없었다. 하지만 상태 변경 권한이 없어도 **댓글은 팀 누구나** 남길 수 있고, 담당자 대신 다른 사람에게 도움을 요청할 수도 있다.

```bash
que login que_pat_song-suyong
que comment task-landing-copy "카피 톤이 살짝 안 맞는 것 같아요, 확인 부탁드려요" --help-from hwang-sunghyeon
```

```
도움 요청을 남겼습니다.
```

(`--help-from` 없이 의견만 남기면 `댓글을 남겼습니다.`가 출력된다.)

이 도움 요청은 대상으로 지정한 황성현의 **오늘 화면 "주의 필요"**와 **팀 현황 Attention Queue**에 노출된다. 도움 요청이 아닌 일반 댓글은 조용히 기록만 되고 ChangeLog에는 남지 않는다.

웹에서는 작업 Sheet 하단 "댓글 · 도움 요청" 섹션에서 같은 일을 할 수 있다. 팀 현황 화면에서 타인의 작업 칩을 클릭해도 같은 Sheet가 열리는데, 이때는 열람과 댓글만 가능하고 상태/일정을 바꾸는 UI는 숨겨진다 (수정 권한은 여전히 서버가 최종 판단한다). MCP에서는 `list_task_comments`/`add_task_comment` 도구를 쓴다.

### 케이스 10: 하루 마감 정리 ([내일로] 이월)

오늘 화면 "하루 마감" 카드는 오늘 완료한 작업 수와 미완료 목록을 보여준다. 미완료 작업마다 "내일로" 버튼이 있어 눌러주면 같은 시간대·같은 소요시간으로 내일로 옮겨준다(일반 일정 이동과 동일한 권한·로그 적용).

미완료 작업 옆 "내일로"를 누르면 다음 토스트가 뜬다.

```
"상세페이지 QA" 작업을 내일로 옮기고 변경 로그에 기록했습니다.
```

오늘 몫을 전부 끝냈다면 카드에는 다음 문구만 남는다.

```
오늘 몫을 전부 끝냈습니다. 수고하셨어요.
```

이 기능도 웹 전용이다. CLI/MCP로 같은 결과를 내려면 `move`/`move_task`로 시작·종료 시각을 내일 날짜로 직접 계산해 넘겨야 한다 (자동으로 "내일"을 계산해주는 명령은 없다).

### 참고: 웹 화면에만 있는 그 외 기능

아래는 CLI/MCP로는 조작할 수 없고 웹 화면에서만 보이는 기능이다.

- **일정 충돌 제안** — 시작 전(예정 상태)인 내 작업이 회사 일정과 겹치면 오늘 화면 상단에 "OO가 OO(10:00–11:00)와 겹칩니다. 11:00로 변경할까요?" 카드가 뜨고, 버튼 한 번으로 그 시간대로 옮길 수 있다. 진행중인 작업이나 작업 간 충돌은 제안하지 않고 개수만 집계된다.
- **스탠드업 뷰** — 팀 현황 상단의 [운영 보드]/[스탠드업] 전환(`/team?view=standup`)에서 멤버별 어제(완료/미완)·오늘 예정·막힘(문제·홀드)을 한 화면에서 훑을 수 있다. 아침 회의용 화면이다.
- **수정됨 배지** — 캘린더(기본형/전체 멤버/월간 어느 뷰든)에서 최근 24시간 안에 상태·일정이 바뀐 항목에 "수정됨" 배지가 붙는다.

---

## 6. Claude Code에서 사용하기 (MCP)

Que는 19개의 MCP 도구를 제공한다. 조회 도구 9개(`get_me`, `get_my_day`, `get_now_board`, `get_team_status`, `list_tasks`, `list_action_candidates`, `list_payment_requests`, `list_task_comments`, `parse_task_input`)와 변경 도구 10개(`create_task`, `change_task_status`, `move_task`, `respond_checkin`, `update_action_item`, `confirm_action`, `resolve_action`, `create_payment_request`, `update_payment_status`, `add_task_comment`)로 나뉜다. `parse_task_input`은 실제로는 아무것도 저장하지 않고 해석 초안만 반환하기 때문에 조회 도구로 분류된다 — 저장은 뒤이은 `create_task` 호출에서 일어난다.

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
- **"내일 3시에 회의 준비 잡아줘"** → 곧바로 저장하지 않는다. 먼저 `parse_task_input`으로 초안(제목/담당자/일시)을 만들어 사용자에게 "이렇게 등록할까요?"로 확인받고, 승인하면 그 값으로 `create_task`를 호출한다. 담당자를 지정하지 않으면 본인 작업으로 등록된다.
- **"그 작업에 댓글 남겨줘. 황성현한테 도움 요청도 걸어줘"** → `add_task_comment`를 `helpUserId: "hwang-sunghyeon"`로 호출한다. 타인의 작업(수정 권한이 없는 작업)에도 쓸 수 있다 — 댓글은 수정 대신 의견을 전달하는 통로다.

권한·마스킹·변경 로그는 웹/CLI와 동일하게 서버(core)에서 강제되고, MCP를 거친 변경은 `via: mcp`로 기록된다.

### 6.3 안전장치

AI가 되돌리기 어려운 작업(Action **무시**, 결제 **상태 변경** 등)을 하기 전에는 사용자에게 먼저 확인을 구하도록 설계되어 있다 (`resolve_action`, `update_payment_status`에는 `destructiveHint` 표시가 붙어 있다). 사유가 필요한 상태 전환(`issue`/`on_hold`)도 사유를 먼저 물어본 뒤에 호출하게 되어 있다. 자연어 작업 생성(`parse_task_input`→`create_task`)도 같은 원칙이다 — 초안을 저장 전에 반드시 사용자에게 보여주고 확인받도록 도구 설명에 명시되어 있다. 병합(`change_task_status`의 `to: "merged"`)처럼 대상 작업 선택이 필요한 경우도 `list_tasks`로 후보를 찾아 사용자 확인을 거친 뒤 `mergedIntoTaskId`를 채워 호출하게 되어 있다.

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
| 체크인이 안 보여요 | 체크인은 **오늘 날짜의 예정(`scheduled`) 작업**이 시작 시간을 지나야 자동 생성된다 — 아직 시작 전이거나, 오늘 날짜가 아니거나, 이미 상태가 바뀐(진행중/완료 등) 작업은 대상이 아니다 | 정상 동작이다. 시작 시간이 지날 때까지 기다리면 다음 `today`/`get_my_day` 조회 때 생긴다. 급하면 [케이스 3](#케이스-3-작업이-막혔을-때-task-status)처럼 `task-status`로 직접 상태를 바꾼다 |
