import {
  Home,
  Calendar,
  ChartColumn,
  ListChecks,
  Users,
  LayoutDashboard,
  MessageSquareText,
  Receipt,
  Settings,
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
}

export interface MenuSection {
  /** 섹션 라벨(워크스페이스 위 라벨 제외). */
  label: string;
  items: MenuItem[];
}

// 새 IA (Figma 사이드바 기준). URL은 기존 화면을 유지하고 label만 새 IA로 재정의한다.
// 작업 목록(/today·/now)·확인필요(/meeting-notes·/action)는 탭 병합이라 match로 active를 잡는다.
// 프로젝트(/projects)는 신규 PM 모델이 in-memory mock(비영속)이라 출시 메뉴에서 제외 —
// DB화 후 복귀(HANDOFF 51). 직접 URL 접근 시 페이지에 '미리보기(저장 안 됨)' 배너 노출.
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
        label: "확인필요",
        icon: MessageSquareText,
        match: ["/meeting-notes", "/action"],
      },
    ],
  },
  {
    label: "기타",
    items: [
      { href: "/payments", label: "결제요청", icon: Receipt },
      { href: "/settings", label: "설정", icon: Settings },
    ],
  },
];
