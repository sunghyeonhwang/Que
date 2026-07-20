import {
  Home,
  Activity,
  CalendarCheck,
  Calendar,
  ChartColumn,
  ListChecks,
  Users,
  LayoutDashboard,
  FileText,
  Receipt,
  Settings,
  Terminal,
  CircleHelp,
  MessageCircleQuestion,
  Milestone,
  Building2,
  FolderKanban,
  Bug,
  Rocket,
  GanttChart,
  Eye,
  ListTodo,
  Palette,
  Type,
  ClipboardList,
  FileUp,
  type LucideIcon,
} from "lucide-react";

/** menu.ts의 `#todo-app` 액션 항목을 클릭하면 발생시키는 전역 이벤트.
 *  TodoAppDialog(앱 셸 전역 마운트)가 수신해 QR 모달을 연다 — 라우팅·URL 변경 없이 열어서
 *  현재 경로·쿼리 상태(예: /projects?project=all)를 잃지 않는다. */
export const OPEN_TODO_APP_EVENT = "que:open-todo-app";

export interface MenuItem {
  /** 이동 경로. 단, `#`으로 시작하면 라우트가 아니라 **모달 액션**이다(예: `#todo-app`).
   *  네비 컴포넌트는 이런 항목을 링크가 아니라 버튼으로 렌더하고, 클릭 시 전역 이벤트
   *  (OPEN_TODO_APP_EVENT)를 쏜다. 라우팅을 안 하므로 현재 화면 상태를 보존한다.
   *  `http`로 시작하거나 external=true면 외부 링크로 판정한다(아래 external 참고). */
  href: string;
  label: string;
  icon: LucideIcon;
  /** 외부 링크(다른 도메인 전용 화면). 네비는 `<a target="_blank" rel="noopener noreferrer">`로
   *  렌더하고 ExternalLink 아이콘을 덧붙이며, 현재 경로 active 하이라이트를 하지 않는다.
   *  생략 시 href가 `http`로 시작하면 자동으로 외부로 본다(nav의 판정 규약과 일치). */
  external?: boolean;
  /** 아이콘 틴트용 포인트 컬러(CSS 컬러). '바로가기' 섹션 전용 — 각 앱의 정체성 색을 아이콘에만 입힌다.
   *  상태색 의미(green=진행 등)와 혼동되지 않게 배경·뱃지에는 쓰지 않고 아이콘 색만 바꾼다. */
  accentColor?: string;
  /** 테마 반응 하이라이트 — 아이콘+텍스트에 `var(--que-nav-accent)`(라이트 #00C3FF / 다크 #FFE500) 적용.
   *  최빈 메뉴 4항목(데일리·작업목록·프로젝트·일정) 통일 하이라이트.
   *  accentColor(개별 하드코딩·아이콘만)와 구분한다. 상태색 의미와 무관한 신규 변수라 배경·뱃지엔 안 쓴다. */
  navAccent?: boolean;
  /** 병합 메뉴의 active 매칭 경로. 없으면 href로 매칭한다. */
  match?: string[];
  /** 사이드바 우측 뱃지 정적 폴백. 실데이터는 레이아웃이 SidebarNav의 badges prop으로 href별 주입. */
  badge?: number;
  /** 관리자에게만 노출하는 메뉴(예: 클라이언트 관리). 페이지·서버 액션에서도 별도로 강제한다(UI만 믿지 않음). */
  adminOnly?: boolean;
  /** 화면 내부 URL 탭을 사이드바 트리에서도 펼쳐 접근하기 위한 하위 항목.
   *  풀 사이드바(SidebarNav)만 chevron 토글로 노출한다(축소 레일은 미노출 — 기존 동작 유지).
   *  화면 내부 탭은 그대로 유지해 양쪽 접근이 공존한다. href는 탭 파라미터를 포함할 수 있다
   *  (예: `/team?view=report`). adminOnly 하위는 비관리자에게 숨긴다(role은 서버가 재판정). */
  children?: { label: string; href: string; adminOnly?: boolean }[];
  /** 최빈 사용 메뉴 강조(볼드) — 사원의 하루 최빈 화면(데일리·작업 목록)에만 사용
   *  (2026-07-16 사용자 확정 "사원들이 자주 봐야 하는 메뉴는 볼드"). 남발하면 강조가 죽는다. */
  emphasized?: boolean;
}

export interface MenuSection {
  /** 섹션 라벨(워크스페이스 위 라벨 제외). */
  label: string;
  items: MenuItem[];
}

// 새 IA (Figma 사이드바 기준). URL은 기존 화면을 유지하고 label만 새 IA로 재정의한다.
// 작업 목록(/today)·Now(/now)는 2026-07-11 독립 메뉴로 분리(탭 병합 폐기).
// 확인필요(/meeting-notes·/action)는 탭 병합이라 match로 active를 잡는다.
// 프로젝트(/projects)는 core Task DB화 완료로 전원 노출한다(카드=core Task, 컬럼=status 4열).
// 쓰기 권한은 core canEditTask가 카드 단위로 강제한다(adminOnly 아님).
export const MENU_SECTIONS: MenuSection[] = [
  {
    label: "메뉴",
    items: [
      // 순서: 실행(할 일·프로젝트·일정) → 운영(팀 현황·회의록·반복) → 분석/참조(성과·팀).
      // 매일 쓰는 화면을 상단으로. (2026-07-07 UX 감사 IA 재정렬)
      { href: "/home", label: "홈", icon: Home },
      // 데일리 스탠드업(/daily) — 매일 10시 비동기 체크인 오늘 보드. 홈 바로 아래(매일 쓰는 화면 상단 IA).
      // 전원 접근. 하위: URL 탭(오늘=기본 / OKR=?tab=okr)을 사이드바에서도 펼침(기획 §4).
      {
        href: "/daily",
        label: "데일리",
        icon: CalendarCheck,
        emphasized: true, // 사원 최빈 화면(하루 1회 체크인) — 2026-07-16 볼드 확정
        // 테마 반응 하이라이트(아이콘+텍스트, 라이트 #00C3FF·다크 #FFE500) — 최빈 메뉴 4항목 통일.
        navAccent: true,
        children: [
          { label: "오늘", href: "/daily" },
          { label: "OKR", href: "/daily?tab=okr" },
          { label: "회고", href: "/daily?tab=retro" },
        ],
      },
      // Copilot(/copilot)은 사이드바 메뉴에서 상단바 '작업 추가' 옆으로 이관했다(2026-07-15 사용자 확정 —
      // ⌘K 팔레트 채팅이 좁아 별도 화면으로 승격했던 이력 유지, 진입점만 상단바로 이동). 여기에는 항목을 두지 않는다.
      // 작업 목록(/today) — 오늘 개인 진입점(팀원). 2026-07-11 Now를 독립 메뉴로 분리(탭 병합 폐기).
      // 하위: 상단 패널 스위처(현황=기본 / 입력=?panel=input)를 사이드바에서도 펼침.
      {
        href: "/today",
        label: "작업 목록",
        icon: ListChecks,
        emphasized: true, // 사원 최빈 화면(할 일 확인·완료 체크 하루 수회) — 2026-07-16 볼드 확정
        // 테마 반응 하이라이트(아이콘+텍스트, 라이트 #00C3FF·다크 #FFE500) — 최빈 메뉴 4항목 통일.
        navAccent: true,
        children: [
          { label: "현황", href: "/today" },
          { label: "입력", href: "/today?panel=input" },
        ],
      },
      // 프로젝트 PM 도구 — 목록/보드/간트. 카드=core Task. 전원 노출(쓰기는 카드별 권한).
      // 하위는 뷰 3종 전부(2026-07-20 사용자 "서브 메뉴 안 보임/목록·보드" — 종전 간트 1개만에서 확장).
      // 간트 href는 view 파라미터 없는 기본 경로 — 기본 뷰=간트라 동작 동일하고, view 미지정 URL에서도
      // matchChild score-0 폴백으로 활성 하이라이트가 붙는다(view=gantt 명시 href면 기본 진입 시 하이라이트 누락).
      {
        href: "/projects",
        label: "프로젝트",
        icon: FolderKanban,
        // 테마 반응 하이라이트(아이콘+텍스트) — 최빈 메뉴 4항목 통일. emphasized(볼드)는 안 붙임(볼드는 2개 한정).
        navAccent: true,
        children: [
          { label: "목록", href: "/projects?view=list" },
          { label: "보드", href: "/projects?view=board" },
          { label: "간트", href: "/projects" },
        ],
      },
      // 일정 — 테마 반응 하이라이트(아이콘+텍스트) 대상 4항목. 볼드는 미적용.
      { href: "/schedule", label: "일정", icon: Calendar, navAccent: true },
      // 회의록·확인필요(/action) 탭 병합 — 실행 그룹(데일리·작업목록·프로젝트·일정) 바로 뒤로 승격
      // (2026-07-15 사용자: "…일정 / 다음 회의록이 오게"). 사이드바 하위로도 두 라우트를 펼침.
      {
        href: "/meeting-notes",
        label: "회의록",
        icon: FileText,
        match: ["/meeting-notes", "/action"],
        children: [
          { label: "회의록", href: "/meeting-notes" },
          { label: "확인필요", href: "/action" },
          // 결정 로그(명세 B-4) — 회의록 라우트의 ?tab= 분기. AI가 추출한 "명시된 결정" 조회 전용.
          { label: "결정", href: "/meeting-notes?tab=decisions" },
        ],
      },
      // Now 운영표(/now) — 회의 Action·캘린더 일정 연결 확인 팀 운영표. 운영 성격이라 팀 현황 옆에 둔다.
      // 2026-07-11 '작업 목록'과의 탭 병합에서 독립 메뉴로 승격(현행 접근 유지 — adminOnly 아님).
      { href: "/now", label: "Now", icon: Activity },
      // 팀 현황(/team) — 운영 보드/[관리자]리포트. 관리자·팀장 상시 사용 핵심 운영 화면.
      // 하위: 뷰 스위처(운영 보드/리포트)를 사이드바에서도 펼침. 리포트는 관리자 전용.
      // 스탠드업 뷰는 /daily로 완전 대체(기획 §8-4, Phase 2) — 데일리 메뉴가 이미 있어 하위에서 제거.
      {
        href: "/team",
        label: "팀 현황",
        icon: LayoutDashboard,
        children: [
          { label: "운영 보드", href: "/team" },
          { label: "리포트", href: "/team?view=report", adminOnly: true },
        ],
      },
      // 반복 업무 템플릿(Task 자동 생성) + 프로젝트 마일스톤 관리. 백엔드는 기존 완성분 재연결.
      // 하위: 반복 업무(기본) / 마일스톤(?tab=milestones) 탭을 사이드바에서도 펼침.
      {
        href: "/planning",
        label: "반복·마일스톤",
        icon: Milestone,
        children: [
          { label: "반복 업무", href: "/planning" },
          { label: "마일스톤", href: "/planning?tab=milestones" },
        ],
      },
      // 성과(/heatmap) — 분석 화면(비-daily)이라 실행 화면들 아래로.
      { href: "/heatmap", label: "성과", icon: ChartColumn },
      // 멤버(/members) — 조회 전용, 분석/참조 성격이라 하단. (2026-07-11 라벨 '팀'→'멤버' — '팀 현황'과 혼동 방지)
      { href: "/members", label: "멤버", icon: Users },
    ],
  },
  {
    // 바로가기 — Que 밖의 전용 화면(다른 도메인) 6개. 순서 고정(간트→뷰→투두→컬러→폰트→인터뷰).
    // 전부 external 링크라 새 탭으로 열리고 active 하이라이트가 없다. 아이콘에만 포인트 컬러를 입힌다
    // (상태색 의미와 분리 — 배경·뱃지 금지). '기타' 위에 둬 자주 여는 외부 도구를 가깝게 배치한다.
    // 풀 사이드바(SidebarNav)는 이 섹션을 2열 버튼 칩 그리드로 렌더한다(리스트 행 대신 — 아이콘 틴트+라벨,
    // 테두리·hover, 40px 터치). 축소 레일·모바일 시트는 기존 동작(레일=아이콘 전용, 시트=SidebarNav 재사용).
    // 기존 'TODO 앱' QR 모달(#todo-app)은 여기 '투두'(외부 링크)로 통합해 메뉴 진입점을 이관했다
    // (TodoAppDialog·`#` 모달 규약은 유지 — 도움말 참조·향후 재사용 대비).
    label: "바로가기",
    items: [
      // 간트: 마일스톤 그라데이션 정체성 → 시안 계열.
      {
        href: "https://gant.griff.co.kr",
        label: "간트",
        icon: GanttChart,
        external: true,
        accentColor: "#06b6d4",
      },
      // 뷰: 블루.
      {
        href: "https://view.griff.co.kr",
        label: "뷰",
        icon: Eye,
        external: true,
        accentColor: "#3b82f6",
      },
      // 투두(DayBlocks): 그린. 구 'TODO 앱' 통합 — 휴대폰은 주소로 직접 접속, 데스크톱은 새 탭.
      {
        href: "https://todo.griff.co.kr",
        label: "투두",
        icon: ListTodo,
        external: true,
        accentColor: "#22c55e",
      },
      // 컬러: 핑크(상태색 violet과 혼동 방지 — 바로가기 아이콘 틴트 전용).
      {
        href: "https://color.griff.co.kr",
        label: "컬러",
        icon: Palette,
        external: true,
        accentColor: "#ec4899",
      },
      // 폰트(폰트 페어링): 버밀리언 코럴 — 폰트페어 사이트 원 정체성 색. Que 브랜드 인디고와 겹치지 않아
      // 메뉴 아이콘 틴트로 적합(현 사이트 UI는 인디고지만 메뉴 구분용으로는 코럴 유지).
      {
        href: "https://font.griff.co.kr",
        label: "폰트",
        icon: Type,
        external: true,
        accentColor: "#ec5a29",
      },
      // 인터뷰(interview.griff.co.kr): 대표 인터뷰·질문지 앱(별도 도메인, DB만 Que Supabase 공유 — iv_ 접두
      // 테이블). 바이올렛 — 기존 5색(시안·블루·그린·핑크·코럴)과 구분되는 아이콘 틴트 전용(배경·뱃지 금지).
      {
        href: "https://interview.griff.co.kr",
        label: "인터뷰",
        icon: ClipboardList,
        external: true,
        accentColor: "#8b5cf6",
      },
    ],
  },
  {
    label: "기타",
    items: [
      // 클라이언트(거래처)·프로젝트 관리 — 관리자 전용. adminOnly로 사이드바 노출을 막고,
      // 페이지(서버)와 서버 액션(core mutation)이 다시 강제한다(3중 게이트).
      { href: "/clients", label: "클라이언트", icon: Building2, adminOnly: true },
      { href: "/payments", label: "결제요청", icon: Receipt },
      // 수정사항(이슈/피드백) 트래커 — 테스트 중 발견한 수정사항 팀 공용 목록. 전원 접근(adminOnly 아님).
      { href: "/revisions", label: "수정사항", icon: Bug },
      { href: "/tools", label: "MCP · CLI", icon: Terminal },
      // 일정 임포트(/import) — 타 프로젝트 일정시트(YAML 양식)를 미리보기 후 일괄 등록.
      // 클라이언트 생성이 걸려 있어 관리자 전용(서버 액션이 role 재판정). 2026-07-21 신설.
      { href: "/import", label: "일정 임포트", icon: FileUp, adminOnly: true },
      // 온보딩(/onboard) — Que를 처음 쓰는 팀원용 시작 가이드(정적 안내). 도움말 위에 둔다.
      { href: "/onboard", label: "온보딩", icon: Rocket },
      { href: "/help", label: "도움말", icon: CircleHelp },
      // 설계 FAQ(/faq) — "왜 이렇게 만들었나" 류 질문 모음. 도움말이 '사용법'이면 이곳은 '이유'다.
      // 도움말과 아이콘 혼동 방지로 MessageCircleQuestion 사용(도움말=CircleHelp).
      { href: "/faq", label: "설계 FAQ", icon: MessageCircleQuestion },
      { href: "/settings", label: "설정", icon: Settings },
    ],
  },
];
