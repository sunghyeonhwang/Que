# Action 페이지 개발 프롬프트

```text
Que의 Action 페이지를 구현해줘.

참고:
- docs/que-product-plan.md의 Action 정의
- preview/action.html

목적:
- 회의록에서 추출된 Task 후보를 실제 Que Task로 확정한다.
- 담당자와 마감일이 있는 항목만 Task로 생성한다.

필수 UI:
- 원본 회의록 선택
- 후보 다시 추출 버튼
- 확정 항목 일괄 생성 버튼
- Task 후보 테이블
- 컬럼: Task 후보, 담당자, 마감일, 상태, 처리
- 원문 출처 문장 표시
- Task 생성/보류/무시 버튼
- 생성된 Task 목록
- 생성 규칙 안내

상태:
- 생성 대기
- Task 생성됨
- 보류
- 무시됨
- 확인 필요
- 문제 연결

생성 규칙:
- 담당자와 마감일이 모두 있어야 Task 생성 가능
- 둘 중 하나라도 없으면 확인 필요로 남긴다.
- 생성된 Task는 Calendar, Today, Now에 반영될 수 있는 구조로 만든다.
- ActionItem에는 meetingNoteId와 sourceText를 보존한다.

shadcn/ui:
- Table
- Badge
- Button
- Select
- Sheet
- Dialog
- Card
- Alert
- Sonner

반응형:
- FHD: 후보 테이블과 생성된 Task/규칙 패널 2열
- 태블릿 가로: 2열 또는 테이블 우선
- 태블릿 세로: 테이블 내부 가로 스크롤, 생성된 Task는 아래 스택
- 처리 버튼은 터치하기 쉬운 크기 유지

수용 조건:
- 회의록 Action 후보가 담당자와 마감일 기준으로 검토된다.
- 담당자 누락 후보는 자동 생성되지 않는다.
- 원문 출처가 항상 함께 보인다.
- Task 생성/보류/무시 상호작용이 mock 상태로 동작한다.
- lint/typecheck/build 통과.
```

