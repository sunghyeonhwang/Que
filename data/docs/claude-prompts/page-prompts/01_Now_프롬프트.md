# Now 페이지 개발 프롬프트

```text
Que의 Now 페이지를 구현해줘.

참고:
- docs/que-product-plan.md의 Now 정의
- preview/now.html

목적:
- 캘린더 일정과 회의록 기반 Action Task를 한 표에서 확인한다.
- 관리자나 프로젝트 담당자가 오늘 바로 처리할 항목, 문제/홀드, 담당자 누락을 빠르게 본다.

필수 UI:
- 상단 요약 metric: 오늘 캘린더 항목, Action Task, 문제/홀드, 오늘 마감, 담당자 확인 필요
- 필터: 전체, 내 항목, 문제
- 통합표 컬럼: 시간/마감, 구분, 항목, 담당자, 상태, 출처
- 주의 필요 패널
- 회의록 업로드와 Action 생성으로 이동하는 빠른 링크

데이터:
- CalendarEvent와 ActionItem을 하나의 NowRow로 합쳐 표시한다.
- row type은 calendar 또는 action으로 구분한다.
- source에는 회사 캘린더, Que 캘린더, 회의록 파일명을 표시한다.

shadcn/ui:
- Card
- Badge
- Button
- Tabs 또는 ToggleGroup
- Table
- ScrollArea
- Sheet

반응형:
- FHD: 통합표와 우측 주의 패널 2열
- 태블릿 가로: 2열 유지 가능하면 유지, 폭이 부족하면 우측 패널을 아래로 이동
- 태블릿 세로: 표는 내부 가로 스크롤, 주의 패널은 아래 스택
- 표 헤더는 sticky 처리

상호작용:
- 필터 선택 시 rows가 mock data 기준으로 필터링된다.
- row 클릭 시 상세 Sheet를 연다.
- 문제/홀드 row는 눈에 띄되 과한 경고 UI를 피한다.

수용 조건:
- Now 한 화면에서 일정과 Action Task가 섞여 보인다.
- 담당자 누락 Action이 자동 생성되지 않고 확인 필요로 표시된다.
- FHD와 태블릿에서 표가 페이지 전체를 깨지 않는다.
- lint/typecheck/build 통과.
```

