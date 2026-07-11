# Griff Q — Company Operating System 초기 기획

> 작성: 2026-07-11 · 근거: 같은 날 대화록 메모("Griff Q Operating System 설계 메모")
> 상태: **초기 기획(구현 미착수)** · 2026-07-11 메모 전문 수신으로 모듈 C 완성. 철학·프레임워크는 `que+/griff-os-whitepaper-v1.md` 참조. 기존 기획 정본 `que+/daily-standup-okr-plan.md`(데일리·OKR — Phase 1~4 라이브)의 **다음 층**이다.

---

## 0. 비전 — PM Tool에서 Company OS로

현재 Que는 프로젝트·태스크·일정·승인·협업을 다루는 **PM 도구**다. 회사 운영에는 그 위에 사람(HR)·운영(Operation)·재무(Finance)·제품(Product)·의사결정(Governance)이 연결되어야 한다.

> Griff Q는 단순한 PM Tool이 아니라 **Company Operating System**이 되어야 한다.

단, 한 번에 OS를 만들지 않는다 — **지금의 Que가 이미 커버하는 것을 정확히 알고, 빈 모듈을 단계적으로 채운다.**

### 현재 커버리지 맵

| OS 모듈 | 현재 Que | 갭 |
|---|---|---|
| **PM** | ✅ 프로젝트·태스크·마일스톤·간트·일정·클라이언트 | — |
| **Operation** | ✅ 데일리 스탠드업·주간 통합 회의·긴급 결정·AI 리듬 | — |
| **Governance** | ◐ ChangeLog(감사)·권한 3중·회의록·결정 기록 | 실패 분류·대응 프로세스 없음 → **모듈 A** |
| **목표(OKR)** | ◐ 분기 Objective·월 KR(manual/task_auto) 라이브 | **상태형 KR 없음**(에이전시 납품형) → **모듈 A** |
| **HR** | ✖ 멤버 카드(조회)·부하 표만 | Role(직무)·Arena(환경)·배치 없음 → **모듈 B** |
| **Finance** | ◐ 결제요청(승인·입금 상태) | 예산·정산·수익성은 범위 밖(후속 논의) |
| **Product** | ✖ | 메모 미완("Company OS 구성"에서 끊김) → **후속 대화 필요** |

---

## 모듈 A — 에이전시식 OKR 보강 (기존 OKR 위에)

### A-1. 상태형 KR (`metricType: "state"` 추가)

에이전시의 KR은 MAU 같은 수치가 아니라 **상태(State)** 다: "일정 내 납품", "클라이언트 최종 승인", "오류 없이 전달". 현재 구현(manual=수치, task_auto=작업 완료율)에 세 번째 측정 방식을 추가한다.

- **모델**: `metricType`에 `state` 추가 + `stateChecks: { label, done }[]`(1~7개 체크 항목). 진척 = 체크 완료 비율(기존 `keyResultProgress` 단일 계산기에 분기 하나 추가 — 소비처 무변경).
- **화면**: KR 행 확장 시 체크리스트(소유자·admin만 토글). 예: ⑴사이트 런칭 완료 ⑵D-14 QA 완료 ⑶성능 기준 만족 ⑷클라이언트 최종 승인.
- **원칙 유지**: Task ≠ KR — Task는 "디자인한다/개발한다"(행위), KR은 "결과가 어떻게 되었는가"(상태). 체크 항목은 Task가 아니라 **판정 기준**이므로 Task 자동 생성하지 않는다.

### A-2. 실패 분류 — 내부/외부 (마일스톤·프로젝트 회고)

실패는 두 종류이고 반드시 분리한다:

| 분류 | 정의 | 예 |
|---|---|---|
| **내부 실패** | 우리가 통제 가능 | 일정 관리 실패·QA 부족·커뮤니케이션 부족·승인 누락 |
| **외부 변경** | 통제 불가 | 클라이언트 방향/예산/일정 변경·행사 취소 |

- **모델**: 마일스톤이 지연/취소로 종결될 때(또는 프로젝트 종료 시) **회고 레코드**: `cause: internal | external` + 세부 유형(위 표의 enum) + 한 줄 서술 + "관리된 실패였나"(대응 프로세스를 탔는지 boolean).
- **입력 지점**: 마일스톤 기한 초과 종결 시 확인 카드(1분 입력) + 주간 통합 회의 섹션 ⑴(지난주 요약)에 "지난주 실패 분류" 집계.
- **가치**: 분기 회고에서 "내부 실패 비율"이 팀이 실제로 개선할 수 있는 지표가 된다. 외부 변경은 실패가 아니라 **대응 대상**으로 취급.

### A-3. 외부 변경 대응 프로세스 (기존 긴급 결정 워크플로 확장)

> 결과보다 **대응**이다. 클라이언트 변경 발생 → 24시간 내 영향 분석 → 일정 재협의 → 승인 완료.

이미 있는 **긴급 결정 워크플로**(트리거 감지→결정 카드→에스컬레이션)에 **수동 트리거**를 추가한다:

- **"외부 변경 접수"**: PM이 클라이언트 변경을 접수하면(회의 LLM 콘솔 또는 버튼) 대응 카드가 생성 — 단계: **접수 → 영향 분석(24h SLA) → 재협의 → 승인 → 종결**. 각 단계 완료를 담당자가 체크, 24h 내 영향 분석 미완이면 기존 에스컬레이션 경로(2h/4h 대신 12h/24h) 재사용.
- 종결 시 자동으로 A-2 회고 레코드(external·관리된 실패=true) 생성 — **대응을 탔다는 사실 자체가 기록**된다.
- 데이터: 기존 crisis 인프라(dedup·상한·DM)를 재사용하고 `origin: auto | manual` 필드만 추가.

---

## 모듈 B — Role & Arena (HR 층)

### B-1. 개념

- **Role(직무)**: 사람의 직무 — PM · Designer · Developer · AE · Producer. **쉽게 변하지 않는다.**
- **Arena(환경)**: 업무가 수행되는 환경 — 같은 사람이라도 Arena가 바뀌면 **책임이 달라진다.** 예: 디자이너가 Office Arena에서는 디자인 제작, Event Arena에서는 출력물 관리·사인물 확인·현장 수정·긴급 대응.

기본 Arena 4종(커스텀 추가 가능):

| Arena | 담는 일 |
|---|---|
| **Office** | 디자인·개발·기획·문서·QA |
| **Event** | 현장 대응·설치·운영·긴급 수정·고객 응대 |
| **Sales** | 제안·견적·PT·계약 |
| **Studio** | 촬영·라이브·방송·장비 관리 |

### B-2. 대원칙 — 평가가 아니라 배치

> Arena는 사람을 평가하기 위한 개념이 아니다. **적재적소에 배치하기 위한 기준**이다.

Que의 "감시 도구 아님" 원칙과 정합시키기 위한 설계 제약:
- Arena 역량은 **점수화·서열화하지 않는다**(관리자 리포트의 "점수화 없음" 선례). 표현은 **강점 태그**(예: "현장 대응 강함")와 **배치 이력**(어느 Arena에서 일했나 — Task/프로젝트 데이터에서 파생)으로만.
- 강점 태그는 **본인 자기신고 + 관리자 합의**로만 등록(일방 부여 금지). 별점(★) UI는 채택하지 않는다 — 메모의 별점 예시는 "배치가 달라질 수 있다"는 취지로 해석하고, 구현은 태그로.

### B-3. 데이터 모델 스케치

- `User.jobRole`(PM|Designer|Developer|AE|Producer|기타 — 기존 role(권한)·rank(직급)와 별개 축) — 멤버 카드에 표시.
- `arenas`: id·name·description·기본 4종 시드(admin이 추가/수정).
- `arena_strengths`: userId·arenaId·note(강점 한 줄)·**본인 확인+admin 확인 이중 플래그**.
- `Task.arenaId`(선택) / `Project.defaultArenaId`(선택) — 작업이 어느 환경의 일인지. 미지정이면 Office 취급.

### B-4. 화면

- **멤버 화면 확장**(현 조회 전용 유지): 카드에 jobRole·강점 태그·최근 Arena 배치 분포(파생 — 최근 4주 작업의 arena 비율).
- **배치 뷰(관리자)**: Arena × 사람 매트릭스 — 각 셀에 현재 배치 작업 수·강점 태그 여부. 이벤트 시즌에 "Event Arena에 강점 있는 사람이 지금 어디에 배치돼 있나"를 한눈에. 부하 표·재배분 패널(기구현)과 연결 — 재배분 시 Arena 강점이 추천 근거에 추가.
- **성과/부하에 Arena 축**: 부하 표 필터(Arena별), 프로젝트 캘린더·간트에 arena 뱃지(선택).

### B-5. 권한·교육 연결(후속)

메모의 "평가·교육·배치·권한 설계" 중 이번 기획은 **배치**까지. Arena별 권한 차등·교육 트래킹은 과설계 위험이 있어 배치 뷰 운영 경험 후 재논의.

---

## 모듈 C — Griff OS 전체 구조 (2026-07-11 메모 전문 반영으로 완성)

### C-1. 권장 구조 — Griff Q Plus 원칙

> **기존 Griff Q는 그대로 유지한다(Project Core). 모듈을 Plus로 추가한다.**

```
Griff OS
├── Griff Q (Project Core — 현재 라이브: Project·Workflow·Task·Schedule·Approval)
├── HR        — Role · Arena · Evaluation · Skill Matrix
├── Finance   — Budget · Cost(외주비·인건비·장비비) · Profit(마진) · Resource
├── Knowledge — Wiki · Template · SOP · Lessons Learned(회고·노하우·사례)
├── Governance— Decision · Approval · Policy · Authority(R&R)
└── Product   — Vision · Roadmap · Release · Feedback · Growth
```

핵심 인사이트: **프로젝트는 Task만으로 움직이지 않는다** — Decision Rule · Change Management · Quality Gate · Risk · Finance가 함께 존재해야 한다.

### C-2. 모듈별 착수 판단 (현재 Que 자산 기준)

| 모듈 | 메모의 구성 | 현재 자산 | 착수 판단 |
|---|---|---|---|
| **Risk** | 리스크·변경관리·일정 영향도 | ◐ 긴급 결정·간트 선행 위험·마일스톤 위험 상태 | **모듈 A-3(외부 변경 대응)이 곧 Risk의 시작** — 변경관리부터 |
| **Quality** | QA·체크리스트·Gate·승인 기준 | ◐ 상태형 KR 체크리스트(A-1)·글래도스식 게이트 문화 | **A-1이 Quality Gate의 데이터 모델을 겸한다** — KR 체크가 곧 Gate |
| **Knowledge** | 회고·템플릿·노하우·사례 | ◐ 회의록(kind)·반복 템플릿·A-2 실패 회고·도움말 | 회고(A-2)가 쌓이면 Lessons Learned로 승격 — Wiki/SOP는 후순위 |
| **Governance** | 승인·의사결정·권한·R&R | ◐ ChangeLog·결제 승인·권한 3중·회의 결정 기록 | R&R이 곧 Role&Arena(B) — Decision Rule 명문화는 화이트페이퍼 몫 |
| **Finance** | 손익·외주비·인건비·장비비·마진·예산 | ◐ 결제요청(비용 지출)만 | **프로젝트 손익이 첫 단추**: 프로젝트에 예산·외주비 필드 → 결제요청과 연결 → 마진 파생. 인건비 배분은 민감(부하 데이터와 결합 시 감시 우려) — 원칙 검토 후 |
| **Product** | Vision·Roadmap·Backlog·Feedback·Release·Growth | ✖ (자체 제품: DayBlocks·Que 자신) | Agency(납품)와 운영 방식이 다름 — **별도 OS로 분리**. Que의 수정사항(/revisions)이 Feedback의 씨앗. 자체 제품이 커질 때 착수 |

### C-3. Product OS — Agency와의 분리 원칙

- **Agency**: 남의 문제를 해결한다 → 성과 = 납품 (모듈 A의 상태형 KR·대응 프로세스가 담당)
- **Product**: 우리의 문제를 해결한다 → 성과 = 제품 성장 (Vision·Roadmap·Feedback·Release·Growth·Revenue)
- 같은 화면·같은 지표로 섞지 않는다. Product OS는 자체 제품(DayBlocks, Que 자신)이 운영 단계에 들어갈 때 별도 트랙으로 기획한다.

---

## 로드맵 (기존 Phase 1~4 라이브 이후의 OS 트랙)

| OS Phase | 범위 | 규모 | 비고 |
|---|---|---|---|
| **OS-1. 상태형 KR** | A-1 — metricType state+체크리스트, 계산기 분기, KR 행 UI | 소~중 | 기존 OKR 위 증분. **월요일 베타에서 KR 입력 시작 전이면 가장 먼저** |
| **OS-2. 실패 분류+대응** | A-2 회고 레코드 + A-3 외부 변경 접수(crisis 인프라 재사용) | 중 | 주간 회의 섹션 ⑴ 집계 포함 |
| **OS-3. Role & Arena 기반** | B-3 모델 + 멤버 카드 확장 + Task.arenaId | 중 | 점수화 없음 원칙 고정 |
| **OS-4. 배치 뷰** | B-4 관리자 매트릭스 + 재배분 추천 연결 + 부하 Arena 축 | 중 | OS-3 후 |
| **OS-5. Finance 첫 단추** | 프로젝트 예산·외주비 필드 + 결제요청 연결 + 마진 파생(손익 카드) | 중 | 인건비 배분은 원칙 검토 후 |
| **OS-6. Knowledge 승격** | A-2 회고 축적 → Lessons Learned 화면(사례 검색) | 소~중 | 데이터가 쌓인 뒤 |
| **OS-W. Whitepaper** | 「Griff OS Whitepaper v1.0」 — 운영 철학·프레임워크 문서(기능 명세 아님) | 문서 | `que+/griff-os-whitepaper-v1.md` |

---

## 미결 질문 (다음 대화에서 확정)

1. **상태형 KR 체크 항목의 승인 주체** — 소유자 셀프 체크로 충분한가, "클라이언트 최종 승인" 같은 항목은 admin 확인이 필요한가? (추천: 항목별 `requiresAdminConfirm` 선택 플래그)
2. **jobRole 초기값** — 8인 각자의 직무 배정표(PM/Designer/Developer/AE/Producer)를 주시면 시드에 반영.
3. **외부 변경 대응 SLA** — 영향 분석 24h가 기본인가, 프로젝트별 차등인가? (추천: 전사 24h 고정으로 시작)
4. **Arena 커스텀** — 기본 4종 외에 지금 필요한 Arena가 있는가?
5. ~~모듈 C 범위~~ → **해소(2026-07-11)**: 메모 전문 수신 — C-1~C-3으로 반영 완료.
6. **Finance 인건비 배분** — 부하 데이터와 결합하면 감시 도구로 비칠 위험. 프로젝트 손익에 인건비를 포함할지, 포함한다면 산정 방식(고정 단가? 시간 추적은 안 함)을 별도 논의.
7. **Evaluation(평가)** — 메모의 HR 구성에 있으나 Que 원칙(점수화 없음)과 긴장 관계. 화이트페이퍼에서 "평가가 아니라 배치·성장"으로 재정의할지 결정.
