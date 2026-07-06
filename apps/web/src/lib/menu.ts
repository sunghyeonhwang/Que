import {
  Home,
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
  type LucideIcon,
} from "lucide-react";

export interface MenuItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** 병합 메뉴의 active 매칭 경로. 없으면 href로 매칭한다. */
  match?: string[];
  /** 사이드바 우측 뱃지 정적 폴백. 실데이터는 레이아웃이 SidebarNav의 badges prop으로 href별 주입. */
  badge?: number;
  /** 관리자에게만 노출하는 메뉴(예: 클라이언트 관리). 페이지·서버 액션에서도 별도로 강제한다(UI만 믿지 않음). */
  adminOnly?: boolean;
}

export interface MenuSection {
  /** 섹션 라벨(워크스페이스 위 라벨 제외). */
  label: string;
  items: MenuItem[];
}

// 새 IA (Figma 사이드바 기준). URL은 기존 화면을 유지하고 label만 새 IA로 재정의한다.
// 작업 목록(/today·/now)·확인필요(/meeting-notes·/action)는 탭 병합이라 match로 active를 잡는다.
// 프로젝트(/projects)는 core Task DB화 완료로 전원 노출한다(카드=core Task, 컬럼=status 4열).
// 쓰기 권한은 core canEditTask가 카드 단위로 강제한다(adminOnly 아님).
export const MENU_SECTIONS: MenuSection[] = [
  {
    label: "메뉴",
    items: [
      { href: "/home", label: "홈", icon: Home },
      { href: "/schedule", label: "일정", icon: Calendar },
      { href: "/heatmap", label: "성과", icon: ChartColumn },
      {
        href: "/today",
        label: "작업 목록",
        icon: ListChecks,
        match: ["/today", "/now"],
      },
      { href: "/members", label: "팀", icon: Users },
      // 팀 현황(/team) — 스탠드업·[관리자]리포트·운영보드. 재설계 IA에서 누락됐던 핵심 운영 화면 복귀.
      { href: "/team", label: "팀 현황", icon: LayoutDashboard },
      {
        href: "/meeting-notes",
        label: "회의록",
        icon: FileText,
        match: ["/meeting-notes", "/action"],
      },
      // 반복 업무 템플릿(Task 자동 생성) + 프로젝트 마일스톤 관리. 백엔드는 기존 완성분 재연결.
      { href: "/planning", label: "반복·마일스톤", icon: Milestone },
      // 프로젝트 PM 도구 — 보드(status 4열)/목록/캘린더. 카드=core Task. 전원 노출(쓰기는 카드별 권한).
      { href: "/projects", label: "프로젝트", icon: FolderKanban },
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
      { href: "/help", label: "도움말", icon: CircleHelp },
      { href: "/settings", label: "설정", icon: Settings },
    ],
  },
];
