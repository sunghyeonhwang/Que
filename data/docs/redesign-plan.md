# Que 전면 재설계 계획 (Figma QUE_All_Pages)

작성: 2026-07-03 · Figma: `XhDXyGhG2PYKNRKRpgXheQ` · 화면별 노드: `data/디자인변경_추가기능_작업.md`

## 확정 방향 (사용자)
- **디자인 그대로, 신규 데이터 모델 채택** (Asana/Notion식 프로젝트 관리 도구).
- **새 앱 셸 도입** (GRIFF 로고 · 워크스페이스 스위처 · 글로벌 검색 · 알림 상단바 · 새 사이드바).
- 로그인은 완료. 폰트(Inter Tight + Noto Sans KR)·word-break keep-all 적용 완료.
- ⚠️ 이 방향은 CLAUDE.md의 "캘린더 기반 팀 상태 도구" 정의·도메인 모델과 갈린다 — 재설계 착지 시 CLAUDE.md 갱신.

## 디자인 토큰 (design system)
| 토큰 | 값 |
|---|---|
| brand/primary | `#3388ff` (#38f) |
| brand/subtle | `#e9f1fa` |
| text/primary | `#0d0d12` |
| text/secondary | `#55555e` |
| text/tertiary | `#74747d` |
| text/placeholder | `#a0a0a8` |
| neutral/150 (border) | `#e3e3e8` |
| background/primary | white |
| background/tertiary | `#f4f4f6` |
| status/success-bg | `#e9feea` |
| status/error | `#e33030` |
| 우선순위 뱃지 | 높음=red · 보통=amber · 낮음=green(status 계열) |
| 폰트 | Inter(라틴) + Noto Sans KR(한글) |

## 새 IA / 메뉴 (디자인 사이드바 기준)
섹션: **워크스페이스**(스위처) · **메뉴** · **기타**.

| 메뉴 | 매핑 라우트(전환기) | 비고 |
|---|---|---|
| 홈 | `/home` (신규) | 사용자 디자인 별도 제공 예정 — 그때 구현 |
| 프로젝트 | `/projects` (신규 PM 도구) | 목록·보드·캘린더·파일 뷰. 기존 `/projects`(마일스톤)는 흡수/폐기 |
| 일정 | `/team`(기존 팀현황) 또는 신규 | 디자인 확인 필요(node 5:13076) |
| 성과 | `/heatmap`(기존) | 라벨 "성과" (기존 "퍼포먼스" 대체). 디자인 node 5:13077 |
| 작업 목록 | `/today`(기존 오늘/Now 탭) | 디자인 node 5:13078 |
| 팀 | `/members`(기존) | 디자인 node 1:18218 |
| 확인필요(뱃지) | `/meeting-notes`(기존 회의록+Action) | 라벨 "확인필요". 디자인은 토큰 참조 새로 만들기 |
| 결제요청 | `/payments`(기존) | 디자인은 토큰 참조 새로 만들기 |

> 이전에 만든 메뉴(퍼포먼스/회의록/마일스톤 분리)는 이 디자인으로 대체된다(재작업 예상).

## 프로젝트 화면 데이터 모델 (신규)
```
Workspace { id, name, initials, color }         // 예: "멘딕스" MX
Project   { id, workspaceId, name, description, memberIds }
TaskGroup { id, projectId, name, color, order }  // 상태 그룹: 백로그/할 일/진행 중/…
PmTask    { id, groupId, name, description, dueAt, priority(높음|보통|낮음), assigneeIds, done }
```
- 뷰 4종: **목록**(그룹 섹션 표: 이름·설명·마감일·우선순위·사람들) · **보드**(칸반, 그룹=열) · **캘린더** · **파일**(파일 저장 인프라 필요 → 후순위).
- 모달: 태스크 상세(open card)·생성·편집, 그룹 추가, 프로젝트 공유/편집.
- **1단계는 mock data 우선**(CLAUDE.md 작업 방식). DB/Supabase 스키마는 이후.

## 단계 계획 (프로젝트부터)
1. **P1 — 셸 + 토큰 + 프로젝트 목록 뷰 ✅ 완료(2026-07-03, 브라우저 검증)**: 새 상단바/사이드바(GRIFF·워크스페이스 스위처·검색·알림) + `--que-*` 토큰 + `/projects` 목록 뷰(mock `pm-data.ts`). 기존 화면 새 셸 아래 유지. 고아 파일(projects/actions·templates 컴포넌트)은 후속 정리. `/calendar`는 URL만 유지(P3에서 프로젝트 캘린더 뷰로 흡수).
2. **P2 — 보드 뷰** (칸반, 드래그).
3. **P3 — 캘린더 뷰** (기존 캘린더 로직 재활용).
4. **P4 — 태스크 상세/생성/편집 모달**.
5. ~~P5 — 파일 뷰~~ **제외(사용자 결정 2026-07-03).** 뷰 탭에서 "파일" 제거 → 목록/보드/캘린더만.
6. 이후 화면 3~8(일정·성과·작업목록·팀·확인필요·결제요청·홈) 순차.
7. 안정화 후 신규 모델 Supabase 스키마 + 어댑터, 기존 모델과의 정리.

## 성과(퍼포먼스) 화면 — node 5:13077 (히트맵·작업성과 추가됨)
통합 분석 대시보드: **KPI 카드 4(총/진행중/완료/기한초과, 전기대비 증감%) · 작업 완료율(막대) · 기한 초과 추이(영역) · 히트맵(멤버×일 초록 그리드) · 작업 성과(3라인: 완료/새작업/기한초과) · 저성과 팀 표(이름·부서·초과·완료) · 프로젝트 진행률**.
- 데이터: 대부분 기존 모델 + status_logs 6주 이력(36번)으로 산출. **히트맵은 기존 `heatmap-data.ts` 재활용**.
- **차트 = recharts 도입(확정).** 색·접근성은 `dataviz` 가이드 준수. 히트맵은 그리드라 라이브러리 불필요.
- **부서(department) 필드 = 생성 확정, 값은 추후 사용자 제공.** users에 `department`(nullable) 컬럼 + core 헬퍼(`rankForUser`와 동일 패턴). 우선은 빈 값/플레이스홀더.
- 매핑: 성과 메뉴 = 기존 `/heatmap` 대체. P1(프로젝트) 완료 후 진행.

## 작업 목록 화면 — node 5:13078
"내 작업" 플랫 태스크 목록(탭: 모든/오늘/예정/완료). 프로젝트 List의 태스크 행·우선순위·상태 뱃지 컴포넌트 재사용. 신규 PM 모델(내게 배정된 PmTask).
- **결정(사용자)**: 기존 오늘/Now의 리치 기능(자동 체크인 응답·하루 마감·충돌 변경 제안·요약 지표·내 타임라인)은 **버리지 말고 이 작업 목록 화면에 유지·추가**로 넣는다. (디자인 목록 + 리치 기능 병행)

## 보류/결정 대기
- 홈 디자인(사용자 제공 예정).
- 파일 저장 인프라(Supabase Storage 등).
- 기존 도메인(오늘/Now/캘린더/MCP/CLI/도메인 규칙)과 신규 PM 모델의 통합·이관 범위 — 신규 화면 안정화 후 별도 계획.
