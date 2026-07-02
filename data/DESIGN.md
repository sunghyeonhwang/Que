# Que Design Guide

## 1. 기준

Que의 실제 앱 UI는 **shadcn/ui 기본값**을 기준으로 만든다.

참고:

- shadcn: <https://shadcn.com/>
- shadcn/ui installation: <https://ui.shadcn.com/docs/installation>
- shadcn/ui theming: <https://ui.shadcn.com/docs/theming>

원칙:

- shadcn/ui가 생성하는 기본 theme scaffold를 source of truth로 둔다.
- 글로벌 색상 토큰을 Que 브랜드용으로 임의 변경하지 않는다.
- MVP에서는 `neutral` base color, CSS variables, 기본 radius를 유지한다.
- Que의 상태 표현은 shadcn 기본 컴포넌트와 제한적인 local variant로 처리한다.
- 태블릿 우선, FHD 보조 기준으로 화면을 설계한다.

## 2. shadcn 기본 설정

`components.json` 기준:

```json
{
  "style": "base-nova",
  "rsc": true,
  "tailwind": {
    "config": "",
    "css": "app/globals.css",
    "baseColor": "neutral",
    "cssVariables": true
  }
}
```

설치 기준:

```bash
pnpm dlx shadcn@latest init -t next
```

기존 프로젝트에 적용할 경우에는 shadcn 공식 문서의 `Existing Project` 경로를 따른다.

## 3. 글로벌 Theme Tokens

shadcn 기본 semantic token을 그대로 사용한다.

주요 토큰:

- `background`
- `foreground`
- `card`
- `card-foreground`
- `popover`
- `popover-foreground`
- `primary`
- `primary-foreground`
- `secondary`
- `secondary-foreground`
- `muted`
- `muted-foreground`
- `accent`
- `accent-foreground`
- `destructive`
- `border`
- `input`
- `ring`
- `chart-1` ~ `chart-5`
- `sidebar`
- `sidebar-foreground`
- `sidebar-primary`
- `sidebar-primary-foreground`
- `sidebar-accent`
- `sidebar-accent-foreground`
- `sidebar-border`
- `sidebar-ring`

사용 예:

```tsx
<main className="bg-background text-foreground" />
<Card className="bg-card text-card-foreground" />
<Button>주요 액션</Button>
<Button variant="secondary">보조 액션</Button>
<Button variant="destructive">취소</Button>
```

## 4. Radius

shadcn 기본 radius를 유지한다.

기준:

```css
--radius: 0.625rem;
```

사용 규칙:

- 일반 카드: `rounded-lg`
- 버튼/입력/셀: shadcn 컴포넌트 기본 radius 유지
- 캘린더 이벤트/작업 row: `rounded-md` 또는 `rounded-lg`
- 모달, 시트, 팝오버: shadcn 기본 radius 유지
- Que에서 별도 pill이 필요할 때만 `rounded-full` 사용

## 5. Typography

MVP에서는 shadcn/Next 기본 폰트 체계를 따른다.

원칙:

- 별도 display font를 추가하지 않는다.
- 운영 도구이므로 큰 장식형 제목을 피한다.
- 화면 제목은 명확하게, 카드 제목은 작고 단단하게 쓴다.
- 숫자 metric은 크게 보이되 과한 hero scale은 피한다.

권장 크기:

- Page title: `text-2xl` ~ `text-3xl`
- Section title: `text-base` ~ `text-lg`
- Table body: `text-sm`
- Helper text: `text-xs` ~ `text-sm text-muted-foreground`
- Badge text: shadcn `Badge` 기본 크기

## 6. Layout

Que는 운영 화면이다. 넓은 마케팅 페이지처럼 만들지 않는다.

### App Shell

FHD:

- 좌측 sidebar 고정
- 본문은 `min-w-0`로 처리
- 표, 캘린더, 히트맵은 내부 스크롤 사용

태블릿 가로:

- sidebar 축소 또는 collapsible
- 주요 표와 패널은 2열 가능하면 유지
- 폭이 부족하면 우측 패널을 아래로 내린다.

태블릿 세로:

- sidebar는 Sheet, Drawer, 또는 상단 메뉴로 전환
- 본문은 단일 컬럼
- 캘린더/테이블/히트맵만 내부 가로 스크롤 허용

### Breakpoint 기준

- `md`: 태블릿 세로 이상
- `lg`: 태블릿 가로/작은 노트북
- `xl`: FHD PC
- `2xl`: 넓은 FHD 이상

## 7. Spacing

shadcn과 Tailwind 기본 spacing scale을 따른다.

권장:

- Page padding: `p-4 md:p-5 xl:p-6`
- Section gap: `gap-4`
- Dense list gap: `gap-2`
- Card padding: `p-4`
- Table cell padding: `px-3 py-2` 또는 `px-4 py-3`
- Toolbar gap: `gap-2`

태블릿 터치 기준:

- 주요 버튼 높이: 40px 이상
- 상태 버튼/선택지: 가능하면 40~44px
- 드래그 가능한 일정/작업 row: 최소 40px 이상

## 8. Component Rules

### Button

사용:

- `default`: 주요 액션
- `secondary`: 보조 액션
- `outline`: 필터, 뷰 전환, 가벼운 액션
- `ghost`: 사이드바 메뉴, 아이콘 버튼
- `destructive`: 취소, 삭제, 무시

주의:

- 텍스트 버튼만 남발하지 않는다.
- 아이콘만 있는 버튼에는 `aria-label`과 Tooltip을 제공한다.

### Badge

기본 variant를 우선 사용한다.

- `default`: 활성, 생성됨, 중요한 선택 상태
- `secondary`: 예정, 정보, 낮은 강조
- `outline`: 회사 일정, 읽기 전용, 외부 캘린더
- `destructive`: 문제발생, 취소, 무시됨

Que 상태별 권장:

- 예정: `secondary`
- 진행중: `default`
- 완료: `default`
- 응답대기: `outline`
- 대기/보류: `secondary`
- 문제발생: `destructive`
- 취소/무시: `destructive`

상태를 더 세밀하게 색상 구분해야 할 때도 글로벌 shadcn token은 바꾸지 말고, 작은 `status-dot` 또는 local badge class로만 보강한다.

### Card

사용:

- Metric card
- 요약 패널
- 설정 패널
- 반복 item card

주의:

- 카드 안에 카드를 중첩하지 않는다.
- 페이지 section 전체를 floating card처럼 감싸지 않는다.

### Table

사용 화면:

- Now
- Action
- 결제
- 팀 현황 일부

규칙:

- `TableHeader`는 sticky 처리 가능하게 구조화한다.
- 긴 표는 `ScrollArea` 또는 wrapper에 내부 스크롤을 둔다.
- 행 클릭 시 상세 `Sheet`를 연다.
- 태블릿 세로에서는 최소 table width를 두고 가로 스크롤한다.

### Sheet / Dialog / Drawer

사용:

- 캘린더 작업 상세
- Now row 상세
- 팀 현황 Attention 상세
- 문제발생/홀드 추가 입력
- 태블릿 세로 내비게이션

규칙:

- 데이터 확인/수정은 `Sheet` 우선
- 위험한 최종 확인은 `Dialog`
- 모바일/태블릿 내비게이션은 `Sheet` 또는 `Drawer`

### Form

사용:

- 작업 생성
- 회의록 업로드
- 결제 요청
- 설정

규칙:

- `react-hook-form` + `zod` 기반으로 만든다.
- 에러 메시지는 field 아래에 표시한다.
- 날짜, 담당자, 프로젝트가 모호하면 확정 전에 확인한다.

## 9. Que 화면별 Component Map

| 화면 | 주요 컴포넌트 |
| --- | --- |
| App Shell | Sidebar, ScrollArea, Button, Badge, Tooltip, Avatar |
| Now | Table, Badge, Card, Tabs, Sheet, ScrollArea |
| 오늘 | Input, Button, Card, Badge, Alert, Sheet, Sonner |
| 캘린더 | Tabs, ScrollArea, Sheet, Badge, Tooltip, custom grid |
| 전체 캘린더 | Tabs, ScrollArea, Badge, custom grid |
| 가로 캘린더 | ScrollArea, Badge, Tooltip, custom timeline |
| 팀 현황 | Table, Card, Badge, Sheet, Avatar |
| 히트맵 | Card, Badge, Progress, Tooltip, Sheet, custom grid |
| 회의록 | Form, Input, Select, Textarea, Card, Badge, ScrollArea |
| Action | Table, Select, Button, Badge, Sheet, Alert |
| 프로젝트 | Card, Progress, Tabs, Badge, ScrollArea, Sheet |
| 결제 | Form, Input, Textarea, Select, Table, Badge, Alert |
| 알림 | Tabs, Card, Badge, Button, Sheet, Switch |
| 설정 | Form, Select, Switch, Card, Table, Tabs |

## 10. Que 상태 표현

shadcn 기본 테마를 유지하되 상태 의미는 일관되게 쓴다.

| 상태 | Badge 기준 | 보조 표현 |
| --- | --- | --- |
| 예정 | secondary | muted text |
| 진행중 | default | active row |
| 완료 | default | 낮은 강조 또는 완료 아이콘 |
| 응답대기 | outline | violet dot 선택 가능 |
| 시간변경필요 | secondary | clock icon |
| 홀드 | secondary | pause icon |
| 문제발생 | destructive | alert icon |
| 취소/필요없음 | destructive | opacity 처리 |
| 병합 | outline | merge icon |

## 11. Calendar / Grid Rules

캘린더류 화면은 shadcn 기본 컴포넌트만으로 해결하지 않고 custom grid를 만든다.

규칙:

- 외부 회사 일정은 읽기 전용 스타일로 표시한다.
- Que 작업과 마일스톤만 드래그 가능하다.
- 비공개 일정은 제목 대신 `비공개 일정` 또는 `자리비움`으로 표시한다.
- 드래그 가능한 항목에는 cursor, focus, keyboard 대체 이동 UI를 제공한다.
- 드롭 후 변경 로그를 남긴다.

태블릿:

- 드래그가 불편한 환경을 위해 `날짜/시간 변경 Sheet`를 제공한다.
- 셀 최소 폭을 유지하고 내부 스크롤한다.
- 사람 이름, 날짜, 시간 header는 sticky 처리한다.

## 12. Accessibility

필수:

- 모든 icon-only button에는 `aria-label`
- 상태 변경 버튼은 현재 상태를 screen reader가 알 수 있게 처리
- 색상만으로 상태를 구분하지 않음
- `focus-visible` 상태 유지
- table header와 cell 의미 유지
- dialog/sheet focus trap 유지

검수:

- 키보드만으로 메뉴 이동 가능
- 키보드만으로 상태 변경 가능
- 화면 확대 125%에서도 주요 조작 가능
- 태블릿 터치 영역 40px 이상

## 13. Do / Don't

Do:

- shadcn 기본 token을 사용한다.
- 운영 화면답게 밀도 있게 구성한다.
- 표, 캘린더, 히트맵은 내부 스크롤을 둔다.
- row 클릭 시 Sheet에서 상세를 수정한다.
- 상태, 담당자, 마감일을 먼저 보이게 한다.

Don't:

- 글로벌 theme token을 브랜드 색상으로 크게 바꾸지 않는다.
- 랜딩 페이지 같은 큰 hero를 만들지 않는다.
- 카드 안에 카드를 반복 중첩하지 않는다.
- 색상만으로 상태를 설명하지 않는다.
- FHD만 보고 태블릿 조작성을 희생하지 않는다.

## 14. 검수 기준

- FHD 1920 x 1080에서 핵심 정보가 첫 화면에 보이는가?
- 1366 x 768에서 메뉴와 표가 잘리지 않는가?
- 태블릿 가로 1024 x 768에서 표와 캘린더를 조작할 수 있는가?
- 태블릿 세로 768 x 1024에서 사이드바가 본문을 밀어 깨지지 않는가?
- 버튼, 드래그 대상, 선택지는 터치하기 충분한가?
- shadcn 기본 theme token을 임의로 덮어쓰지 않았는가?
- lint, typecheck, build를 통과하는가?

