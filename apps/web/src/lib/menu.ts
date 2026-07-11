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
  Milestone,
  Building2,
  FolderKanban,
  Bug,
  Smartphone,
  type LucideIcon,
} from "lucide-react";

/** menu.ts의 `#todo-app` 액션 항목을 클릭하면 발생시키는 전역 이벤트.
 *  TodoAppDialog(앱 셸 전역 마운트)가 수신해 QR 모달을 연다 — 라우팅·URL 변경 없이 열어서
 *  현재 경로·쿼리 상태(예: /projects?project=all)를 잃지 않는다. */
export const OPEN_TODO_APP_EVENT = "que:open-todo-app";

export interface MenuItem {
  /** 이동 경로. 단, `#`으로 시작하면 라우트가 아니라 **모달 액션**이다(예: `#todo-app`).
   *  네비 컴포넌트는 이런 항목을 링크가 아니라 버튼으로 렌더하고, 클릭 시 전역 이벤트
   *  (OPEN_TODO_APP_EVENT)를 쏜다. 라우팅을 안 하므로 현재 화면 상태를 보존한다. */
  href: string;
  label: string;
  icon: LucideIcon;
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
      // 전원 접근. children 없음(OKR 탭은 Phase 3에서 추가 예정).
      { href: "/daily", label: "데일리", icon: CalendarCheck },
      // 작업 목록(/today) — 오늘 개인 진입점(팀원). 2026-07-11 Now를 독립 메뉴로 분리(탭 병합 폐기).
      // 하위: 상단 패널 스위처(현황=기본 / 입력=?panel=input)를 사이드바에서도 펼침.
      {
        href: "/today",
        label: "작업 목록",
        icon: ListChecks,
        children: [
          { label: "현황", href: "/today" },
          { label: "입력", href: "/today?panel=input" },
        ],
      },
      // 프로젝트 PM 도구 — 보드(status 4열)/목록/캘린더. 카드=core Task. 전원 노출(쓰기는 카드별 권한).
      { href: "/projects", label: "프로젝트", icon: FolderKanban },
      { href: "/schedule", label: "일정", icon: Calendar },
      // Now 운영표(/now) — 회의 Action·캘린더 일정 연결 확인 팀 운영표. 운영 성격이라 팀 현황 옆에 둔다.
      // 2026-07-11 '작업 목록'과의 탭 병합에서 독립 메뉴로 승격(현행 접근 유지 — adminOnly 아님).
      { href: "/now", label: "Now", icon: Activity },
      // 팀 현황(/team) — 스탠드업·[관리자]리포트·운영보드. 관리자·팀장 상시 사용 핵심 운영 화면.
      // 하위: 뷰 스위처(운영 보드/스탠드업/리포트)를 사이드바에서도 펼침. 리포트는 관리자 전용.
      {
        href: "/team",
        label: "팀 현황",
        icon: LayoutDashboard,
        children: [
          { label: "운영 보드", href: "/team" },
          { label: "스탠드업", href: "/team?view=standup" },
          { label: "리포트", href: "/team?view=report", adminOnly: true },
        ],
      },
      // 회의록·확인필요(/action) 탭 병합 — 사이드바 하위로도 두 라우트를 펼침.
      {
        href: "/meeting-notes",
        label: "회의록",
        icon: FileText,
        match: ["/meeting-notes", "/action"],
        children: [
          { label: "회의록", href: "/meeting-notes" },
          { label: "확인필요", href: "/action" },
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
    label: "기타",
    items: [
      // 클라이언트(거래처)·프로젝트 관리 — 관리자 전용. adminOnly로 사이드바 노출을 막고,
      // 페이지(서버)와 서버 액션(core mutation)이 다시 강제한다(3중 게이트).
      { href: "/clients", label: "클라이언트", icon: Building2, adminOnly: true },
      { href: "/payments", label: "결제요청", icon: Receipt },
      // 수정사항(이슈/피드백) 트래커 — 테스트 중 발견한 수정사항 팀 공용 목록. 전원 접근(adminOnly 아님).
      { href: "/revisions", label: "수정사항", icon: Bug },
      // TODO 앱(DayBlocks) 접속 QR 모달 — 라우트가 아니라 모달 액션(`#` 규약, 위 MenuItem 주석).
      // 소비처가 링크 대신 버튼으로 렌더하고 클릭 시 전역 이벤트(OPEN_TODO_APP_EVENT)를 dispatch →
      // 앱 셸에 전역 마운트된 TodoAppDialog가 수신해 QR 모달을 연다(URL 무변경 → 화면 상태 보존).
      { href: "#todo-app", label: "TODO 앱", icon: Smartphone },
      { href: "/tools", label: "MCP · CLI", icon: Terminal },
      { href: "/help", label: "도움말", icon: CircleHelp },
      { href: "/settings", label: "설정", icon: Settings },
    ],
  },
];
