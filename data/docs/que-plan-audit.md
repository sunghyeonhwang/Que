# Que 기획서 대조 감사 — 정합성 + 편의기능·단축키 (2026-07-05)

기획서(`que-product-plan.md`) 의도 대비 실제 구현을 8개 영역으로 병렬 대조. 각 항목 status: ✅built(의도대로) · 🟡partial · ❌missing · 🔀diverged(다르게/의도이탈).

## 전체 요약

- 대조 항목 109개: ✅57 🟡26 ❌16 🔀10
- 개선 아이디어 69개(아래 각 영역 + 종합)

---

## 캘린더·일정

### 정합성
| 항목 | | 기획 | 메모 |
| --- | :-: | --- | --- |
| 회사 캘린더 읽기 전용 표시 | ✅ | 77 | /schedule 전체가 읽기 전용. calendar-data.ts:88 movable=event.source==="que"&&!isPrivate 로 외부 일정은 이동 불가. week-calendar.tsx:204 비이동 항목에 Lock 아이콘. |
| 회의·외부·휴가·이벤트 함께 표시 | ✅ | 78 | calendar-data.ts에서 tasks+calendarEvents를 items로 병합해 한 그리드에 표시(102). 단 종류(휴가/회사이벤트) 세분 라벨은 없이 이벤트로 일괄 처리. |
| 비공개 일정 제목 숨김 | ✅ | 79 | calendar-data.ts:78-82 canViewPrivateEventDetail로 권한 없으면 제목을 감춤. 다만 표기가 기획의 '비공개 일정'이 아니라 '자리비움'(파일 주석 6에 의도 명시). 라벨 통일만 확인 필요. |
| 기간 스위처 일간/주간/월간 | ✅ | 420-424 | schedule-header.tsx RANGE_LABELS(day/week/month) + page.tsx 분기 렌더. 이전/오늘/다음 이동도 range 단위로 정확(shift 46-55). |
| 뷰·기간 URL 반영(링크 공유) | ✅ | 429 | ?range=&date= 를 화이트리스트 파싱(page.tsx 12-23)하고 헤더가 router.push로 URL 갱신(schedule-header 37-41). 공유 링크 가능. |
| 마지막 사용 뷰·기간 기억 | ❌ | 428 | 영속(localStorage/cookie) 없음. 파라미터 없이 진입하면 항상 주간·오늘로 폴백(page.tsx 13,22). 다음 방문 유지 미구현. |
| 뷰 스위처 기본형/전체 멤버/타임라인 | 🔀 | 414-418, 443-471 | /schedule에는 뷰 스위처가 없고 기본형(시간축)만 출시. 전체멤버·타임라인 뷰 컴포넌트는 components/calendar/*(members-grid·timeline-grid·timeline-vertical)에 남아있으나 고아(라이브 페이지가 import 안 함, /calendar는 redirect). CLAUDE.md가 /schedule을 '주/월 캘린더'로 축소한 결과. |
| 드래그 일정 이동(주간/월간 칸 이동) | 🔀 | 89-92, 606-609 | 신규 /schedule은 드래그 전무(week-calendar·month-view 읽기 전용, components/schedule에 drag 코드 0건). 재일정은 드래그가 아니라 날짜/시간 입력 폼으로 대체돼 '오늘의 상태 시트'(task-status-sheet.tsx 251-281)에만 생존. CLAUDE.md의 '팀현황/오늘 시트로 유지' 방침과 일치하나, 기획의 캘린더 화면 드래그 UX와는 이탈. |
| 이동 즉시 반영 + 실패 시 원위치 복귀 | 🟡 | 93, 608 | 현행 재일정은 폼 제출→서버 왕복→revalidatePath(actions.ts 18-19)+토스트. '즉시 이동 후 실패 시 되돌림'식 낙관적 UI 아님. 구 use-move.ts에 있던 낙관 패턴은 고아화. |
| 이동 내역 변경 로그 기록(누가/언제/어디→어디) | ✅ | 94, 610 | moveTask/moveEvent/moveMilestone 모두 db.move*({actorId,via:"web"},...)로 ChangeLog 기록(calendar/actions.ts 80-141). via 태깅 준수. |
| 외부·비공개 자리비움 드래그 불가 | ✅ | 95, 441 | movable 플래그가 외부/비공개에 false(calendar-data 88), Lock 아이콘 노출(week-calendar 204). 애초에 드래그가 없어 실질 차단되고 도메인 규칙도 서버에서 강제. |
| 마일스톤 이동 시 연결 작업 함께 이동 확인 | ❌ | 96 | moveMilestoneToDateAction(actions.ts 121-142)은 연결 작업 동반 이동 확인 프롬프트 없음. 마일스톤 자체가 /schedule에 렌더되지 않음. |
| 마일스톤 표시(다이아몬드/상단 띠) | ❌ | 436, 466 | calendar-data가 milestones를 로드(94-99)하지만 week-calendar·month-view는 data.items(task+event)만 사용, 마일스톤 미렌더(components/schedule에 milestone 참조 0건). CLAUDE.md상 마일스톤은 '재설계 IA 보류'라 의도적 미연결이나 기획 표시규칙과는 갭. |
| 문제발생 빨강 상태색 | ✅ | 437 | event-color.ts:42 taskStatus==="issue"→RED 스와치. 색 의미(red=문제) 준수. |
| 홀드 노랑(amber) 상태색 | ❌ | 438 | event-color.ts는 issue만 특례 처리하고 on_hold는 케이스 없음 → id 해시 파스텔 팔레트로 임의 배정. amber=주의/대기 색 의미 미반영. |
| 완료 항목 흐리게 | ❌ | 439 | done 작업 흐리게 처리 없음. calendar-data는 cancelled/merged만 제외(54)하고 done은 일반 팔레트로 그대로 표시. eventSwatch에 dim 처리 없음. |
| 회사 일정=중립색 / 내 작업=강조색 | 🔀 | 433-434 | task와 event 모두 kind+id 해시로 동일 파스텔 팔레트 배정(event-color 43). '회사=중립·내작업=강조', '내작업 vs 타인작업' 구분 없음. 소유자 색은 아바타에만 사용. |
| 다른 사람 작업 담당자 라벨 | 🟡 | 435 | 주간 블록은 소유자 이니셜 아바타 노출하나 !compact(height≥64)일 때만(week-calendar 216-226). 짧은 블록·월간 뷰(month-view)에는 담당자 표기 없음. |

### 개선 아이디어
- **캘린더 전용 키보드 내비게이션: ←/→ 이전·다음 기간, T=오늘, D/W/M=일/주/월 전환** _(중간)_ — 현재 모든 이동이 마우스 버튼 전용(schedule-header). 운영 중 빠른 날짜 스캔에 키보드가 필수. ⌘K 팔레트는 있지만 캘린더 내 이동 단축키는 없음. 태블릿 외 데스크톱 검수 해상도(FHD·1366)에서 특히 유효.
- **이벤트 블록 Enter/클릭 시 상세 열기(작업 상태 시트/일정 팝오버 연결)** _(중간)_ — week-calendar.tsx:184-186 EventBlock이 role=button·tabIndex=0인데 onClick/onKeyDown이 없어 포커스만 잡고 아무 동작 안 함(오해 소지 있는 a11y·죽은 탭 스톱). 여기에 재일정 폼(moveTaskToDateAction)이나 상세를 연결하면 캘린더에서 바로 조작 가능.
- **헤더 제목을 기간 범위로 표기(주간="7월 1–7일", 월간="2026년 7월")** _(작음)_ — page.tsx:66-68이 주간·월간에서도 anchor 단일 날짜만 출력해 현재 보는 기간이 헷갈림. range에 맞춘 범위 문자열로 바꾸면 맥락이 명확.
- **상태 기반 색 보정: on_hold=amber, done=흐리게** _(작음)_ — 기획 표시규칙(438-439)과 색 의미 고정 규칙을 직접 충족. event-color.ts에 케이스 2개 + opacity만 추가하면 됨. 저비용·기획 갭 즉시 해소.
- **이미 로드된 마일스톤을 상단 띠/다이아몬드로 렌더** _(중간)_ — calendar-data가 data.milestones를 이미 반환하는데 뷰가 버림. 기획 핵심 표시요소(436·466)이고 데이터가 있어 렌더만 추가하면 됨(보류 방침이면 최소 범례라도).
- **주간·요일 헤더의 날짜 숫자 클릭 시 해당 일 '일간' 뷰로 드릴다운** _(작음)_ — 현재 일간 진입은 드롭다운으로 range 변경 후에만 가능. 날짜 클릭→일간은 캘린더 표준 인터랙션이고 date 파라미터 재사용으로 저비용.
- **주간/일간 그리드 진입 시 현재 시각(또는 첫 일정)으로 자동 스크롤** _(작음)_ — 그리드가 08–21시로 길고(GRID_HEIGHT) 항상 최상단에서 열려 오후 일정을 보려면 매번 스크롤해야 함. now 지표는 이미 계산되므로 스크롤만 걸면 됨.
- **사람별·프로젝트별 필터 활성화(현재 '준비 중' 비활성)** _(중간)_ — 기획 캘린더 기본형 요구(416)이자 헤더 필터 버튼이 이미 자리만 있고 aria-disabled. 8인 팀에서 특정 담당자/프로젝트만 보는 니즈가 큼. URL 파라미터로 구동하면 공유 링크와도 일관.
- **날짜 점프용 미니 달력(월 선택) 추가** _(중간)_ — 현재는 prev/next 스텝 이동만 가능해 몇 달 뒤로 가려면 클릭이 많음. 헤더에 date picker를 붙여 임의 날짜로 즉시 이동.

---

## 작업 생성·상태·상세

### 정합성
| 항목 | | 기획 | 메모 |
| --- | :-: | --- | --- |
| 자연어 빠른입력 + 등록 전 확인 단계 | ✅ | 102, 596-603 | quick-add.tsx는 parse(해석)→확인 카드(제목/담당자/날짜/시간 편집=수정)→등록/취소 흐름을 구현. parseTaskAction/route.ts는 저장하지 않고 초안+questions만 반환(parse-task.ts). 플로우 5단계(입력→추출→확인카드→등록/수정/취소→표시)와 일치. |
| 자연어 예시 해석(내일 오후3시 황성현씨 상세페이지 QA) | ✅ | 107-121 | parse-task.ts가 상대날짜(오늘/내일/모레/글피)·요일·명시일자, 오전/오후·시·반·분, 이름+호칭/조사(씨·님·가·이·한테), 명령어 꼬리 제거로 제목 추출. 기획 예시와 동일 결과. 담당 없으면 본인, 모호하면 questions로 확인. |
| 작업 생성 필드: 작업명·담당자·프로젝트·날짜/시간·예상 소요·설명 | 🟡 | 100 | UI(quick-add.tsx)와 createTaskAction(today/actions.ts:73)은 작업명·담당자·날짜/시간만 전달. core createTask(mock-db.ts:327)와 domain Task는 projectId·description·estimatedHours를 지원하지만 어떤 생성 UI도 이를 입력받지 않음. parse-task도 프로젝트/예상소요는 추출 안 함. |
| 작업이 개인+팀 캘린더/오늘 화면에 반영 | ✅ | 101, 104, 602 | createTask는 visibility 'team'으로 생성(mock-db.ts:376); today/page.tsx의 타임라인·내 작업 표·요약에 노출. 등록 토스트도 '캘린더와 담당자 오늘 화면에 표시' 안내. 단 revalidatePath는 '/today'만 호출(팀 현황/일정은 force-dynamic 재조회에 의존). |
| 시간변경·담당자변경·상태변경·삭제는 변경 로그에 기록 | 🟡 | 105 | 상태변경(changeTaskStatus)·일정이동(moveTask)은 logChange+statusLogs로 기록됨(mock-db.ts:152-171). 그러나 개인 task 계층에 담당자 변경(reassign)·삭제 메서드가 없음 — deleteTask는 /projects PM 계층(pm-data.ts:320, 메뉴 제외 in-memory)에만 존재. 담당자변경·삭제는 today/now 흐름에서 불가. |
| 8개 MVP 상태값(예정·진행중·완료·시간변경필요·홀드·문제발생·취소·병합) | ✅ | 125-134 | TASK_STATUS_LABELS(labels.ts:12-21)에 8개 모두 존재. status-badge.tsx가 색+보조 아이콘 매핑(색 의미 고정 준수: 진행/완료=default, 문제/취소=destructive, 대기=secondary). |
| 주요 상태 버튼 항상 노출 [진행중][완료][시간변경][문제발생][홀드] | ✅ | 490-493 | task-status-sheet.tsx STATUS_CHOICES는 in_progress·done·needs_reschedule·on_hold·issue·cancelled·merged 7개를 항상 그리드로 노출(기획 5개의 상위집합, 취소·병합 추가). 단 '예정'(scheduled)으로 되돌리는 버튼은 없음(초기 상태로 간주). |
| 문제발생/홀드 추가 정보 4종(사유·다음 액션·도움 필요한 사람·재확인 시간) | ✅ | 136-141 | status-detail-form.tsx가 4필드 모두 수집(사유 필수, 나머지 선택). 서버 rules.ts assertStatusDetail이 issue/on_hold에 사유 필수를 강제하고 statusLogs에 reason/nextAction/helpUserId/nextCheckAt 저장. 다만 recheckAt은 '오늘' 날짜에 시간만 붙여(status-detail-form.tsx:40-42) 내일 재확인이면 과거 시각이 됨. |
| 작업 상세 패널 요소(작업명·담당자·프로젝트·시간·상태·설명·체크리스트·관련 일정·상태 변경 기록·댓글/메모) | 🟡 | 479-488 | task-status-sheet.tsx 표시: 작업명·시간·상태·설명(metaText)·댓글(+상태버튼·일정변경 폼). 누락: 담당자/프로젝트 명시 표시, 체크리스트, 관련 일정, 상태 변경 기록. 특히 statusLogs(상태 변경 기록)는 데이터로 저장되지만 패널에 렌더링되지 않음. |
| 문제발생 플로우(선택→정보입력→주의영역→PM 알림→상태로그) | 🟡 | 622-629 | 624-625(issue 버튼→StatusDetailForm)·626(today '주의 필요' 카드+data.attention 노출)·628(statusLogs 기록)은 built. 627 '프로젝트 담당자에게 알림'은 미구현 — changeTaskStatus(mock-db.ts:121)에 알림 생성 로직 없음(notifications-bell는 존재하나 issue 전환이 이벤트를 push하지 않음). |

### 개선 아이디어
- **확인 카드 키보드 제출: ⌘/Ctrl+Enter=등록, Esc=취소** _(작음)_ — quick-add.tsx는 입력창 Enter로 해석까지만 되고, 확인 카드에서는 마우스 클릭으로만 등록/취소 가능. 자연어 빠른입력의 핵심 가치가 키보드 연속 흐름인데 마지막 단계에서 손이 마우스로 감. 카드에 onKeyDown(⌘Enter→register, Esc→cancel) 추가로 완결.
- **연속 등록: 등록 성공 후 입력창에 자동 포커스 복귀** _(작음)_ — 현재 register 성공 시 text만 비우고 포커스는 유지 안 됨. 회의 후 여러 작업을 몰아 넣을 때 매번 입력창을 다시 클릭해야 함. inputRef로 onSuccess 시 focus() 호출하면 '해석→등록→바로 다음 입력' 리듬이 살아남.
- **상세 Sheet 상태 버튼에 키보드 단축키(숫자 1~7 또는 첫 글자)** _(중간)_ — task-status-sheet.tsx의 7개 상태 버튼은 마우스/터치 전용. Sheet 열린 상태에서 숫자키로 즉시 상태 전환(문제발생/홀드는 상세폼으로 진입)하면 파워유저의 상태 정리가 빨라짐. aria-keyshortcuts로 접근성도 유지.
- **작업 목록 키보드 내비게이션(j/k 이동, Enter 상세, x 완료 토글)** _(중간)_ — my-task-table.tsx는 행 전체가 Sheet 트리거 버튼이지만 행 간 키보드 이동 수단이 없어 Tab을 여러 번 눌러야 함. 8인 팀이 매일 보는 표이므로 j/k 커서 + x로 done 토글(TaskDoneCheckbox 재사용)이 체감 큰 효율. 태블릿 외 데스크톱 검수 해상도에서 특히 유효.
- **상태 변경 기록(statusLogs)을 상세 패널에 타임라인으로 표시** _(중간)_ — 기획 상세패널 필수 요소(487 '상태 변경 기록')인데 현재 미표시. 데이터는 이미 statusLogs(from/to·사유·다음액션·도움·재확인)로 저장되어 있어 조회만 붙이면 됨. 문제발생 이력·사유를 그 자리에서 확인해 병목 파악에 직접 기여.
- **상태 변경/완료 토스트에 '실행 취소' 액션** _(중간)_ — my-task-table의 원클릭 완료 체크박스와 Sheet의 상태 버튼은 오클릭 시 즉시 커밋되고 되돌리려면 상태를 다시 골라야 함. sonner 토스트에 undo 액션(직전 from 상태로 changeTaskStatus)을 달면 오조작 복구가 1클릭. 상태변경도 ChangeLog에 남으므로 감사 추적 유지.
- **확인 카드에 프로젝트·예상 소요 시간·설명 선택 입력 추가** _(중간)_ — 기획 100은 6개 필드를 명시하고 core createTask/domain Task도 projectId·estimatedHours·description를 지원하는데 UI가 전혀 받지 않아 업무량 현황·프로젝트 연결의 입력원이 비어 있음. 확인 카드에 접이식 선택 필드로 추가하면 모델 변경 없이 정합성 회복.
- **상세 Sheet에 담당자 변경·작업 삭제(본인/관리자, 로그 기록) 추가** _(큼)_ — 기획 105가 담당자 변경·삭제를 변경 로그 대상으로 명시하지만 개인 task 계층에 두 연산이 없음(삭제는 메뉴 제외된 PM 계층에만). Sheet에 재배정 Select + 삭제(확인) 버튼을 두고 core reassign/deleteTask를 logChange와 함께 추가하면 실사용 필수 동작을 채움.
- **재확인 시간에 날짜 선택 또는 '내일 오전' 프리셋 제공** _(작음)_ — status-detail-form.tsx는 recheckAt을 항상 오늘 날짜에 시간만 붙여 저장해, 밤에 '내일 오전 재확인'을 입력하면 과거 시각이 되어 주의영역/알림 스케줄이 어긋남. 날짜 필드 추가 또는 입력 시각이 과거면 익일로 롤오버하는 보정만으로 해결.

---

## 자동 체크인

### 정합성
| 항목 | | 기획 | 메모 |
| --- | :-: | --- | --- |
| 체크인 생성 스케줄러 (대상·멱등) | ✅ | 기획서 169-172, 189-193 / 749-758 | mock-db.ts:727 syncCheckIns가 status==='scheduled' + startAt이 오늘 시작~now 사이인 Que Task에만 체크인을 만들고, this.checkIns.some(c=>c.taskId===task.id)로 작업당 1회(멱등)를 보장. this.tasks만 순회하므로 CalendarEvent(회의/휴가/외부)는 원천 제외 → 정책 '회의·휴가·외부엔 안 묻는다', 'Que 작업만'과 일치. ChangeLog 미기록(시스템 동작)도 주석대로 처리(mock-db.ts:726). |
| 이미 상태 업데이트된 작업 재질문 금지 | ✅ | 기획서 193 | 생성 단계에서 status==='scheduled'만 대상(mock-db.ts:733)이고, 노출 단계 today-data.ts:120에서 ACTIVE_STATUSES(scheduled/in_progress/needs_reschedule/on_hold/issue) 아닌 작업(done/cancelled/merged)은 flatMap으로 걸러 다시 묻지 않음. |
| 체크인 선택지 7종 | 🟡 | 기획서 179-187 | 작업중/완료/시간변경필요/문제발생/필요없어짐/병합/나중에답변 7종이 domain.ts:292 checkInResponseSchema·labels.ts:37·checkin-panel.tsx:15에 모두 존재. 단 '병합(merged)'은 CheckInPanel에서 실제 응답 대신 toast 안내로 우회(checkin-panel.tsx:60-63)하고, 응답 API bodySchema(answer/route.ts:6-9)에 mergedIntoTaskId가 없어 API/MCP(respond_checkin)로 merged 응답 시 changeTaskStatus가 '병합 대상 필요'로 던짐(mock-db.ts:136). merged 응답 경로만 미완성. |
| CheckIn 모델 필드 | ✅ | 기획서 749-758 | domain.ts:303 checkInSchema에 id·taskId·assigneeId·scheduledAt·answeredAt(optional)·response(optional)·followUpRequired 전부 존재 — 기획 모델과 1:1 일치. |
| 체크인 응답 → 상태·팀 현황판 반영 (플로우 3·4) | ✅ | 기획서 618-619 | answerCheckIn(mock-db.ts:993)이 응답을 statusByResponse로 매핑해 changeTaskStatus를 거쳐 규칙/ChangeLog 동일 적용 후 answeredAt/response/followUpRequired 갱신. team-data.ts:78·248 isAwaiting가 미응답+later&followUpRequired를 '응답 대기'로 집계해 현황판에 반영. CheckInPanel도 '응답하면 팀 현황판·프로젝트에 즉시 반영' 문구 노출(checkin-panel.tsx:47). |
| 본인(또는 관리자)만 응답 | ✅ | core 규칙 '본인 작업만 수정' | answerCheckIn(mock-db.ts:1006)이 actor.role!=='admin' && checkIn.assigneeId!==actor.id면 NOT_AUTHORIZED. 재응답 방지도 answeredAt && response!=='later'로 처리(mock-db.ts:1009) — later는 재응답 허용. |
| 문제발생 추가정보 + 관련자 통지 (플로우 5) | 🟡 | 기획서 620, 622-627 | issue 선택 시 CheckInPanel이 StatusDetailForm(사유·다음액션·도움필요·재확인)을 열어 detail을 받고 changeTaskStatus→attention queue에 오름(현황판 주의영역). 다만 '프로젝트 담당자에게 알림이 간다'(627)에 해당하는 능동 알림(notifications-bell 연동/푸시)은 없음 — attention queue 노출로만 대체. |
| '질문이 전송된다'(플로우 2)의 전송 채널 | 🟡 | 기획서 617 | 체크인 질문은 /today의 자동 체크인 카드(today/page.tsx:137-143, 기획 예시 문구와 동일 포맷)와 KPI '체크인 응답 필요' 카운트로 수동 노출될 뿐, 알림벨/푸시로 '전송'되지는 않음. grep상 notifications-bell 등 어디에도 체크인 연동 없음. answer/route.ts 주석대로 Slack Bot은 2단계 예정 — mock 단계 한계로 수용 가능하나 능동 전송은 미구현. |
| 방해금지 시간·나중에답변 설정 | 🟡 | 기획서 194 | '나중에 답변'(later)은 응답 선택지로 구현되어 followUpRequired로 재노출됨. 그러나 '방해금지 시간(quiet hours)'은 코드 전역에 존재하지 않음(방해금지/quiet/dnd/snooze 전부 0 hits). 즉 사용자가 설정할 수 있어야 한다는 두 축 중 방해금지 시간이 missing이고, later도 스누즈 지연 없이 다음 로드 때 즉시 다시 나타남(today-data.ts:115). |
| Vercel Cron으로 스케줄러 전환 | 🟡 | mock-db.ts:725 주석 / cron/sync/route.ts 의도 | /api/cron/sync 라우트는 CRON_SECRET+timingSafeEqual로 견고하게 구현(route.ts)돼 있으나, vercel.json에 crons 배열이 없어 실제 스케줄 등록이 안 됨 — 프로덕션에서 이 엔드포인트는 자동 호출되지 않는다. 현재는 db.ts:28-32/37 lazy fallback(QUE_CRON_ACTIVE!=='1')이 조회 시점 생성을 대신 수행. 즉 '사용자 트래픽과 분리' 목표는 미실현이고 라우트는 사실상 미연결 상태. |

### 개선 아이디어
- **체크인 응답 키보드 단축키 (숫자키 1~7 = 선택지, j/k = 체크인 간 이동, Enter = 확정)** _(작음)_ — CheckInPanel은 반복 응답이 잦은데 지금은 전부 마우스/터치. /today 진입 시 대기 체크인에 포커스링을 주고 숫자키로 즉시 응답하면 아침 몰림 처리가 빨라짐. 기존 role='group' 버튼에 accessKey/키핸들러만 얹으면 됨.
- **⌘K 커맨드 팔레트에 '다음 대기 체크인 응답' 액션 추가** _(중간)_ — 이미 command-palette.tsx가 있으므로 어느 화면에서든 대기 체크인으로 점프하는 커맨드 하나만 추가하면 '질문이 전송된다'의 능동성을 저비용으로 보완. today-data.pendingCheckIns를 재사용.
- **대기 체크인을 알림벨(notifications-bell)·사이드바 today 뱃지로 노출** _(중간)_ — 현재 체크인은 /today를 직접 열어야만 보임 — 기획 플로우2 '전송'의 취지와 어긋남. 확인필요 뱃지 패턴을 그대로 재사용해 미응답 수를 벨/메뉴에 카운트하면 능동 리마인드가 됨. 알림벨은 이미 존재.
- **'나중에 답변' 스누즈 시간 선택 (30분/1시간/오늘 오후)** _(중간)_ — 지금 later는 followUpRequired로 다음 로드에 즉시 재노출돼 사실상 지연 효과가 없음. CheckIn에 snoozeUntil을 두고 그 전엔 pending 필터에서 제외하면 기획 194 '나중에 답변 설정'이 실제 defer로 작동.
- **방해금지 시간(quiet hours) 설정 + 스케줄러 반영** _(중간)_ — 기획 194 미구현 축. 설정에 근무/방해금지 시간대를 두고 syncCheckIns가 그 시간엔 생성을 보류(또는 scheduledAt을 다음 근무 시작으로 미룸)하면 비근무 시간 체크인 스팸을 막음. 설정 화면(테마/밀도 등)이 이미 있어 필드 추가 위주.
- **체크인 패널에서 병합(merged) 직접 응답 지원** _(작음)_ — 현재 merged는 toast로 타임라인 이동을 요구하고 API bodySchema엔 mergedIntoTaskId조차 없어 MCP respond_checkin으로도 불가. task-status-sheet의 병합 대상 Select를 CheckInPanel에 인라인 재사용하고 answer/route.ts bodySchema·POST에 mergedIntoTaskId를 추가하면 7선택지가 모두 한 자리에서 완결.
- **대기 체크인 일괄 응답 (예: '모두 작업중')** _(중간)_ — 아침에 여러 예정 작업이 동시에 체크인을 만들면 개별 응답이 번거로움. 상단에 '전체 작업중/전체 완료' 벌크 버튼을 두면 반복 클릭을 크게 줄임. 서버는 answerCheckIn 루프 호출로 재사용.

---

## 팀 현황·히트맵·Now·추가아이디어

### 정합성
| 항목 | | 기획 | 메모 |
| --- | :-: | --- | --- |
| 팀현황 상단 요약(진행중·문제발생·홀드·마감임박·응답대기) | ✅ | 502 / 200-207 | team/page.tsx:50-56 5개 지표 카드, team-data.ts:79-87에서 집계. 기획 5요소 그대로. |
| 팀현황 사람별 오늘 시간표 | ✅ | 503 / 202-203 | team/page.tsx:128-199. 멤버별 행+시간칩, task칩은 TaskStatusSheet로 열람/편집(canEdit), 이벤트는 readonly. team-data.ts:91-154. |
| 팀현황 주의 필요(Attention Queue) | 🟡 | 504 / 898-907 | team-data.ts:156-198 — 문제발생·홀드·응답대기·도움요청은 있으나 기획 Attention 항목 중 '마감 임박·일정 충돌·담당자 없음'은 큐에 포함 안 됨(마감임박은 요약 카운트로만, 충돌은 별도 카드). page:200-214. |
| 팀현황 일정 충돌 목록 + 감지 | 🟡 | 505 / 208 / 909 | 감지·리스트·멤버별 충돌뱃지 built(team-data.ts:90-151, page:216-235). 그러나 기획 909-916의 '시간 변경 제안' 액션은 없음 — 카드가 읽기전용 텍스트라 충돌을 보고도 재일정 불가. |
| 팀현황 최근 변경 내역 | ✅ | 506 / 209 | page:237-251, getRecentChangeLogs(6). ChangeLog 재사용. |
| 관리자 화면 초점 '어디가 막혔나' | 🔀 | 211 | 시간표가 좌측 minmax(1fr) 큰 영역, Attention/충돌/블로커는 우측 26rem 보조(page:127). 시각적 우선순위가 '누가 일하나(시간표)'에 감 — 병목 큐가 부차적으로 배치됨. |
| Now 표 컬럼(시간/마감·구분·제목·담당자·상태·출처) | ✅ | 383-390 / 326-333 | now/page.tsx:99-155. task/event/action 통합 정렬(now-data.ts:106-108), 담당자 미지정은 빨강 표기. |
| Now 문제/홀드/담당자 누락 요약 + 상단 한 줄 설명 | ✅ | 391 / 381 | 요약 카드 문제·홀드·오늘마감·담당자확인필요(now/page:46-52, now-data:112-124). 고정 subtitle now/page:58. |
| Now에서 일정 충돌 빠른 확인 | ❌ | 393 | 기획 393 '캘린더를 안 봐도 오늘 처리할 Action과 일정 충돌을 빠르게 확인'. now-data.ts에 충돌 계산 없음 — 충돌은 팀현황에만. Now 요약/표에 충돌 지표 부재. |
| 히트맵 멤버×일 월 그리드(초록 강도) | ✅ | 219 / 514-515 | heatmap-data.ts:48-125 월 앵커 그리드, performance-heatmap.tsx 그리드+5단계 범례(70-81). 색 단독 회피 위해 시간 수치 병기. |
| 히트맵 예상 소요 시간·문제/홀드/마감임박 가중치 반영 | 🟡 | 221-223 / 230 / 518 | score=시간+가중(heatmap-data:89-97, issue+2·hold+1·마감임박+1)로 강도 색엔 반영. 그러나 셀 표시는 hours만(component:62), 가중치·문제/홀드는 색으로만 암시 — 명시 배지·수치 없음. 기획 518 '가중치 표시' 미충족. |
| 히트맵 예정 작업 수 표시 | 🟡 | 220 | taskCount는 heatmap-data:98에서 계산되나 화면엔 hours만, taskCount는 aria-label에만(component:55) — 시각적 미표시. |
| 과부하/여유 멤버 요약 | ❌ | 224-225 / 517 | heatmap-data.ts:120-123에서 overloaded/relaxed 계산하지만 performance-heatmap.tsx가 data.days·rows만 렌더 — 과부하/여유 요약을 화면에 전혀 표시 안 함. '팀 부하 현황' 표(LowPerformersTable)는 기한초과/완료라 다른 지표. |
| 멤버별 총 작업량 막대 그래프 | ❌ | 516 | heatmap-data가 totalScore/totalHours를 row별로 계산(103-105)하나 히트맵 카드에 막대 미렌더. 관리자 리포트 '부하 분포' 막대(admin-report.tsx:174-190)가 유사하나 성과/히트맵 화면엔 없음. |
| 셀 클릭 → 해당 날짜 작업 목록/캘린더/팀현황 이동 | ❌ | 232 / 519 | performance-heatmap.tsx:49-64 셀이 정적 div(role=gridcell), Link/onClick 없음 — 기획 명시 드릴다운 미구현. 히트맵이 '어디 몰렸나'만 보여주고 행동으로 못 이어짐. |
| 과부하 기준 팀 설정 조정 | ❌ | 231 | heatmap-data.ts:121 임계값 Math.max(avg*1.5, 6) 하드코딩. 설정 화면은 테마/밀도/폰트/비번만 — 팀 단위 과부하 임계 조정 없음. |
| 히트맵/리포트 개인 평가 아님·병목 조정 원칙 | ✅ | 229 / 211 | 성과 페이지 문구(page:71-72), 리포트 부하는 고정 멤버순(리더보드 금지, report-data.ts:152-173), 감시 아님 주석 명시. 원칙 준수. |
| 관리자 리포트 뷰(진척·병목·부하) | ✅ | 211 / 229 | team?view=report 관리자 전용 가드(page:32, report-data.ts:84), 진척·병목 유입·현재 블로커·부하 분포(admin-report.tsx). 개인 순위 없음. |
| 하루 마감 요약(오늘 완료/미완료/내일 이동/문제) | ❌ | 918-925 | 추가아이디어 §4. 스탠드업이 어제/오늘/막힘(standup-grid)만 커버 — 퇴근 전 마감 요약 화면·컴포넌트 없음. |
| 계획 vs 실제 시간 기록 | ❌ | 927-934 | 추가아이디어 §5. estimatedHours만 사용(heatmap/report), 실제 시작/완료·변경사유·반복지연 트래킹 없음. |

### 개선 아이디어
- **Attention Queue·현재 블로커·스탠드업 행을 클릭하면 작업 Sheet(상태·댓글·도움요청·재확인)를 그 자리에서 열기** _(중간)_ — 지금 시간표 칩만 TaskStatusSheet에 연결(team/page:186)되고 우측 병목 큐·리포트 블로커는 정적 텍스트라 '여기 막혔다'를 보고도 못 누른다. 진단→행동을 끊어 운영 도구 본질을 약화. 이미 있는 TaskStatusSheet 재사용.
- **히트맵 셀을 링크로 만들어 해당 멤버·날짜 작업 목록(팀현황/작업목록 필터)으로 이동** _(중간)_ — 기획 232·519가 명시한 드릴다운인데 셀이 정적 div. 과부하 셀을 눌러 바로 재배정 대상 작업을 열 수 있어야 히트맵이 '조정 도구'가 된다.
- **이미 계산된 overloaded/relaxed와 멤버별 totalHours를 히트맵 카드에 배지·미니 막대로 렌더** _(작음)_ — heatmap-data.ts:104-123이 총부하·과부하/여유를 이미 산출하는데 화면에 안 나온다. 렌더만 추가하면 기획 516·517을 데이터 변경 없이 충족.
- **팀현황 뷰(보드/스탠드업/리포트)·Now 필터(전체/내항목/문제)에 숫자키 1·2·3 단축키 + 마지막 뷰 URL 기억** _(작음)_ — 현재 탭이 Link뿐이라 마우스 필수. 관리자가 하루에 수십 번 오가는 화면 — 숫자키 전환과 마지막 뷰 유지(기획 428 뷰상태 기억 확장)로 왕복 비용 절감.
- **⌘K 빠른 액션 확장: '문제만 보기(/now?filter=issue)'·'스탠드업'·'리포트'·'내가 막힌 작업' 딥링크 추가** _(작음)_ — 현재 빠른 액션이 '작업 추가' 하나뿐(command-palette.tsx:40-42). 운영자가 자주 가는 병목 뷰로 키보드만으로 점프 가능해진다.
- **Now 표·시간표·블로커 리스트에 j/k 행 이동 + Enter 열기(로빙 tabindex)** _(중간)_ — 팔레트 밖 목록은 키보드 내비가 없다. 운영 표를 키보드만으로 훑고 열면 마우스 없이 스탠드업/리뷰 진행 가능. 태블릿 외장 키보드 사용성도 향상.
- **전역 '?' 단축키로 단축키 치트시트 오버레이** _(작음)_ — ⌘K 외 단축키 발견 경로가 없다. 새 단축키를 추가할수록 발견성이 필요 — /help 라우트 이동 대신 즉시 오버레이.
- **일정 충돌 카드에 '시간 변경 제안' 액션(충돌 작업 재일정 Sheet 즉시 열기)** _(중간)_ — 기획 909-916은 감지에 그치지 않고 변경 제안까지 요구. 현재는 텍스트 나열만. 충돌 당사자 작업의 재일정을 한 번에 열어주면 병목 해소 루프가 닫힌다.
- **성과 화면 4개 월 셀렉터(hm/cm/lm/ot) 동기화 옵션 + 마지막 기간 기억** _(중간)_ — 카드마다 개별 월 파라미터라(heatmap/page:58-62) '이 달 전체 보기'에 4번 조작. 하나의 기간 컨트롤로 동기화하고 마지막 값을 기억하면 반복 조작 제거(기획 428 취지 확장).
- **팀현황 자동 새로고침 + 'n분 전 기준' 표기** _(중간)_ — force-dynamic 서버 렌더라 열어두면 계속 stale. 상시 띄우는 운영 보드에서 병목 최신성이 핵심 — 폴링 또는 기준 시각 표기로 오래된 화면 오판 방지.
- **하루 마감 요약 카드(오늘 완료·미완료·내일 이동·문제) — 팀현황/Now 하단 또는 ⌘K 액션** _(중간)_ — 기획 추가아이디어 §4가 미구현. 스탠드업(어제/오늘/막힘)의 저녁 짝. 미완료 이월·문제 정리를 퇴근 전 한 화면에서.

---

## 회의록·Action

### 정합성
| 항목 | | 기획 | 메모 |
| --- | :-: | --- | --- |
| Plaud Note MD 업로드 + 필수 필드(회의명·회의일·프로젝트·참석자·업로드자·공개범위·추출상태) | ✅ | 기획 281-290, 529-533 | upload-note-form.tsx가 파일(.md/.markdown/.txt) 클라이언트 읽기 후 서버액션 전달, 회의명/회의일/프로젝트 Select/참석자 Checkbox 그리드 모두 존재. uploaderId는 actor.id로 서버에서 세팅(mock-db.ts:430), extractionStatus='pending' 자동. 8개 관리정보 전부 충족. |
| 업로드 회의록 원문(MD) 보존 | ✅ | 기획 294, 538 | markdownBody 그대로 저장(mock-db.ts:432), note-list.tsx Sheet에서 <pre whitespace-pre-wrap>로 원문 열람. 다만 렌더링이 아닌 raw 텍스트라 markdown 서식은 표시 안 됨(원문 보존 목적엔 부합). |
| 회의록↔프로젝트 연결 | ✅ | 기획 295 | projectId 저장·목록/Action에 프로젝트명 표시. 추출된 후보는 note.projectId를 상속(mock-db.ts:490). |
| Action 후보에 원문 문장+파일명 연결(추적성) | ✅ | 기획 296, 318, 538 | sourceText=원문 bullet 전체(mock-db.ts:487), action-row가 '원문: "…" — 파일명' 인라인 표시. 확정 Task description에도 '회의록 출처: 파일명 — 원문' 기록(mock-db.ts:274). |
| 회의록 단위 좁은 열람 권한(2026-07-03 확정: 지정 인원+관리자만) | ✅ | 기획 297-298 | visibility team/admin/restricted + restrictedUserIds. canViewMeetingNote(rules.ts:134)가 admin·업로더 항상 허용, restricted는 지정인원만. 요약카드·Action목록·검색 모두 canViewMeetingNote로 필터(notes-summary.ts:24, action/page.tsx:26). 기본값 team. |
| '프로젝트 참여자만' 공개 범위(plan 297 원문) | 🟡 | 기획 297 | MeetingNote 타입엔 visibility='project'가 있으나 업로드 폼은 team/admin/restricted만 제공(upload-note-form.tsx:156)하고 canViewMeetingNote는 'project'를 별도 처리 안 해 사실상 전체공개로 폴백(rules.ts:139-141). 2026-07-03 'restricted'가 대체 수단으로 도입돼 의도는 커버되나 프로젝트 멤버십 기반 자동 스코프는 미구현. |
| 추출: 결정사항/할 일/이슈를 구분해 후보화 | 🔀 | 기획 302, 650 | extractActionItems(mock-db.ts:470)는 정규식 /^\s*[-*]\s+/ 로 모든 bullet 라인을 무차별 후보화. 결정/할일/이슈 분류 없음, 번호목록·헤딩·문단은 미추출. '(담당: 이름)'만 파싱하고 마감일은 아예 추출 안 함(주석 491: 항상 needs_review로 시작). |
| 추출 방식 규칙기반 기본 + LLM 옵션(2026-07-03 확정) | 🟡 | 기획 320 | 규칙 기반은 built(mock-db.ts:449~). LLM 기반 추출 경로는 코어·웹 어디에도 없음(grep으로 llm/openai/anthropic 미검출). 기획이 LLM은 '옵션으로 추가'라 후순위 허용 범위지만 현재 미구현. |
| 담당자·마감일 있는 후보만 Task 생성, 없으면 확인 필요 | ✅ | 기획 315-316, 652-653 | confirmActionItem이 assertCanConfirmActionItem 실패 시 needs_review로 강등+ChangeLog(mock-db.ts:240-258). updateActionItem은 담당+마감 갖춰지면 candidate로 승격(mock-db.ts:541). 도메인 규칙 정확히 강제. |
| Action 확정 필수정보(제목·담당자·마감일·프로젝트·원문출처·상태) | ✅ | 기획 304-311, 544-551 | action-row.tsx에 담당자 Select·마감일 date input·상태 배지·원문출처·프로젝트명 모두 노출. 생성/보류/무시 3버튼 존재. |
| 생성 Task를 담당자 캘린더·Now 화면에 표시 | ✅ | 기획 317, 654 | Task source='action_item'로 생성(mock-db.ts:275), now/page.tsx가 Action행+캘린더 통합표로 표시하고 needs_review는 destructive 배지. 상단 'Action 확정하러 가기' 링크로 /action 연결. |
| 잘못 추출된 후보 무시/보류 | ✅ | 기획 319, 551 | setActionItemStatus(held/ignored) + assertCanResolveActionItem 권한(담당자·업로더·관리자). 무시 버튼은 red 톤으로 색 의미 준수. |
| 확인 필요 항목을 Now 화면과 '팀 현황판'에 표시 | 🟡 | 기획 554, 660 | Now(/now)는 표시(built). 그러나 팀 현황(/team standup-grid·admin-report)은 action_item/needs_review를 전혀 참조하지 않음(grep 미검출). 확정 전 후보가 팀 현황판엔 안 떠 '회의 후 할 일이 사라지지 않게' 목적의 절반만 충족. |
| 사이드바 '확인필요' 뱃지 = 확인 필요 수 | ✅ | CLAUDE.md IA | layout.tsx:34 menuBadges['/meeting-notes']=noteSummary.needsReview. 열람권한 있는 회의록의 needs_review만 집계(notes-summary.ts:32)해 권한 누수 없음. |
| 회의록↔Action 탭 병합 + 상단 요약 카드 | ✅ | CLAUDE.md IA | NoteTabs로 /meeting-notes·/action 전환, 두 화면 공통 NoteSummaryCards(회의록·추출대기·Action후보·확인필요). amber/blue/violet 색 의미 고정 준수. |

### 개선 아이디어
- **⌘K 커맨드 팔레트에 이 영역 빠른 액션 추가: '회의록 업로드'(/meeting-notes)·'Action 확정'(/action)** _(작음)_ — 현재 QUICK_ACTIONS는 '작업 추가' 하나뿐(command-palette.tsx:40). 회의 직후 가장 잦은 진입점인데 팔레트에서 바로 못 감. 검색은 기존 그룹(회의록/Action)으로 이미 됨.
- **Action 확정 큐에 키보드 트리아지: j/k 행 이동, C=Task 생성, H=보류, X=무시, A=담당자 포커스** _(중간)_ — /action은 회의 후보를 줄줄이 처리하는 큐 화면인데 지금은 전부 마우스. 8인 팀이 회의당 10~20건을 넘기려면 키보드 연속 처리가 체감 큼. 색·라벨은 그대로 두고 핸들러만 추가.
- **'Task 생성' 저장 선행 강제 제거 — 담당/마감 변경분을 확정 시 자동 저장 후 생성(원클릭)** _(작음)_ — 현재 dirty면 '저장'을 먼저 눌러야 Task 생성 활성(action-row.tsx:126 disabled=dirty). 담당·마감 넣고 바로 만들려는 가장 흔한 흐름이 2클릭+안내툴팁으로 막힘. confirmActionItem 전에 updateActionItem을 한 번 태우면 됨.
- **다건 선택 후 일괄 처리: 같은 담당자 지정·일괄 무시·일괄 보류** _(중간)_ — 회의 하나에서 후보가 대량으로 나오면 한 명에게 몰리는 경우가 많음. 행별 반복 입력이 비효율. 체크박스+상단 bulk 바로 해결.
- **원문 미리보기를 markdown 렌더 + 후보 클릭 시 해당 sourceText로 스크롤/하이라이트 연동** _(중간)_ — 기획 538 '후보와 원문 문장을 항상 함께 볼 수 있어야'가 핵심. 지금은 후보 옆 인라인 원문만 있고 회의록 Sheet는 raw <pre>라 어느 대목에서 나왔는지 위치 확인이 어려움. AI/규칙 오추출 검수 정확도↑.
- **규칙 기반 추출 강화: 본문에서 마감일('~까지','7/10','내일') 파싱해 dueAt 프리필 + 결정/할일/이슈 태깅** _(중간)_ — 현재 마감일은 아예 추출 안 하고(mock-db.ts:491) 담당자만 '(담당:이름)' 패턴에 의존. Plaud 회의록 자연문에서 날짜를 뽑으면 needs_review→candidate 자동 승격이 늘어 확정 클릭이 줄어�듦. 기획 302의 결정/할일/이슈 구분과도 맞물림.
- **확인 필요(미확정) Action을 팀 현황(/team) Attention 영역에도 노출** _(중간)_ — 기획 554·660이 명시한 '팀 현황판 표시'가 현재 Now에만 있고 팀 현황엔 없음. 관리자·PM 상시 화면에서 회의 후 미처리 후보가 안 보이면 '할 일이 사라짐' 위험. 색은 violet(응답대기) 재사용.
- **파일 입력에 드래그앤드롭 + 다중 파일 업로드** _(작음)_ — 태블릿 우선 도구인데 <input type=file> 단일 선택뿐(upload-note-form.tsx:87). 여러 회의록 몰아 올릴 때 반복 왕복이 큼. 파일명→회의명 자동채움 로직은 이미 있어 확장 쉬움.
- **무시/보류에 실행취소(undo) 토스트, Action 큐에 상태 필터 칩(확인필요/보류/생성됨)** _(작음)_ — 무시는 준-파괴적이라 오조작 복구 수단이 필요. 또 현재 필터는 회의록별(FilterChip)만 있어 '확인 필요만' 보기가 안 됨. 상태 칩으로 미처리분에 집중하면 트리아지 속도↑.

---

## 결제/입금

### 정합성
| 항목 | | 기획 | 메모 |
| --- | :-: | --- | --- |
| PaymentRequest 모델(id·title·requesterId·bankName·accountNumber·amount·description·dueAt·category·status·lastChangedBy·lastChangedAt·createdAt) | ✅ | 759-774 | domain.ts:216-232 paymentRequestSchema에 13개 필드 전부 존재. accountNumber는 '민감 정보 마스킹' 주석까지 포함. 완전 일치. |
| 입력 필드: 제목·은행명·계좌번호·금액·내용·마감일·분류 | ✅ | 252-260, 578-579 | payment-form.tsx에 7개 필드 모두 구현(제목/은행/계좌/금액 number/마감일 date/분류 Select/내용 Textarea). 분류는 구독·물류·라이선스·외주·교육·기타 하드코딩(기획은 값 미지정). |
| 상태 대기/완료/취소 | ✅ | 262-266, 580 | domain.ts:213 paymentStatusSchema=waiting|done|cancelled, labels.ts:23-27 대기/완료/취소. 기본 생성 상태 waiting(mock-db.ts:1086, 기획 633과 일치). |
| 멤버가 본인 결제/입금 요청을 등록 | ✅ | 270, 632-633 | createPaymentRequestAction→db.createPaymentRequest, requesterId=actor.id 강제(mock-db.ts:1079). 기본 대기 상태. |
| 관리자 또는 '결제 담당자'가 입금 처리·상태 갱신 | 🟡 | 271-272, 634-635 | role 모델이 admin|member 2종뿐(domain.ts:11)이라 '결제 담당자' 전용 권한이 없음. mock-db.ts:1109는 admin만 완료/취소·되돌리기 가능(payment-data.ts:74 canComplete=admin). 기획의 '결제 담당자' 역할은 admin으로 흡수됨 — 8인 팀 단순 권한 모델상 합리적이나 기획 문구와 어긋남. (요청자 본인 취소는 추가 허용 mock-db.ts:1108.) |
| 상태 변경을 변경 로그(ChangeLog)에 기록 | ✅ | 273, 636 | mock-db.ts:1121-1127 status_change 로그(before/after·via). 등록도 create 로그(1090-1095). core 규칙 via 기록 준수. |
| 마감일이 지난 대기 항목을 결제 화면 상단에 노출 | ✅ | 274, 637, 583 | payment-data.ts:43-52 정렬 rank(마감초과 대기=0 → 대기=1 → 나머지=2). payment-list.tsx:47 마감초과 행 red 테두리+'마감 초과' 배지, dueSoon 24h '마감 임박' 배지도 추가. |
| 계좌번호·금액은 민감정보 — 권한 있는 사용자에게만 상세 노출 | ✅ | 275 | payment-data.ts:32-35,54,62-63 admin+요청자 본인만 원본, 그 외 계좌 '•••• 1234'·금액 '금액 비공개'. API(route.ts:6-9)도 동일 getPaymentData 마스킹 계층 경유, 검색결과(search-data.ts:101-113)는 제목/분류만 노출·금액/계좌 제외. 기획은 '설정을 둘 수 있다'(옵션)인데 항상 강제 — 더 강한 구현. |
| 결제 화면 요소: 등록 폼·상태 요약(대기/완료/취소)·요청 목록·상태 변경 버튼·마감 임박/초과 표시 | ✅ | 576-583 | page.tsx:22-53 요약 카드 4종(대기 amber·마감초과 red·완료 green·취소 neutral, 색 의미 고정 준수), PaymentForm+PaymentList 2열. 입금 완료/취소/대기로 되돌리기 버튼 payment-list.tsx:69-106. |
| 자연어 입력은 등록 전 확인 카드를 거친다(core 규칙) | ❌ | 598-602 | 결제 영역은 자연어 입력 경로가 없음(폼 직접 입력만). 기획 자연어 플로우는 작업 생성용이라 결제 미적용은 의도적 범위 — 위반 아님. 참고용. |

### 개선 아이디어
- **결제 등록 폼을 native <form>으로 감싸고 Enter/⌘+Enter 제출 지원** _(작음)_ — payment-form.tsx는 <form> 없이 Button onClick만 있어(grep 결과 onSubmit/onKeyDown 없음) 마지막 필드에서 Enter가 먹지 않고 마우스로 '등록'을 눌러야 함. 반복 등록이 잦은 화면이라 키보드 제출이 큰 편의. 접근성(엔터 제출)·중복 제출 방지(canSubmit 이미 존재)도 함께 개선.
- **⌘K 커맨드 팔레트 빠른 액션에 '결제 요청 추가'(→/payments) 추가** _(작음)_ — command-palette.tsx:40-42 QUICK_ACTIONS에 '작업 추가'만 있음. 결제는 메신저에 흩어지기 쉬운 항목(기획 585)이라 어디서든 ⌘K로 바로 등록 화면 진입하면 등록 누락을 줄임. 라우트만 추가하면 되는 저비용.
- **금액 입력에 천단위 콤마 실시간 표시(1,200,000)** _(중간)_ — payment-form.tsx:88-95 type=number 원본이라 0이 6개면 자릿수 오입력이 쉬움(toLocaleString 미적용). 목록은 amountDisplay로 콤마를 붙이는데 입력 시점엔 없어 비대칭. 오타로 인한 결제 금액 실수를 예방.
- **요약 카드(대기/마감초과/완료/취소)를 클릭 시 목록 필터로 연동(URL 쿼리 구동)** _(중간)_ — page.tsx 요약 카드는 표시만 하고 목록은 전체를 정렬만 함 — 상태/분류/요청자 필터가 없음. 대기 건만, 또는 마감초과만 보는 니즈가 큰데(PM이 '누가 언제까지' 확인, 기획 585) 필터가 없어 스크롤로 찾아야 함. 성과/일정처럼 URL 구동 필터로 통일.
- **'취소' 버튼에 확인 다이얼로그(또는 undo 토스트) 추가** _(작음)_ — payment-list.tsx:87 취소는 onClick 즉시 실행 — 40px+ 터치 대상이라 오탭 위험. 요청자 본인 취소는 admin 없이 되돌릴 수 없어(mock-db.ts:1109 되돌리기는 admin만) 실수 시 복구 어려움. 최소한 취소에는 확인 스텝 권장.
- **각 행에 마지막 상태 변경 이력 한 줄 표시(예: '2일 전 홍길동 입금 완료')** _(작음)_ — 모델에 lastChangedBy·lastChangedAt이 있고 ChangeLog도 남기는데(기획 273) 화면엔 안 보임. 누가 언제 처리했는지가 결제 화면의 핵심 책임소재(기획 585)라 행에 노출하면 '입금했나?' 재확인 메신저 문의를 줄임. 데이터는 이미 존재.
- **관리자 뷰에 '대기 금액 합계' 표기(권한자 한정)** _(중간)_ — 요약은 건수만 세고(page.tsx:22-27) 총 지출 규모가 안 보임. admin에게만 대기 상태 amount 합계를 노출하면 현금 유출 파악에 유용. 금액은 민감정보라 admin 한정으로 마스킹 계층(payment-data.ts) 안에서 계산해야 함.

---

## 권한·공개범위·마일스톤·프로젝트

### 정합성
| 항목 | | 기획 | 메모 |
| --- | :-: | --- | --- |
| 편집 권한 4단계(본인/프로젝트 담당자/관리자/타인은 요청만) | ✅ | 기획서 147-153 | rules.ts:70-84 canEditTask/assertCanEditTask가 admin·assignee·owner·project.ownerId를 정확히 구현. mock-db.ts:133,182에서 이동/수정 시 실제로 assert해 서버 계층 강제. team-data.ts:108이 canEdit로 UI 노출까지 반영. |
| 드래그 이동도 수정 권한과 동일 처리(153) | ✅ | 기획서 153 | 캘린더 이동 경로(mock-db.ts move 계열 133/182)가 일반 수정과 같은 assertCanEditTask를 통과. 외부/비공개 일정은 canMoveCalendarEvent(rules.ts:87-89)로 별도 차단. |
| 비공개 일정: 팀원엔 '자리비움', 관리자 예외 열람(161) | ✅ | 기획서 161 | rules.ts:95-97 canViewPrivateEventDetail(본인·admin). now-data:78·home-data:185·calendar-data:78·today-data:101·team-data:124 다섯 데이터층 전부에서 마스킹 적용. 코어 테스트(rules.test.ts:584-606)까지 존재. |
| Que 작업 기본 공개 = 팀 전체(158, 2026-07-03 확정) | ✅ | 기획서 158 | domain.ts:78,98 visibility 기본값 'team'. 프로젝트 단위 제한은 예외적으로만 쓰기로 확정. |
| 프로젝트 작업을 '프로젝트 참여자에게만' 노출(159) | 🟡 | 기획서 159 | Task/Event visibility는 team|private 2값뿐(domain.ts:63,78,98). 프로젝트 참여자 스코프는 회의록에만 존재(domain.ts:139 team|project|admin|restricted). 2026-07-03 '예외적으로만' 결정과 부합하나 작업 단위 project 공개범위는 미구현. |
| 변경 가시성: 누가/언제/무엇을 ChangeLog에 기록(164-166) | ✅ | 기획서 164-166 | mock-db 전 mutation이 logChange(ctx via)로 기록(마일스톤 create/update도 665,713). 열람 권한 없는 회의록 Action은 alerts-data.ts:35-37에서 제외해 가시성 규칙 준수. |
| 변경이 마일스톤/담당자/충돌/문제발생에 영향 시 Attention Queue 등재(167) | 🟡 | 기획서 167 | Attention은 상태 기반: alerts-data는 issue·needs_review·overdue·payment를, today-data.ts:137은 issue/on_hold를, conflictSuggestions로 일정충돌을 올림. 그러나 '마일스톤 위험'·'담당자 변경'은 큐에 오르지 않음(변경 트리거가 아니라 현재 상태 스캔 방식). |
| 마일스톤을 캘린더 상단에 다이아몬드로 구분 표시(83-84) | ✅ | 기획서 83-84 | month-grid:60·week-grid:59·timeline-grid:237·timeline-vertical:145에서 lucide Diamond로 일반 작업과 구분 렌더. |
| 연결 작업이 지연되면 마일스톤 위험 상태 표시(85) | 🔀 | 기획서 85 | riskStatus는 수동 선택만(milestone-list.tsx:50-54 Select, mock-db.ts:705-710). 마일스톤↔작업 연결이 데이터 모델에 없어 지연 자동 위험 산출 미구현. 표시(정상/주의/지연)와 수동 변경만 존재. |
| 마일스톤 생성·수정·이동은 프로젝트 담당자/관리자만(150-151) | ✅ | 기획서 150-151 | rules.ts:159 canManageMilestone + mock-db.ts:640,690 role/ownerId 재검증(서버 강제). UI는 planning-data.ts:63 canManage로 컨트롤 노출 제어. 코어 테스트로 우회 주입까지 방어(rules.test.ts:740-771). |
| 프로젝트 뷰 구성: 개요·마일스톤 목록·연결 작업·상태별·문제발생/홀드·변경 기록·병합 작업(238-247) | 🔀 | 기획서 238-247 | /projects는 기획의 조회형 프로젝트 뷰가 아니라 신규 칸반 PM 도구(목록/보드/캘린더+태스크 드로어, project-view.tsx). 마일스톤 목록·문제발생/홀드 섹션·일정 변경 기록·병합된 작업 없음. 마일스톤은 /planning으로 분리됨. CLAUDE.md대로 in-memory mock이라 메뉴 제외+쓰기 차단(미리보기). |
| 프로젝트 상태별 작업 목록 = MVP 상태값(243 / 125-134) | 🔀 | 기획서 243 | pm-data.ts는 코어 도메인 TaskStatus(예정/진행중/완료/시간변경필요/홀드/문제발생/취소/병합)를 쓰지 않고 임의 칸반 그룹(backlog/todo/doing/done)+PmPriority만 사용. 문제발생/홀드가 PM 모델에 아예 없어 '상태별'이 기획 상태 집합과 불일치. |

### 개선 아이디어
- **슬래시(/) 키로 상단 전역 검색 포커스** _(작음)_ — 현재 진입 단축키는 ⌘K뿐(global-search.tsx엔 전용 키 없음). GitHub/Linear 관습인 '/' 포커스를 추가하면 마우스 없이 검색 시작이 즉시 가능. input 포커스 중엔 무시하도록 가드만 두면 됨.
- **g-체วง 화면 이동 단축키(g→h 홈, g→s 일정, g→p 프로젝트, g→m 반복·마일스톤 등)** _(중간)_ — 메뉴가 8개인데 이동은 ⌘K 팔레트 열고 타이핑해야만 가능. menu.ts를 단일 소스로 쓰는 팔레트가 이미 있으니 같은 목록으로 g-prefix 순차 키맵을 만들면 관리자·PM의 반복 화면 전환이 크게 빨라짐(Gmail/Linear 패턴).
- **태스크 상세 드로어에 ⌘S/⌘Enter 저장 단축키** _(작음)_ — task-detail-drawer.tsx의 저장은 버튼 클릭뿐(dirty 계산은 이미 있음). 편집→저장이 잦은 화면이라 키 저장이 드로어를 닫지 않고 커밋하는 흐름을 만들어 줌. Esc 닫기는 Radix Sheet 기본으로 이미 동작.
- **상단바 검색 드롭다운에 ↑/↓ 결과 이동 지원** _(작음)_ — global-search.tsx는 Enter=첫 결과만 지원하고 방향키 이동이 없음(팔레트는 cmdk가 처리하지만 상단바는 별도). 결과가 여러 그룹일 때 키보드로 원하는 항목까지 내려가 선택할 수 없어 마우스 의존. activeIndex 상태 추가로 해결.
- **커맨드 팔레트에 마일스톤·프로젝트 검색 종류와 '마일스톤 추가' 빠른 액션 추가** _(중간)_ — SearchKind가 task/note/action/payment/member뿐이라(command-palette.tsx:28) 마일스톤·프로젝트를 팔레트에서 못 찾음. 빠른 액션도 '작업 추가' 하나뿐. 이 영역(마일스톤/프로젝트) 진입을 팔레트에서 바로 열면 /planning 왕복이 준다.
- **마일스톤 위험 상태를 연결 작업 지연에서 자동 제안(기획 85 정합)** _(큼)_ — 현재 위험은 수동 선택만이라 기획의 '연결 작업 지연 시 위험 표시' 의도가 비어 있음. 마일스톤↔작업 연결 필드를 추가하고, 연결 작업이 기한초과면 '지연 제안' 배지를 띄워 담당자가 한 번에 승인하도록 하면 병목 조기 노출이라는 도구 목적에 정확히 부합.
- **/projects 안에 프로젝트 개요 패널(마일스톤·문제발생/홀드·변경 기록 집계)** _(중간)_ — 기획 프로젝트 뷰 구성(238-247) 중 마일스톤 목록·문제발생/홀드·변경 기록·병합 작업이 /projects에 없음. 코어 db에서 해당 프로젝트의 milestones·issue/hold task·changelog를 읽어 읽기 전용 요약 패널로 얹으면(쓰기 차단과 무관) 기획 의도의 상당 부분을 저비용으로 복원.
- **관리자가 비공개 일정 원본을 볼 때 '관리자 열람 중' 표식/툴팁** _(작음)_ — canViewPrivateEventDetail로 admin은 원본 제목을 그대로 보지만(calendar-data 등) 그것이 특권 열람임을 나타내는 시각 신호가 없음. 작은 배지/툴팁을 붙이면 감시 도구가 아니라는 톤을 지키면서 특권 열람을 스스로 인지·감사 가능하게 함.

---

## 전역 UX·단축키·접근성·알림정책 (편의기능 중심)

### 정합성
| 항목 | | 기획 | 메모 |
| --- | :-: | --- | --- |
| 핵심원칙#1 '묻지 않아도 보인다' — 병목이 한 화면에 보임 | ✅ | que-product-plan.md:55-56 | 상단바 알림 벨(notifications-bell.tsx)+사이드바 확인필요 뱃지(layout.tsx:34, sidebar-nav.tsx:49)+전역 검색(global-search.tsx)이 문제발생/기한초과/확인필요/결제 신호를 상시 노출. alerts-data.ts 정렬도 '문제→확인필요→결제→기한초과' 고신호 우선이라 원칙과 정합. |
| 핵심원칙#2 '상태 변경은 3초 안·원터치'를 전역 단축키/팔레트에서 처리 | 🟡 | que-product-plan.md:58-59 | 커맨드 팔레트의 '빠른 액션'은 '작업 추가' 1개뿐이고 그마저 /today로 라우팅만 함(command-palette.tsx:40-42) — 입력에 포커스도 안 줌. 작업중/완료/문제발생/시간변경 같은 '원터치 상태 변경'은 전역 계층(⌘K)에 전혀 없고 각 작업 화면에만 존재. 전역 빠른 처리 관점에서 미충족. |
| 정보구조 '권장 메뉴'(오늘/Now/캘린더/히트맵/알림/설정…) | 🔀 | que-product-plan.md:340-352 | menu.ts는 2026-07-04 재설계 IA(홈/일정/성과/작업목록/팀/팀현황/확인필요/결제요청)로 의도적으로 다름 — CLAUDE.md가 정본을 menu.ts로 지정하고 문서화함. 다만 기획서 이 절은 낡은 IA가 그대로 남아 표류(source-of-truth 문서인데 stale). 감시가 아니라 정합성 기준선이 흐려지는 문서 드리프트. |
| 메뉴 통합 제안: 회의록·Action 병합 + 히트맵을 팀현황 탭으로 | 🟡 | que-product-plan.md:371-373 | 회의록·Action → '확인필요'(/meeting-notes·/action 탭 병합, menu.ts:53-58, match로 active)로 채택 완료. 그러나 히트맵은 '성과'(/heatmap)로 독립 최상위 메뉴 유지(menu.ts:43) — 팀현황 탭 흡수 제안은 미채택. 두 제안 중 하나만 반영. |
| IA 정본 일치 요구: 'CLAUDE.md 이 절이 menu.ts와 항상 일치' | 🔀 | CLAUDE.md 메뉴 구조 절 / menu.ts:60,67 | menu.ts는 메뉴 섹션에 '반복·마일스톤'(/planning)과 '기타'에 'MCP·CLI'(/tools)를 실제 노출하는데, CLAUDE.md의 정본 메뉴 목록엔 둘 다 없고 마일스톤/반복은 '메뉴에 없음(보류·미연결)'으로 적혀 있음. CLAUDE.md가 경고한 '불일치가 고아 라우트를 낳음'이 문서 자체에서 발생 — 정본 문서와 코드가 어긋남. |
| 알림 채널: Slack 기본·딥링크·인터랙티브 응답·방해금지 보류 | ❌ | que-product-plan.md:822-829 | 구현은 인앱 벨(조회 전용)만. Slack 발송/딥링크/체크인 인터랙티브 응답/방해금지 시 보류 로직 없음. CLAUDE.md가 '알림(설정)=프리뷰 전 보류'로 의도적 후순위화한 상태라 '의도적 미구현'이지만, 기획의 알림 시스템 대비 현 벨은 임시 운영신호 표면에 그침. |
| 보내는 알림 목록(체크인·도움요청·일정충돌·하루요약·상태변경 등 11종) | 🟡 | que-product-plan.md:831-843 | 벨은 4종만 표면화: 문제발생/확인필요/결제 마감초과/기한초과(alerts-data.ts:41-102). 작업 시작 체크인·도움 요청·일정 충돌·하루 요약·관련 작업 시간/담당자/상태 변경·결제 상태 변경·회의록 Task 담당자 지정은 벨에 없음. 특히 '작업 시작 체크인'은 성공지표와 직결되는데 누락. |
| 보내지 않는 알림(완료/이미 업데이트된 작업 반복 금지) | ✅ | que-product-plan.md:845-852 | OPEN set(alerts-data.ts:26)로 완료/취소 제외, 문제발생 dedup(issueTaskIds, 87-92)로 이미 잡힌 작업 중복 방지, 결제도 waiting+마감초과만. 다만 '사용자 방해금지 시간대' 제외는 DND 개념 자체가 없어 미적용. |
| 변경 공유 화면 표시(팀 현황판/오늘 화면에 내 관련 변경) | 🟡 | que-product-plan.md:878-883 | 감사 대상 전역 표면(벨)은 문제발생·확인필요만 반영. '즉시 공유할 변경'의 시간변경/담당자변경/드래그이동/삭제·병합(860-866)은 벨에 없고 기획상 팀 캘린더 '수정됨' 배지·팀 현황판 패널로 처리(타 화면 소관). 전역 알림에서 변경 공유는 얇게만 연결됨. |
| 성공지표: 미응답 체크인 수 / '지금 뭐 하나요' 질문 감소 | ❌ | que-product-plan.md:983-984 | 미응답 체크인을 드러내는 전역 신호가 없음(벨·뱃지 모두 체크인 미포함). 팀원의 미응답을 관리자·본인이 전역에서 볼 표면이 없어 해당 KPI를 견인하는 UX가 비어 있음. |
| 리스크 대응: 감시 도구로 느껴질 위험 → 병목/도움/충돌 강조 | ✅ | que-product-plan.md:990-996 | alerts-data.ts:4-6 주석이 '감시가 아니라 어디가 막혔나'를 명시하고, 근무추적 표현 없이 병목(문제/기한/확인필요) 중심으로 구성. 원칙과 정합. |
| 리스크 대응: 알림 피로도 → 방해금지·나중에 답변·중복 억제 | 🟡 | que-product-plan.md:1008-1014 | 중복 억제(dedup)와 표시 캡(DISPLAY_CAP=8)은 있으나, 방해금지(DND)·스누즈·'나중에 답변'·읽음/무시 처리가 벨에 전혀 없음. 알림은 매 요청 실시간 재계산이라 사용자가 특정 알림을 끄거나 미룰 수 없음. |
| 태블릿 우선: 좁은 화면에서 전역 검색/팔레트 터치 진입 | ❌ | CLAUDE.md 화면 원칙(태블릿 우선·터치 44px) | 커맨드 팔레트는 ⌘K/Ctrl+K 키보드로만 열림(command-palette.tsx:76-85) — 팔레트를 여는 탭 트리거가 어디에도 없음. 게다가 상단 GlobalSearch는 sm 미만에서 숨김(layout.tsx:60 'hidden … sm:block'). 물리 키보드 없는 태블릿/모바일에선 전역 검색·이동 진입점이 사실상 부재. 도움말(help-content)은 '아래의 빠른 검색을 쓰라'고 안내하나 그 진입 버튼이 실제로 없음. |
| 접근성: 포커스 링·combobox 시맨틱·동적 aria-label | ✅ | que-product-plan.md:53-71 / CLAUDE.md 화면 원칙 | global-search는 role=combobox+aria-expanded/controls+listbox(56-113), 사이드바/검색결과 focus-visible 아웃라인, 벨 aria-label 동적(count 반영), 팔레트는 cmdk 기반 ↑↓/Enter/Esc 접근성 내장, lang='ko'. 기본 접근성은 견고. (아래 idea의 skip-link·상단검색 화살표 내비만 미비.) |

### 개선 아이디어
- **'?' 전역 단축키로 단축키 치트시트 오버레이(또는 /help#shortcuts) 열기** _(작음)_ — 현재 단축키는 ⌘K 하나뿐인데 그 존재를 help 산문에만 묻어둠. '?'는 웹 앱 표준 관례라 발견성이 크게 오름. 기획의 '3초 안 처리' 지향과도 맞음.
- **입력 필드 밖에서 '/'(또는 's')로 상단 전역 검색에 포커스** _(작음)_ — 검색이 가장 잦은 동작인데 지금은 마우스로 클릭하거나 ⌘K 팔레트를 여는 우회뿐. 한 키로 검색창 포커스는 키보드 내비 속도를 직접 높임. isContentEditable/INPUT 가드만 붙이면 충돌 없음.
- **커맨드 팔레트 '빠른 액션' 확장 + '작업 추가'는 QuickAdd 입력 포커스로 연결** _(중간)_ — 핵심원칙#2 '원터치 상태 변경'을 전역에서 실현하려면 팔레트에 작업중/완료/문제발생/시간변경 진입과, '작업 추가' 선택 시 /today의 자연어 입력(quick-add)에 즉시 포커스가 필요. 지금은 라우팅만 하고 커서를 안 줘 한 단계 더 클릭해야 함.
- **모바일/태블릿용 검색·팔레트 터치 트리거(상단바 검색 아이콘 버튼) 추가** _(작음)_ — sm 미만에서 상단 검색이 숨겨지고 팔레트는 키보드로만 열려, 태블릿 우선 정책과 달리 전역 검색/이동 진입점이 사라짐. 헤더에 44px 검색 아이콘을 두어 탭하면 팔레트를 여는 것만으로 해결.
- **알림 벨에 스누즈·읽음/무시·'모두 확인' + 설정의 방해금지(DND) 시간대** _(중간)_ — 기획 알림 피로도 대응(1008-1014)·방해금지(829,850)가 코드에 전혀 없음. 실시간 재계산 구조라 사용자가 알림을 끌 방법이 없어 피로 누적. 최소한 클라이언트 dismiss/스누즈와 설정의 DND 창부터.
- **미응답 체크인을 벨/뱃지에 별도 신호로 노출** _(중간)_ — 성공지표(983-984: 미응답 체크인 수, '지금 뭐 하나' 질문 감소)를 견인하는 표면이 지금 전무. 관리자·본인이 전역에서 미응답을 바로 보게 하면 기획이 노린 행동 변화를 직접 지원.
- **상단 GlobalSearch 드롭다운에 ↑/↓ 화살표 하이라이트 내비(roving/aria-activedescendant)** _(중간)_ — 지금은 Enter가 무조건 첫 결과로만 가고 화살표로 항목을 옮길 수 없음(global-search.tsx:98-106). 팔레트(cmdk)엔 있는데 상단 검색엔 없어 일관성·키보드 접근성이 떨어짐. combobox 시맨틱은 이미 있으니 활성 항목 연결만 추가.
- **본문 바로가기(skip-to-content) 링크 + <main>에 id/tabindex** _(작음)_ — 사이드바 메뉴가 매 페이지 앞에 있어 키보드/스크린리더 사용자가 본문 도달까지 반복 탭. layout.tsx:70의 <main>에 id를 주고 첫 포커스 가능한 skip 링크만 추가하면 표준 접근성 충족.
- **알림 벨 '전체 보기'를 미래 /notifications 허브로 연결하고 발송 이력 축적** _(중간)_ — 기획(828)은 인앱 알림 화면을 Slack 발송 내역 허브로 규정. 현재는 캡(8건) 초과분을 '외 N건 더' 텍스트로만 알리고 갈 곳이 없음(notifications-bell.tsx:76-80). 허브 라우트 자리를 먼저 잡아두면 Slack 2단계 전환 시 자연스럽게 확장.

---

