import {
  CalendarDays,
  Target,
  CalendarClock,
  Activity,
  ListChecks,
  Users,
  FileText,
  CreditCard,
  type LucideIcon,
} from "lucide-react";

export interface MenuItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** 사이드바 tooltip 등에 쓰는 짧은 설명 */
  description: string;
  /** 병합 메뉴의 active 매칭 경로. 없으면 href로 매칭한다. */
  match?: string[];
}

// 확정 메뉴 구조 (메뉴 재편). URL은 유지하고 label만 재정의한다.
// 캘린더는 단일 메뉴 — 뷰 전환은 /calendar 안에서 한다.
// 작업 목록(/today·/now)·회의록(/meeting-notes·/action)은 탭으로 병합돼 match로 active를 잡는다.
// 알림/설정은 개발 후순위라 아직 넣지 않는다.
export const MENU: MenuItem[] = [
  { href: "/calendar", label: "프로젝트", icon: CalendarDays, description: "회사 일정·작업·마일스톤을 한 시간축에서" },
  { href: "/projects", label: "마일스톤", icon: Target, description: "마일스톤·연결 작업·반복 업무 템플릿" },
  { href: "/team", label: "일정", icon: CalendarClock, description: "오늘 팀의 업무 흐름과 병목" },
  { href: "/heatmap", label: "퍼포먼스", icon: Activity, description: "멤버별 작업량 편차" },
  { href: "/today", label: "작업 목록", icon: ListChecks, description: "내 작업(오늘)과 팀 운영표(Now)", match: ["/today", "/now"] },
  { href: "/members", label: "팀", icon: Users, description: "팀원 카드와 업무 요약" },
  { href: "/meeting-notes", label: "회의록", icon: FileText, description: "회의록 업로드·Action 추출·확정", match: ["/meeting-notes", "/action"] },
  { href: "/payments", label: "결제요청", icon: CreditCard, description: "결제 요청 등록과 입금 상태" },
];
