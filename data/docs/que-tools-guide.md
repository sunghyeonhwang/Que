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

---

## 7. AI 명령어 세트 (자연어 프롬프트 186개)

MCP를 연결한 AI에게 아래처럼 말하면 된다. 표현은 예시일 뿐 — 뜻만 통하면 AI가 알아서 도구를 고른다.
카테고리: 조회25 · 작업생성25 · 상태변경27 · 체크인20 · 회의록26 · 결제22 · 댓글18 · 복합24.
안전 규칙은 서버가 강제한다: 본인 작업만 수정 · 문제/홀드는 사유 필수 · 자연어 등록은 확인 후 실행 · 담당·마감 없는 Action은 확정 불가.

### 7-1. 조회 · 오늘 · 팀 현황

| 프롬프트 | 도구 |
| --- | --- |
| "오늘 나 뭐부터 하면 돼? 일정이랑 할 일 좀 정리해줘." | `get_my_day` |
| "나 지금 누구로 로그인돼 있어? 관리자 권한 있는지도 알려줘." | `get_me` |
| "지금 문제 터진 작업들만 빨리 보여줘, 급해." | `get_now_board` (issue) |
| "팀 전체 지금 뭐 하고 있는지 현황 좀 띄워줘." | `get_team_status` |
| "김리원이 맡고 있는 작업 전부 보여줘." | `list_tasks` (assignee) |
| "운영보드에서 내 작업만 필터해서 보여줄래?" | `get_now_board` (mine) |
| "지금 Now 보드 전체 다 펼쳐줘. 팀 운영표 보게." | `get_now_board` (all) |
| "이번 주 마감 임박한 작업 뭐뭐 있어?" | `list_tasks` |
| "송수용 진행 중인 작업만 골라서 보여줘." | `list_tasks` (assignee+status) |
| "지금 홀드 걸려 있는 작업 전부 뽑아줘." | `list_tasks` (on_hold) |
| "오늘 회의 몇 개고 몇 시부터인지 요약해줘." | `get_my_day` |
| "박승환 지금 뭐 하고 있는지 확인 좀." | `list_tasks` |
| "지금 팀에서 막혀 있는 사람 있어? 이슈 난 거 위주로." | `get_now_board` (issue) |
| "이예진 이번에 완료 처리한 작업들 목록 보여줘." | `list_tasks` (done) |
| "que 프로젝트에 걸린 작업 전부 리스트로 뽑아줘." | `list_tasks` (project) |
| "일정 충돌 있는지 팀 현황 한번 봐줘." | `get_team_status` |
| "황성진 작업 중에 다시 잡아야 하는 거(리스케줄) 있어?" | `list_tasks` (needs_reschedule) |
| "스탠드업 돌리게 팀원별로 지금 뭐 하는지 정리해줘." | `get_team_status` |
| "내 담당 작업 중에 아직 시작 안 한 거만 보여줘." | `list_tasks` (scheduled) |
| "오승훈 예정 상태인 작업들 뭐 있어?" | `list_tasks` |
| "오늘 하루 내 할 일 브리핑 좀 해줘, 우선순위대로." | `get_my_day` |
| "지금 진행 중인 작업 전부 보드로 보여줘." | `get_now_board` (all) |
| "나한테 걸린 이슈나 막힌 거 없나 내 것만 확인해줘." | `get_now_board` (mine) |
| "김리원 진행 중이면서 아직 안 끝난 작업만." | `list_tasks` |
| "지금 회사 전체 상태 어때? 문제/대기 위주로 훑어줘." | `get_team_status` + `get_now_board` |

### 7-2. 작업 생성 (자연어 → 확인 → 등록)

모두 `parse_task_input` → (확인 카드) → `create_task` 2단계.

| 프롬프트 | 메모 |
| --- | --- |
| "내일 오후 3시에 랜딩페이지 카피 초안 잡는 거 내 작업으로. 두 시간쯤." | 본인·시작시각·2h |
| "김리원한테 모레까지 결제 모듈 QA 작업 하나 만들어줘." | 타인·마감 |
| "다음주 월요일 오전에 회원가입 플로우 리뷰 잡아줘. 대략 한 시간." | 상대날짜·1h |
| "이예진 이번주 금요일까지 디자인 시안 3개, Que 리디자인 프로젝트에 붙여서." | 타인+프로젝트+마감 |
| "오늘 저녁 7시에 배포 스크립트 점검하는 거 내 걸로." | 본인·오늘 19시 |
| "박승환한테 내일 10시~12시 API 연동 테스트 작업." | 시작~종료 구간 |
| "다음주 수요일까지 회의록 정리. 설명에 '3분기 로드맵 회의 기준'." | 마감+설명 |
| "송수용한테 예상 4시간짜리 인프라 마이그레이션 다음주에." | 타인·4h |
| "모레 오후에 광고 소재 검수, 프로젝트는 마케팅으로." | 프로젝트 |
| "이번 주 안에 온보딩 이메일 문구 다듬기. 30분이면 될 듯." | 0.5h |
| "황성진한테 내일까지 서버 로그 분석. 이슈 트래킹 관련이라고 설명." | 타인+설명 |
| "다음달 초에 분기 리포트 초안 작성 내 일정으로." | 느슨한 상대날짜 |
| "김리원 오늘 3시~5시 고객 피드백 정리 작업." | 오늘 구간 |
| "내일 점심 전까지 결제 요청서 양식 업데이트, 내 거로." | '점심 전'→마감 |
| "박승환한테 다음주 금요일 마감, 예상 3시간, Que 리디자인 프로젝트로 문서화." | 마감+시간+프로젝트 |
| "오늘 안에 히트맵 컴포넌트 버그 재현 내 작업으로 급하게." | 오늘 마감 |
| "이예진한테 모레 오전에 사용자 인터뷰 스크립트 준비." | 타인·모레 |
| "다음주 화요일 오후 2시에 팀 스탠드업 자료 준비. 한 시간." | 다음주 화·1h |
| "송수용 이번 주말까지 DB 백업 자동화. 막히면 나한테 말하라고 설명에." | 타인·설명 |
| "내일모레 캘린더 드래그 버그 픽스. 예상 2시간 반." | 2.5h |
| "황성현한테 다음주 초에 채용 공고 초안 검토 작업." | 타인 |
| "오늘 오후에 잠깐 회의실 예약 시스템 확인, 15분짜리로." | 0.25h |
| "김리원 내일 오후 4시 마감 랜딩 이미지 최적화, 마케팅 프로젝트로." | 마감+프로젝트 |
| "다음주 목요일까지 접근성 점검 리스트, 설명에 'WCAG AA 기준'." | 마감+설명 |
| "'내일 3시 결제팀 미팅 후속 정리 2시간' 어떻게 잡히는지 먼저 보여주고 등록." | 확인 카드 명시 |

### 7-3. 상태 변경 · 문제 · 홀드 · 이동 · 병합

| 프롬프트 | 도구 / 메모 |
| --- | --- |
| "방금 랜딩 QA 다 끝냈어. 완료 처리해줘." | `change_task_status` done |
| "결제 모듈 리팩터링 지금부터 시작. 진행중으로." | in_progress |
| "디자인 시안 홀드. 클라 피드백 대기, 이예진한테 재확인 요청, 내일 10시 재확인." | on_hold (사유·도움·재확인) |
| "API 연동 문제 터졌어. 500만 계속 떨어져. 박승환한테 로그 봐달라, 3시 재확인. issue로." | issue (사유·도움·재확인) |
| "오늘 못 끝낼 듯. 회원가입 QA 재조정 필요로." | needs_reschedule |
| "이벤트 배너 기획 엎어졌어. 취소 처리." | cancelled |
| "'로그인 버그 수정'을 '인증 리팩터링'으로 합쳐줘." | `list_tasks`+merged |
| "내일 하려던 보고서, 모레 2시~4시로 옮겨줘." | `move_task` |
| "디자인 리뷰 딱 한 시간만 뒤로 밀어줘." | `move_task` +1h |
| "예산 승인 안 나서 서버 증설 홀드. 황성현한테 승인 요청, 금요일 9시 재확인." | on_hold |
| "빌드 계속 깨져 배포 못 해. 오승훈한테 CI 봐달라, 5시 재확인. issue로." | issue |
| "마케팅 지표 분석 다음 주 월요일 9시로 통째로 옮겨줘." | `move_task` |
| "완료했던 카드결제 테스트, 버그 나와서 다시 진행중으로." | done→in_progress |
| "잘못 시작 눌렀네. 다시 예정 상태로." | scheduled |
| "내 '온보딩 문구 수정'을 송수용의 '온보딩 카피 전체 정리'에 병합." | merged |
| "김리원 'API 스펙 확정'에 '오늘 안에 가능할까요?' 댓글." | 타인→`add_task_comment` |
| "다음 주 사용자 리서치를 이번 주 목요일 1시~3시로 당겨줘." | `move_task` |
| "그 버그픽스 방금 머지됐어. 완료로." | done |
| "부품 입고 늦어져 하드웨어 세팅 홀드. 박승환한테 입고일 확인, 내일 2시 재확인." | on_hold |
| "프로덕션 결제 실패율 튀어. 이예진한테 도움 요청, 30분 뒤 재확인. issue로." | issue |
| "오전 코드리뷰 오늘 저녁 6시로 미뤄줘. 30분." | `move_task` |
| "막혔던 결제 연동 홀드 풀렸고 다 처리했어. 완료로." | on_hold→done |
| "'배포 스크립트 정리' 두 개네. 오래된 걸 최신 티켓으로 병합." | merged |
| "그 작업 문제 생겼어, issue로." | issue (사유 되물음) |
| "고객이 계약 취소해서 그쪽 온보딩 작업들 전부 취소로." | 다건 cancelled |
| "오후 2시 사양 검토를 4시로, 끝나는 것도 6시로." | `move_task` |
| "디자인 QA 잠깐 홀드로." | on_hold (사유 되물음) |

### 7-4. 체크인 응답

| 프롬프트 | 응답 |
| --- | --- |
| "지금 나한테 온 체크인 중에 아직 답 안 한 거 뭐 있어?" | `get_my_day` |
| "오늘 대기 중인 체크인 몇 개나 있어?" | `get_my_day` |
| "3시 스탠드업 체크인 '아직 작업중'으로 답해줘." | working |
| "번역 검수 아직 하고 있어. 진행중이라고." | working |
| "그 랜딩 QA 체크인 완료로. 방금 끝냈어." | done |
| "어 그거 끝났어~ 완료로 눌러줘." | done |
| "디자인 리뷰 체크인 일정 다시 잡아야 한다고." | needs_reschedule |
| "이거 오늘 못 끝내. 리스케줄로, 목요일로 옮기고 싶다고." | needs_reschedule |
| "미팅 준비 체크인 재조정으로, 오후 4시에 다시 확인." | needs_reschedule |
| "결제 연동 체크인 문제 있다고. API 키 만료로 막혔어." | issue (사유) |
| "디자인 시안 체크인 문제발생. 클라 피드백 미도착." | issue |
| "배포 체크인 이슈로, 서버 접근 권한 없어 막힘. 박승환한테 도움." | issue+도움 |
| "인프라 점검 이슈로. 원인 파악 중, 다음은 로그 확인, 2시 재확인." | issue 완비 |
| "그 회의 자료 준비 체크인 이제 필요 없어졌어. not_needed로." | not_needed |
| "프로모션 배너 체크인 캠페인 취소돼서 필요없음으로." | not_needed |
| "지금 바빠서 그 체크인 나중에. later로." | later |
| "회의 들어가야 해서 이따 저녁에 다시 볼 거니 later로." | later |
| "이 작업 다른 태스크로 합쳐 진행 중. merged로 답하고 병합." | merged+병합 |
| "오늘 답 안 한 체크인 알려주고, 첫 번째 건 작업중으로." | `get_my_day`+working |
| "두 체크인 중 스탠드업 건 완료, 배포 건 이슈(빌드 실패)로." | done+issue |

### 7-5. 회의록 Action 처리

| 프롬프트 | 도구 / 메모 |
| --- | --- |
| "이번 주 회의록에서 확인 필요로 넘어온 액션들 다 보여줘." | `list_action_candidates` |
| "월요일 팀회의 회의록(MN-1023) Action 후보 목록." | 특정 회의록 |
| "저번 스탠드업 회의록 Action들 후보 목록." | 특정 회의록 |
| "확인 필요에 쌓인 회의 Action 전부 목록으로." | 전체 후보 |
| "MN-2201 액션 후보 보여주고 담당 없는 것들만." | 조회+판단 |
| "'API 문서 업데이트' 담당 김리원, 마감 금요일 6시로 넣고 Task로 확정." | `update`+`confirm` |
| "이 액션 담당 박승환, 기한 다음 주 수요일. 바로 태스크로." | `update`+`confirm` |
| "'채용 공고 초안' 담당 비었대. 황성진 넣고 마감 목요일로 확정." | `update`+`confirm` |
| "'예산안 정리' 담당 황성현, 마감 6일 뒤, 프로젝트 '연간계획'으로 확정." | `update`+`confirm` |
| "담당 박승환, 마감 금요일 6시 채우고 확정까지 한 번에." | `update`+`confirm` |
| "이 액션 담당 나로, 마감 오늘 밤 11시. 급해서 바로 태스크로." | `update`+`confirm` |
| "이거 확정해줘. 담당·마감 이미 다 있어." | `confirm_action` |
| "AI-4482 담당만 이예진으로. 마감 미정이라 확정은 하지 마." | `update` only |
| "그 결제 액션 프로젝트를 '2분기 정산'으로." | `update` (project) |
| "'서버 로그 점검' 마감을 내일 정오로." | `update` (due) |
| "이 액션 담당 오승훈에서 송수용으로 바꿔줘." | `update` |
| "아까 그 액션 마감 하루 당겨 오늘 5시로." | `update` |
| "'외주 계약서 검토' 프로젝트 '법무검토'로 다시." | `update` |
| "'홈페이지 카피' 김리원·다음 주 월요일 오전. 확정은 아직 하지 마." | `update` only |
| "'경쟁사 조사' 확정 말고 마감만 다음 주 수요일로." | `update` only |
| "'디자인 시안 리뷰' 지금 진행 상황 아냐. 보류로." | `resolve` held |
| "'리팩터링 검토'는 이번 분기 안 해. 보류시켜." | `resolve` held |
| "담당·마감 애매해서 Task로 못 만들겠어. 보류 걸어둬." | `resolve` held |
| "무시 말고 일단 보류로. 다음 회의 때 다시." | `resolve` held |
| "이 액션 이미 다른 데서 처리 중. 무시 처리." | `resolve` ignored |
| "중복 액션 둘 중 하나는 필요 없어. 무시로." | `resolve` ignored |

### 7-6. 결제 요청

| 프롬프트 | 도구 / 메모 |
| --- | --- |
| "결제 요청 목록 띄워줘. 대기 건만." | `list_payment_requests` |
| "스톡 이미지 연간 구독 결제 요청. 신한 110-234-567890, 26만4천원, 카테고리 구독, 다음 주 금요일까지." | `create` (마감) |
| "외주 촬영 선금 50만원 하나은행. 카테고리 외주, 설명 '9월 프로모션 촬영 선금'." | `create`+설명 |
| "김리원 샘플 발송 택배비 4만8천원 방금 쐈어. 완료로." | `update` done (관리자) |
| "어제 올린 폰트 라이선스 결제, 안 사기로 돼서 취소." | `update` cancelled (본인) |
| "이번 달 입금 완료된 결제 건들 뽑아줘." | `list` (done) |
| "이번 주 팀 회식비 12만원 카카오뱅크로. 카테고리 기타." | `create` |
| "마감 지났는데 입금 안 된 결제 있어?" | `list` (overdue 상단) |
| "박승환 외주비 건 찾아서, 방금 송금했으니 완료로." | `list`+`update` |
| "어도비 라이선스 9만9천원 우리은행. 카테고리 라이선스." | `create` |
| "실수로 두 번 올라간 택배비 중 하나 취소." | `list`+`update` |
| "결제 요청 전체 현황 요약. 대기/완료/취소 몇 건인지." | `list` (집계) |
| "노션 팀 연간 42만원 국민은행. 카테고리 구독, 설명 '8인 팀 연간'." | `create`+설명 |
| "지난주 취소한 폰트 결제, 다시 진행하기로 해서 대기로." | `update` waiting |
| "이예진이 올린 결제 요청만 상태별로." | `list` (필터) |
| "로지텍 마우스 8만원 IBK기업은행. 카테고리 비품, 마감 월말." | `create` |
| "계좌 다 노출되는 거 아니지? 촬영 소품비 6만원 토스뱅크로 등록." | `create` (마스킹 안내) |
| "세금계산서 33만원 방금 입금 끝냈어. 완료로." | `update` done |
| "내가 올린 결제 요청 지금 상태 어때?" | `get_me`+`list` |
| "광고비 정산 요청 내가 올린 거 맞으면 취소." | `get_me`+`update` |
| "나 관리자니까 대기 결제들 계좌·금액 원본까지 정리해줘." | `list` (관리자 원본) |

### 7-7. 댓글 · 도움요청

| 프롬프트 | 도구 / 메모 |
| --- | --- |
| "이 작업에 댓글 뭐 달렸는지 보여줘." | `list_task_comments` |
| "로그인 리팩터 작업에 '테스트 통과, 리뷰 요청드립니다' 댓글." | `add_task_comment` |
| "이 결제 연동 혼자 못 하겠다. 오승훈한테 도움 요청." | `add`(help) |
| "김리원 디자인 작업에 '아이콘 두 단계만 키워주세요' 댓글." | 타인→댓글 |
| "이 버그, 박승환한테 도와달라고. '재현 로그 첨부함'." | `add`(help+body) |
| "내 작업에 댓글 새로 뭐 올라왔어?" | `list` |
| "이 인프라 세팅 범위 밖. 황성현님한테 도움 요청." | `add`(help) |
| "이예진 코멘트에 '확인했습니다, 반영할게요' 답 댓글." | `list`+`add` |
| "송수용 작업에 '어디까지 됐는지 공유해줄 수 있어?' 댓글." | 타인 문의 |
| "3일째 막혔어. 황성진한테 도움, '캐시 무효화 부분 봐줘'." | `add`(help+사유) |
| "스탠드업 전에 이 태스크 댓글 전부 훑어줘." | `list` |
| "이 API 스펙 문서 어디 있는지 댓글로 물어봐줘." | 질문형 댓글 |
| "이 작업 오승훈한테 도움 요청만, 할 말은 없고." | `add`(help만) |
| "박승환 작업에 무슨 얘기 오갔는지 댓글 읽어줘." | `list` (타인 읽기) |
| "디자인 QA 이예진한테 도움 요청. '세로 태블릿 반응형 깨짐 확인 부탁'." | `add`(help+사유) |
| "댓글 확인하고, 아무도 안 물어봤으면 '이 부분 결정 필요' 남겨줘." | `list`+`add` |
| "이 마케팅 배너에 '문구 최종본으로 교체했습니다' 코멘트." | `add` (메모) |
| "나 오늘 연차라 이 작업 못 봐. 황성진한테 대신 봐달라고 도움 요청." | `add`(help) |

### 7-8. 복합 워크플로우 (여러 도구 연결)

| 프롬프트 | 도구 흐름 |
| --- | --- |
| "오늘까지인데 못 끝낸 내 작업들 전부 내일 오전으로 밀어줘." | `get_my_day`→`list_tasks`→`move_task` |
| "Now보드 이슈 작업들 각 담당자한테 '어디서 막혔는지' 도움요청 댓글." | `get_now_board`→`add_task_comment` |
| "회의록 액션 중 담당·마감 다 있는 것만 Task로 확정, 나머진 남겨둬." | `list_action_candidates`→`confirm_action` |
| "회의록 액션 담당 빈 거 박승환, 마감 금요일로 채운 뒤 확정." | `list`→`update`→`confirm` |
| "'내일 2시~4시 랜딩 카피 검수' 작업으로 등록." | `parse_task_input`→`create_task` |
| "이번 주 내가 맡은 거 몇 개 중 몇 개 끝냈는지 완료율로." | `list_tasks` (집계) |
| "팀 이슈·홀드 몇 건인지 보고 누가 제일 막혀있는지 요약." | `get_team_status`+`get_now_board` |
| "오승훈 오늘 여유 있으면 'API 문서 정리' 작업 오승훈 앞으로 새로." | `get_team_status`→`create_task` |
| "결제요청에서 입금 들어온 거 완료로, 안 온 건 그대로." | `list_payment_requests`→`update_payment_status` |
| "'디자인 시안 3안' 막혔어. 홀드, 클라 피드백 대기, 목요일 재확인, 이예진 도움." | `get_my_day`→`change_task_status` |
| "'결제 연동 테스트'랑 '결제 QA' 거의 같은데 뒤엣걸 앞으로 합쳐." | `list_tasks`→`change_task_status` (merged) |
| "Que 리뉴얼 프로젝트 안 끝난 것 중 이번주 넘어가는 건 다음주로 재배치." | `list_tasks`→`move_task` |
| "오늘 요약 보여주고, 오후 회의랑 겹치는 작업 저녁으로 옮겨줘." | `get_my_day`→`move_task` |
| "김리원이 내 작업에 단 도움요청 댓글 보고 '내일 같이 보자' 답글." | `get_my_day`→`list_task_comments`→`add_task_comment` |
| "회의록 액션 중 담당·마감 없어 확정 못 하는 건 보류로." | `list_action_candidates`→`resolve_action` (held) |
| "오늘 답 안 한 체크인 다 '작업중'으로, '서버 배포'만 이슈(스테이징 다운)." | `get_my_day`→`respond_checkin` |
| "Now보드 내 것만 보고 오늘 이미 끝낸 것들 완료 처리." | `get_now_board`(mine)→`change_task_status` |
| "기한 지난 작업들 찾아 리스케줄 필요한 건 바꾸고 관리자한테 보고 댓글." | `list_tasks`→`change_task_status`→`add_task_comment` |
| "송수용 과부하면 그 사람 작업에 '이거 나눠서 하자' 도움 댓글." | `get_team_status`→`add_task_comment` |
| "회의에서 나온 할 일 세 개 파싱해서 담당·시간 확인하고 이예진 앞으로 등록." | `parse_task_input`→`create_task` (×3) |
| "이번달 취소된 결제 취소로 정리하고, 대기 오래된 건 목록으로." | `list_payment_requests`→`update_payment_status` |
| "오늘 할 일 중 못 할 것 같은 건 리스케줄로 바꾼 뒤 새 일정으로 옮겨." | `get_my_day`→`change_task_status`→`move_task` |
| "회의록에서 담당만 있고 마감 없는 액션들 마감 다음주 수요일·프로젝트 온보딩으로 확정." | `list`→`update`→`confirm` |
| "새 결제 요청(국민은행 디자인 외주비 120만원, 다음주 화요일) 넣고 대기 상태 확인." | `create_payment_request`→`list_payment_requests` |
