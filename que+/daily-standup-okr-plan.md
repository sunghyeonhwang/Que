# Que — 데일리 스탠드업 + OKR 초기 기획 (2026-07-11)

## Context — 왜 만드는가

Que는 전 구성원의 작업 상태(어제/오늘/막힘)를 이미 데이터로 알고 있다. 이를 활용해 **매일 오전 10시 데일리 스탠드업**을 온라인(비동기)으로 돌리고, 그 위에 **OKR(분기 목표 + 월 핵심결과)** 개념을 얹어 "오늘 하는 일이 어떤 목표에 기여하는가"를 드러낸다. 월요일 베타 시작의 운영 리듬(마일스톤 회의 → 데일리 스탠드업)을 도구가 받치는 것이 목적. **이번 산출물은 초기 기획이며 코드 구현은 하지 않는다.**

사용자 확정 방향: ①스탠드업+OKR 통합 기획(구현은 단계 분리) ②비동기 체크인 + AI(LLM) 진행 보조 ③OKR 주기 = 분기 Objective + 월 KR ④독립 메뉴 신설 ⑤회의 체계에 **마일스톤 회의** 추가.

---

## 1. 회의 체계 — 두 층의 회의

### ① 마일스톤 회의 (Top-down 층 · 주 1회, 월요일 오전 권장)
- **목적**: 기한 약속(마일스톤) 생성·조정·위험 판정, 프로젝트 우선순위. **세부 작업 배분은 하지 않는다**(스탠드업 몫).
- **참석**: 관리자 + 프로젝트 담당자(안건에 따라 전원).
- **진행 순서(Que 화면)**: ⑴ 간트 마일스톤 레인으로 다가오는 4주 훑기 → ⑵ 위험(주의/지연) 마일스톤 사유 확인·기한 조정(전 화면 칩 클릭 수정 — 기구현) → ⑶ 신규 마일스톤 등록(/planning) → ⑷ 결정을 회의록으로 남기고 기존 Action→Task 파이프라인으로 후속 작업 연결.
- **Que 기획 요소**: 회의록에 **회의 종류(kind: `milestone` | `general`)** 필드 추가 — 마일스톤 회의록만 모아보기, 데일리 보드에서 "이번 주 마일스톤 회의 결정" 참조 링크.

### ①-b 마일스톤 회의 전용 간트 페이지 — `gant.griff.co.kr` (2026-07-11 확정)

회의실 화면에 띄우는 전용 페이지. **view.griff.co.kr 선례**(별도 도메인 + 전용 라우트 + Fullscreen)를 그대로 따른다.

- **전 프로젝트 통합 간트**(핵심): 프로젝트별이 아니라 전 프로젝트의 마일스톤·작업을 한 화면에 겹쳐 보는 회의용 조망. 기존 gantt-view 컴포넌트 재사용 + 통합 데이터 공급.
- **인증(확정)**: **관리자·대표 계정만 로그인** 가능(회의실 화면 용도). 익명 조회 없음 — 일반 팀원 조회는 que.griff.co.kr의 기존 간트로 충분.
- **마일스톤 드래그 이동**(신규 개발, 중소형): 칩을 날짜 컬럼 스냅으로 끌어 기한 변경 — 기존 updateMilestoneAction 재사용, ChangeLog via=web.
- **전체화면**: 기존 Fullscreen 버튼 재사용. **스크롤**: 기존 ◀7일·오늘·▶7일 버튼 + 가로 스크롤.
- **위험만 보기 토글**: 주의·지연 마일스톤만 필터 — 회의 안건 자동화.
- **오늘 조정 요약 → 회의록 초안**: 회의 중 변경된 마일스톤 N건을 하단에 모아 표시, 회의 종료 시 그대로 회의록(kind=milestone) 초안으로 넘기기 — §1 회의 종류와 연결.
- **줌**: 컬럼 폭 전환(4주 상세 ↔ 분기 조망). **클라이언트 필터**: 기존 상단 필터 재사용.
- 배포: Vercel 도메인 추가 + 호스트 라우팅(view 선례).

### ①-c 마일스톤 회의 — AI 원격 진행 모드 (2026-07-11 추가)

회의실에 모이지 못하는 날에도 회의가 끊기지 않도록, **AI가 사회자가 되어 안건을 하나씩 제시하고 답이 오면 다음으로 넘어가는** 비동기 진행 시나리오.

- **안건 큐 자동 생성**: 회의 개시(관리자 버튼 또는 정시) 시 AI가 안건을 자동 수집 — ⑴위험(주의/지연) 마일스톤 ⑵이번 주 마감 임박 마일스톤 ⑶지난 회의 이월 안건. 각 안건에 맥락 요약(관련 작업 진행률·막힘)을 붙인다.
- **1안건 1질문**: AI가 안건을 담당자에게 제시(Que 화면 + Slack DM 버튼 병행 — 기존 체크인 버튼 DM 인프라 재사용). 답변 옵션은 결정형: **기한 유지 / 기한 연기(새 날짜) / 위험 상태 변경 / 보류(사유)**. 답하면 즉시 반영(updateMilestoneAction, ChangeLog via=web)되고 다음 안건으로 넘어간다.
- **진행 화면**: /daily 또는 간트 페이지에서 "회의 진행 중 — 안건 3/7, 대기: ○○님" 상태 표시. 누구든 전체 큐와 결정 현황을 볼 수 있다.
- **종료·요약**: 전 안건 소진(또는 컷오프) 시 AI가 결정 요약을 생성해 **회의록(kind=milestone) 초안으로 저장** + Slack 팀채널 게시. 미응답 안건은 "다음 회의 이월"로 표시하고 담당자에게 재촉 1회.
- **권한**: 안건 응답은 해당 마일스톤 담당자·관리자만(기존 canManage 재사용). 개시·종료는 관리자.
- 로드맵 위치: **Phase 2.5**(스탠드업 AI 진행(Phase 2)의 안건 큐·버튼 응답·요약 패턴을 마일스톤 회의에 재적용 — 인프라 공유로 규모 중소형).

### ② 데일리 스탠드업 (Bottom-up 층 · 매일 10:00, 비동기+AI)
- 마일스톤 회의가 잡은 약속 아래에서, 실행자가 오늘/내일 작업을 등록·조정. 상세는 §2~5.

### 베타 킥오프(월요일) 시나리오
1. 주말: 구글 시트에서 클라이언트·프로젝트·**마일스톤**을 CSV 임포트(기존 설정→가져오기, 간편 날짜 지원). 이번 주 1주치 작업만 담당자 확정 등록.
2. 월요일: 첫 **마일스톤 회의**를 확장 운영 — 임포트 결과 검수·확정.
3. 화요일부터: 데일리 스탠드업이 일정의 엔진(작업은 실행자가 매일 등록·조정 — 시트 전체를 미리 붓지 않는다. 부정확한 대량 등록은 첫 주 경고 폭탄 → 도구 불신).

---

## 2. 데이터 모델 (신규 엔티티 3 + 필드 2)

원칙: **파생 데이터(어제/오늘/막힘)는 저장하지 않고 기존 `getStandupData`(apps/web/src/lib/team-data.ts:230) 파생을 계속 쓴다. 저장하는 것은 "사람이 쓴 말"뿐.** 단 파생은 다음 날 재현이 안 되므로 제출 시점 Task id만 경량 동결.

### standup_entries — 비동기 체크인
- `id · date(KST YYYY-MM-DD) · userId · focus(필수, ~200자 — 오늘의 포커스 한마디) · note(선택) · blockerText(선택) · blockedTaskIds(선택 — issue/on_hold Task 참조) · snapshotTaskIds{yesterdayDone, yesterdayUnfinished, todayPlanned}(id만 동결) · aiDrafted · draftEdited · submittedAt/updatedAt`
- 유니크 (date, userId) 1건 — 재제출은 덮어쓰기. ChangeLog 생략(운영 리듬 기록 — revision_notes 선례), updatedAt만 추적.

### standup_team_summaries — AI 팀 요약 (AI 저장 관례의 의도적 예외)
- 날짜당 1건: `date · generatedAt · model · content(막힘 클러스터/흐름/추천 액션) · submittedUserIds · regeneratedBy`
- 예외 사유: Slack 게시·보드 표시 시점 분리, 하루 1회 pro 재생성 비용, 과거 회고 재현. 스키마 주석에 예외 명시.

### objectives — 분기 목표 (회사 레벨 단일 계층, 팀/회사 분리는 과설계)
- `id · title · description · period("2026-Q3") · ownerId · status(draft|active|done|cancelled) · order`

### key_results — 월 핵심결과 (개인 담당)
- `id · objectiveId · title · ownerId · month("2026-07") · metricType(manual|task_auto) · targetValue/currentValue/unit(manual용) · status · updatedAt/updatedBy`
- **진척 변경은 ChangeLog 기록**(목표 데이터 = 감사 대상).

### 기존 엔티티 필드 추가
- `Task.keyResultId`(optional, 단일) — 다대다 테이블은 8인 규모에 과설계.
- `MeetingNote.kind`(`milestone` | `general`, 기본 general) — §1 회의 종류.

### KR 측정 방식 — 하이브리드(추천 확정)
- KR 단위 `metricType` 선택, **기본 manual**. 진척 계산기는 하나: manual=currentValue/targetValue, task_auto=연결 Task done/전체(기존 `overallProgress` 술어 재사용). 소비처는 단일 progress(0~100)만 본다.
- 근거: 순수 자동이면 매출·계약 등 비Task 지표 표현 불가, 순수 수동이면 Task 연결 가치 소멸.

---

## 3. AI 진행자 플로우 (기존 gemini.ts 재사용)

| 단계 | 모델 | 내용 |
|---|---|---|
| ① 개인 초안 | **flash** | /daily 진입 시(미제출이면) 내 파생 4분면+막힘 사유·댓글로 focus/note/blocker 초안 생성 → **편집 가능한 폼 프리필**(자동 저장 금지 — "AI는 확인을 거쳐 저장" 관례). 제출 시 aiDrafted/draftEdited 기록 |
| ② 팀 요약 | **pro**(flash 폴백) | 전원 제출 즉시 또는 11:00 컷오프 중 먼저 오는 쪽. 출력: (a)막힘 클러스터+도울 사람 제안 (b)어제→오늘 흐름(이월 다발·모멘텀) (c)추천 액션 2~3개. 저장 후 보드 표시+Slack 팀채널 게시. admin만 재생성 |
| ③ 미제출 리마인드 | AI 불필요 | 10:40 미제출자만 개인 DM(기존 체크인 재촉 버튼 DM 패턴, "지금 작성"→/daily 딥링크). dedup `standup_remind:<userId>:<date>` |

---

## 4. 화면 구성 — 독립 메뉴 "데일리" (`/daily`)

menu.ts children 관례: **오늘**(`/daily`) | **OKR**(`/daily?tab=okr`). 위치는 홈 바로 아래(매일 쓰는 화면 상단 IA 원칙). 전원 접근.

**오늘 보드** (위→아래):
1. **내 입력 폼**(미제출 시 최상단 강조) — AI 초안 프리필 + focus(필수)/note/막힘(Task 선택기+자유 서술). 제출 후 내 카드로 접힘.
2. **전원 카드 그리드**(8인) — 제출자: 사람의 말(focus/note/막힘) + 하단 파생 4분면 요약(기존 StandupGrid 데이터 흡수). 미제출자: 회색 카드+재촉 상태. 상단 "5/8 제출" 진행률. 이번 주 마일스톤 회의 결정 참조 링크(§1).
3. **AI 팀 요약 패널** — 생성 전 대기 상태, 생성 후 클러스터/흐름/액션.

**OKR 탭**: 분기 선택기 → Objective 아코디언 → 월 KR 행(진행률 바·metricType 뱃지·소유자·연결 Task 수). KR 확장 시 연결 Task 목록+manual 진척 입력(소유자만)+ChangeLog 이력. Task 입력/상세에 "KR 연결" 필드(내 월 KR 우선 정렬).

**타 화면 연결**: 홈 브리핑에 "스탠드업 미제출" 카드 / 성과(/heatmap)에 KR 달성률 축(Phase 4 — 현재 목표 축 부재) / **`/team?view=standup`은 Phase 2에서 `/daily`로 리다이렉트 대체**(동일 데이터 이중 화면 방지, getStandupData는 /daily 공급자로 존속).

---

## 5. 10시 리듬 — 알림 시간표 재편 (기존 dispatch.ts·personal-digest.ts)

| KST | 발송 | 변경 |
|---|---|---|
| 09:30~09:50 | 개인 DM 브리핑(기존 4섹션) | 창 9:50→**9:30 시작으로 앞당김**(브리핑 읽고 체크인 준비 순서) |
| **10:00** | 팀채널 "스탠드업 오픈" + 개인 DM "초안으로 시작" 버튼 | 기존 9시 팀 다이제스트를 개편·이동(STANDUP_HOUR_KST 9→10, 중복 다이제스트 폐지) |
| 10:40 | 미제출자 재촉 DM | 신규 |
| 11:00(또는 전원 제출 즉시) | 팀채널 AI 팀 요약 | 신규, dedup `standup_summary:team:<date>` |

주말은 스킵(크론 진입부 요일 게이트), 공휴일은 2차 과제.

---

## 6. 권한

- standup_entries: 생성/수정 **본인만**, 조회 전원 (도메인 규칙 "본인 작업만 수정" 정합)
- 팀 요약: 시스템 생성, 재생성 admin / objectives: **admin** / key_results: admin 또는 Objective 소유자, manual 진척 입력은 KR 소유자+admin
- Task↔KR 연결: 기존 canEditTask(본인 작업) 재사용. UI 숨김+페이지+서버 액션 3중 강제 관례 유지.

---

## 7. 단계 로드맵

| Phase | 범위 | 규모 |
|---|---|---|
| **1. 스탠드업 코어** | standup_entries 전 스택(revision_notes 경로 선례: core zod→mock-db→supabase-rows→seed→schema.sql→web data/actions/page) + /daily 메뉴·오늘 보드·입력 폼 + AI 개인 초안(flash) + MeetingNote.kind | 중 |
| **2. AI 진행자+리듬** | AI 팀 요약(pro)+standup_team_summaries + 알림 시간표 재편(§5) + 10:40 재촉 + /team 스탠드업 대체 | 중 |
| **3. OKR 코어** | objectives/key_results 전 스택 + OKR 탭 + Task.keyResultId + 하이브리드 진척 계산기 | 대 |
| **2.5 마일스톤 회의 AI 원격 진행** | §1-c — 안건 큐 자동 생성 + 버튼 결정 응답(Slack DM 병행) + 회의록(kind=milestone) 초안 자동화 | 중소 |
| **4. 통합(선택)** | 스탠드업 카드에 KR 진척, AI 요약에 OKR 문맥, /heatmap KR 축, 홈 연동 | 소 |

문서 정합: 착수 시 `que-product-plan.md`에 본 기획 반영 + `que-roadmap-plan.md` D-4(OKR=별도 앱 소관) 갱신 필요 — **OKR을 Que 내부로 방향 전환**하는 결정임.

## 8. 운영 정책 확정 (2026-07-11 사용자 승인 — 미결 5건 전부 추천안 수용)

1. **지각 제출**: 허용하되 그날 팀 요약에는 미반영 + 카드에 "지각" 표시(submittedAt 파생).
2. **팀 요약 트리거**: 전원 제출 즉시 vs 11:00 컷오프 중 **먼저 오는 쪽**. 미제출자가 남으면 "n인 미제출" 명시 후 생성.
3. **KR task_auto 완료율**: 연결 Task 개수 기준(done/전체), 가중치 없음 — 단순 우선.
4. **/team?view=standup**: Phase 2에서 `/daily`로 완전 대체(리다이렉트 + 메뉴 교체, getStandupData는 공급자로 존속).
5. **주말**: 스탠드업·관련 알림 스킵(크론 진입부 요일 게이트). 공휴일은 2차 과제.

## 검증 (승인 후 다음 산출물 — 코드 아님)

이 기획이 승인되면: ① **본 기획안 전문을 `/Users/griff_hq/Desktop/que/que+/` 폴더에 기록**(사용자 지정 위치, 파일명 예: `daily-standup-okr-plan.md`) ② `data/docs/que-product-plan.md`에 "데일리(스탠드업+OKR)" 절 정식 반영 여부는 추후 결정 ③ HANDOFF 기록. 코드 구현은 별도 지시가 있을 때 Phase 1부터. 간트 전용 페이지(§1-b)는 로드맵의 독립 항목으로 함께 기록.
