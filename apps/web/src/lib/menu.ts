import {
  Home,
  FolderKanban,
  Calendar,
  ChartColumn,
  ListChecks,
  Users,
  MessageSquareText,
  Receipt,
  type LucideIcon,
} from "lucide-react";

export interface MenuItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** 병합 메뉴의 active 매칭 경로. 없으면 href로 매칭한다. */
  match?: string[];
  /** 사이드바 우측 뱃지 숫자(확인필요 등). 후속에 실데이터 연결. */
  badge?: number;
}

export interface MenuSection {
  /** 섹션 라벨(워크스페이스 위 라벨 제외). */
  label: string;
  items: MenuItem[];
}

// 새 IA (Figma 사이드바 기준). URL은 기존 화면을 유지하고 label만 새 IA로 재정의한다.
// 작업 목록(/today·/now)·확인필요(/meeting-notes·/action)는 탭 병합이라 match로 active를 잡는다.
export const MENU_SECTIONS: MenuSection[] = [
  {
    label: "메뉴",
    items: [
      { href: "/home", label: "홈", icon: Home },
      { href: "/projects", label: "프로젝트", icon: FolderKanban },
      { href: "/schedule", label: "일정", icon: Calendar },
      { href: "/heatmap", label: "성과", icon: ChartColumn },
      {
        href: "/today",
        label: "작업 목록",
        icon: ListChecks,
        match: ["/today", "/now"],
      },
      { href: "/members", label: "팀", icon: Users },
      {
        href: "/meeting-notes",
        label: "확인필요",
        icon: MessageSquareText,
        match: ["/meeting-notes", "/action"],
        badge: 4,
      },
    ],
  },
  {
    label: "기타",
    items: [{ href: "/payments", label: "결제요청", icon: Receipt }],
  },
];
