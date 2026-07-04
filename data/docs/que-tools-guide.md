# Que 사용 가이드 — 웹 · CLI · MCP (+ AI 클라이언트 연동)

마지막 업데이트: 2026-07-04
대상: Que 팀원 / 운영자
관련 문서: `que-mcp-cli-plan.md`(설계), `que-product-plan.md`(기획 기준)

Que는 **세 가지 경로**로 같은 데이터를 쓴다. 어느 경로로 바꿔도 팀 캘린더·팀 현황·변경 내역(ChangeLog)에 동일하게 반영된다.

| 경로 | 무엇 | 누가 |
| --- | --- | --- |
| **웹** | 브라우저 UI (<https://que.griff.co.kr>) | 전원 |
| **CLI** | 터미널 `que` 명령 | 개발자·파워유저 |
| **MCP** | 내 AI(Claude·Gemini)와 대화로 조작 | AI 쓰는 사람 |

> 핵심 원칙: **CLI·MCP는 웹과 같은 API·권한·검증·ChangeLog를 그대로 탄다.** 권한 검사는 서버에서 강제하므로 클라이언트로 우회할 수 없다. 변경 출처는 `via: web|cli|mcp`로 기록된다.

---

## 1. 공통 개념 (CLI·MCP 둘 다 필요)

### 1-1. API 주소 (`QUE_API_URL`)

| 환경 | 값 |
| --- | --- |
| 프로덕션(실사용) | `https://que.griff.co.kr` |
| 로컬 개발 | `http://localhost:3000` (기본값) |

### 1-2. 개인 토큰 PAT (`QUE_TOKEN`)

모든 호출은 **개인 Personal Access Token**으로 인증한다. 웹 로그인과 동일한 권한이 적용된다(본인 것만 수정, 타인 것은 조회·댓글·도움요청만).

- **프로덕션 토큰**: 사용자별 무작위 토큰. 서버엔 SHA-256 해시로만 저장(원문 추측 불가). **평문은 `data/pat-tokens.txt`(gitignore)에 있고, 각자에게 안전 채널로 개별 전달**한다. 형식 예: `que_pat_...`(무작위 꼬리).
- **로컬 mock 토큰**: `que_pat_<userId>` (예: `que_pat_hwang-sunghyeon`). **로컬 dev 서버에서만** 통함(`QUE_ALLOW_MOCK_AUTH=true`). 프로덕션에선 차단(503).

사용자 id(=mock 토큰 꼬리):
```
hwang-sunghyeon(황성현·관리자)  oh-seunghoon(오승훈·관리자)
hwang-sungjin(황성진)  kim-riwon(김리원)  lee-yejin(이예진)
park-seunghwan(박승환)  song-suyong(송수용)
```

### 1-3. 안전 규칙 (서버가 강제 — 도구도 예외 없음)

- **자연어 등록은 2단계**: 해석(`parse`) → 사용자 확인 → 실행(`create`). AI가 초안을 보여주고 동의받은 뒤에만 생성한다.
- **담당자·마감 없는 Action은 Task로 자동 생성 안 됨** — `확인 필요`로만 남는다.
- **문제발생/홀드 상태 변경은 사유 필수**(+다음 액션·도움 필요한 사람·재확인 시간).
- **외부 회사 캘린더 원본·비공개 자리비움은 수정/이동 불가.**
- **본인 작업만 수정.** 타인 작업엔 댓글/도움요청/상태확인요청만.

---

## 2. CLI 사용법 (`que`)

터미널에서 AI 없이 바로 조회·조작한다.

### 2-1. 준비 (최초 1회)

```bash
# 저장소 체크아웃 + 의존성 (Node 20+, pnpm 11)
git clone https://github.com/sunghyeonhwang/Que.git
cd Que
pnpm install

# 접속 대상·토큰 설정
export QUE_API_URL=https://que.griff.co.kr
que login <내-PAT>          # ~/.que/config.json 에 저장 (또는 export QUE_TOKEN=<PAT>)
```

`que` 명령 실행 방법(택1):
```bash
# (a) 전역 링크 — 이후 어디서나 que 사용
cd packages/cli && pnpm link --global && cd ../..
que me

# (b) 링크 없이 워크스페이스로 실행
pnpm --filter @que/cli exec que me
# 또는
node packages/cli/bin/que.mjs me
```

> 토큰 우선순위: `QUE_TOKEN` 환경변수 > `~/.que/config.json`(=`que login`). 주소 우선순위: `QUE_API_URL` > config > `http://localhost:3000`.

### 2-2. 명령 전체

**조회·내 하루**
```bash
que me                       # 현재 토큰의 사용자 확인
que today                    # 오늘: 내 타임라인 + 응답대기 체크인 + 주의 필요
que tasks                    # 작업 목록
que tasks --status 진행중 --assignee kim-riwon --project proj-xxx
```

**작업 조작**
```bash
que task-status <taskId> <상태>          # 상태 변경
que task-status t-1 done
que task-status t-1 issue --reason "API 500" --help-from oh-seunghoon --recheck 2026-07-05T14:30
#   상태값: scheduled|in_progress|done|needs_reschedule|on_hold|issue|cancelled|merged
#   issue/on_hold 는 --reason 필수
que move <taskId> <시작ISO> <종료ISO>     # 일정 이동
que move t-1 2026-07-05T15:00 2026-07-05T16:00
que comment <taskId> <내용...>            # 댓글 (타인 작업도 가능)
que comment t-1 "이거 먼저 봐주세요" --help-from oh-seunghoon   # 도움 요청
```

**체크인 응답**
```bash
que checkin <checkInId> <응답> [--reason "..."]
#   응답: working|done|needs_reschedule|issue|not_needed|merged|later   (issue는 --reason 필수)
```

**회의록 Action 후보**
```bash
que action list [--note <meetingNoteId>]          # 후보 목록
que action assign <id> --assignee kim-riwon --due 2026-07-06T18:00   # 담당/마감 지정
que action confirm <id>                            # Task로 확정 (담당·마감 필수)
que action hold <id>                               # 보류
que action ignore <id>                             # 무시
```

**결제 요청**
```bash
que pay list                                       # 목록 (계좌/금액 권한별 마스킹)
que pay add --title "AWS 7월" --bank 국민 --account 123-456 \
            --amount 120000 --category 인프라 --due 2026-07-10T00:00 --desc "월 정산"
que pay done <id>      # 완료(관리자)   que pay cancel <id>   que pay wait <id>
```

---

## 3. MCP 사용법 (AI와 대화로 조작)

MCP 서버(`@que/mcp`)를 내 AI 클라이언트에 등록하면, **말로** Que를 조회·조작할 수 있다.
> 예: "오늘 내 일정 보여줘" / "내일 3시에 상세페이지 QA 잡아줘" / "그거 API 오류로 막혔어, 오승훈한테 도움 요청"

### 3-1. 실행 형태

- **전송 방식**: stdio (로컬 개인 사용). AI 클라이언트가 서버 프로세스를 띄운다.
- **실행 커맨드**: `pnpm -C <저장소경로> --filter @que/mcp start`
- **필요 env**: `QUE_TOKEN`(내 PAT, 필수), `QUE_API_URL`(프로덕션 주소)
- 단독 점검: `QUE_TOKEN=... QUE_API_URL=... pnpm --filter @que/mcp test` (스모크)

### 3-2. 도구 전체 (19종)

**조회 (readOnly)**
| 도구 | 설명 |
| --- | --- |
| `get_me` | 현재 토큰 사용자 |
| `get_my_day` | 오늘 요약(내 타임라인·응답대기 체크인·마감임박·내 관련 문제/홀드) |
| `get_now_board` | Now 운영표(캘린더+Action). `filter: all\|mine\|issue` |
| `get_team_status` | 팀 현황(진행중/문제/홀드/마감임박/응답대기·시간표·충돌) |
| `list_tasks` | 작업 목록(assignee/project/status 필터) |
| `list_action_candidates` | 회의록 Action 후보(확인 필요 포함) |
| `list_payment_requests` | 결제 요청(권한별 마스킹) |
| `list_task_comments` | 작업 댓글/도움요청 |
| `parse_task_input` | 자연어 → 작업 초안 해석. **저장 안 함**(확인용) |

**변경**
| 도구 | 설명 |
| --- | --- |
| `create_task` | 확인된 초안으로 작업 생성(`parse_task_input` 확인 후) |
| `change_task_status` | 상태 변경. issue/on_hold는 `detail.reason` 필수, merged는 `mergedIntoTaskId` 필수 |
| `move_task` | 일정 이동(ISO 8601, 시작≤종료) |
| `respond_checkin` | 체크인 응답(issue는 reason 필수) |
| `update_action_item` | Action 후보에 담당/마감/프로젝트 지정 |
| `confirm_action` | 후보 → Task 확정(담당·마감 없으면 서버 거부) |
| `resolve_action` | 후보 보류/무시 ⚠️destructive |
| `add_task_comment` | 댓글/도움요청(타인 작업 가능) |
| `create_payment_request` | 결제 요청 등록 |
| `update_payment_status` | 결제 상태 변경(완료=관리자, 취소=본인 가능) ⚠️destructive |

> 조회 도구엔 `readOnlyHint`, `resolve_action`·`update_payment_status`엔 `destructiveHint`가 붙어 있어 AI가 실행 전 확인을 유도한다.

---

## 4. AI 클라이언트 연동

아래 어디에 넣든 **서버 정의는 동일**하다(경로·PAT만 본인 값으로):

```jsonc
{
  "command": "pnpm",
  "args": ["-C", "/Users/griff_hq/Desktop/que", "--filter", "@que/mcp", "start"],
  "env": {
    "QUE_API_URL": "https://que.griff.co.kr",
    "QUE_TOKEN": "<본인 PAT>"
  }
}
```
> `-C <저장소경로>`가 작업 디렉터리를 고정하므로 어느 클라이언트에서든 동작한다. `<저장소경로>`는 `Que`를 clone한 절대경로로 바꾼다.

### 4-1. Claude Code (CLI)

터미널에서 한 줄로 등록:
```bash
claude mcp add que \
  -e QUE_API_URL=https://que.griff.co.kr \
  -e QUE_TOKEN=<본인 PAT> \
  -- pnpm -C /Users/griff_hq/Desktop/que --filter @que/mcp start
```
확인: `claude mcp list` → `que` 가 `connected`. 이후 Claude Code 세션에서 "오늘 내 Que 일정" 처럼 물으면 도구가 호출된다.
(제거: `claude mcp remove que`)

### 4-2. Claude Desktop 앱

설정 파일 `claude_desktop_config.json` 열기
(macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`, Windows: `%APPDATA%\Claude\claude_desktop_config.json`)
→ `mcpServers`에 추가 후 앱 재시작:
```json
{
  "mcpServers": {
    "que": {
      "command": "pnpm",
      "args": ["-C", "/Users/griff_hq/Desktop/que", "--filter", "@que/mcp", "start"],
      "env": {
        "QUE_API_URL": "https://que.griff.co.kr",
        "QUE_TOKEN": "<본인 PAT>"
      }
    }
  }
}
```
> `pnpm`이 PATH에 없다고 뜨면 `command`를 `pnpm` 절대경로(`which pnpm` 결과)로 바꾼다.

### 4-3. Gemini CLI

`~/.gemini/settings.json` 의 `mcpServers`에 같은 블록을 추가:
```json
{
  "mcpServers": {
    "que": {
      "command": "pnpm",
      "args": ["-C", "/Users/griff_hq/Desktop/que", "--filter", "@que/mcp", "start"],
      "env": {
        "QUE_API_URL": "https://que.griff.co.kr",
        "QUE_TOKEN": "<본인 PAT>"
      }
    }
  }
}
```
Gemini CLI 재시작 → `/mcp` 로 `que` 연결/도구 목록 확인 → 자연어로 사용.

### 4-4. 참고: Gemini 웹앱 / 기타

- **Gemini 웹앱(gemini.google.com)**은 로컬 stdio MCP 서버를 직접 연결하지 못한다 → **Gemini CLI**를 사용한다.
- 같은 JSON 형태로 **Cursor·VS Code(MCP 확장)·기타 MCP 지원 클라이언트**에도 동일하게 등록된다(키 이름만 각 클라이언트 문서 참고).

---

## 5. 자주 쓰는 시나리오

| 하고 싶은 것 | CLI | AI(MCP)에게 |
| --- | --- | --- |
| 오늘 뭐 하지 | `que today` | "오늘 내 Que 일정 요약해줘" |
| 작업 새로 잡기 | (웹 권장) | "내일 오후 3시에 상세페이지 QA 잡아줘" → 초안 확인 → 생성 |
| 막혔다 보고 | `que task-status t-1 issue --reason "..." --help-from oh-seunghoon` | "그 작업 API 오류로 막혔어, 오승훈한테 도움요청" |
| 체크인 응답 | `que checkin chk-1 working` | "지금 대기 중인 체크인 있어? 작업중으로 답해줘" |
| 회의록 Action 확정 | `que action assign a-1 --assignee kim-riwon --due ...` → `que action confirm a-1` | "이 회의록 Action에 김리원·금요일 마감 넣고 Task로 만들어줘" |
| 결제 요청 확인 | `que pay list` | "대기 중인 결제 요청 보여줘" |

---

## 6. 현재 한계 / 트러블슈팅

- **MCP는 아직 로컬 stdio(저장소 체크아웃 필요)** — 원격 호스팅(Streamable HTTP)·설정 화면 PAT 발급 UI는 로드맵(계획서 Phase E). 지금은 위 방식이 정식.
- **토큰이 없다** → `que login <PAT>` 하거나 `QUE_TOKEN` export. 프로덕션 PAT는 운영자에게 요청(`data/pat-tokens.txt`).
- **401 유효하지 않은 토큰** → PAT 오타/폐기 여부 확인. mock 토큰(`que_pat_<id>`)은 프로덕션에서 통하지 않음(로컬 dev 전용).
- **503 mock 차단** → 프로덕션에 mock 토큰을 쓴 경우. 실 PAT 사용.
- **AI가 도구를 안 부른다** → 클라이언트에서 서버가 `connected`인지 먼저 확인(`claude mcp list` / Gemini `/mcp`). 경로(`-C`)·`pnpm` PATH·`QUE_TOKEN` 확인.
- **모든 변경은 ChangeLog에 `via: cli|mcp`로 남는다** — 누가/언제/무엇을 바꿨는지 웹 팀 현황에서 추적 가능.
</content>
