import {
  Sun,
  Gauge,
  CalendarDays,
  Users,
  Flame,
  FileText,
  ListChecks,
  FolderKanban,
  CreditCard,
  type LucideIcon,
} from "lucide-react";

export interface MenuItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** 사이드바 tooltip 등에 쓰는 짧은 설명 */
  description: string;
}

// 확정 메뉴 구조 (CLAUDE.md). 캘린더는 단일 메뉴 — 뷰 전환은 /calendar 안에서 한다.
// 알림/설정은 개발 후순위라 아직 넣지 않는다.
export const MENU: MenuItem[] = [
  { href: "/today", label: "오늘", icon: Sun, description: "내 하루를 시작하는 개인 화면" },
  { href: "/now", label: "Now", icon: Gauge, description: "회의 Action과 캘린더 일정이 연결됐는지 확인하는 팀 운영표" },
  { href: "/calendar", label: "캘린더", icon: CalendarDays, description: "회사 일정, 작업, 마일스톤을 한 시간축에서" },
  { href: "/team", label: "팀 현황", icon: Users, description: "오늘 팀의 업무 흐름과 병목" },
  { href: "/heatmap", label: "히트맵", icon: Flame, description: "멤버별 작업량 편차" },
  { href: "/meeting-notes", label: "회의록", icon: FileText, description: "Plaud 회의록 업로드와 Action 추출" },
  { href: "/action", label: "Action", icon: ListChecks, description: "회의록 Task 후보 확정" },
  { href: "/projects", label: "프로젝트", icon: FolderKanban, description: "마일스톤과 연결 작업 추적" },
  { href: "/payments", label: "결제", icon: CreditCard, description: "결제 요청 등록과 입금 상태" },
];
