import { AlertTriangle, Clock, HandHelping, Pause, type LucideIcon } from "lucide-react";
import type { AttentionEntry } from "@/lib/team-data";

// 주의 필요(Attention) 상태 → 배지 표현(아이콘·라벨·색)의 단일 소스.
// 홈(AttentionList)과 팀 현황(team/page.tsx AttentionRow)이 이 맵을 공유해
// 같은 상태를 같은 색으로 렌더한다(DASH-2: 화면마다 색이 달라지는 것 방지).
// 상태색 의미 고정: red=문제, amber=홀드/대기, violet=응답대기/도움요청(회의록·응답 계열).
export const ATTENTION_CONFIG: Record<
  AttentionEntry["type"],
  { icon: LucideIcon; label: string; className: string }
> = {
  issue: {
    icon: AlertTriangle,
    label: "문제발생",
    className: "border-[var(--que-error)] bg-[var(--que-error-bg)] text-[var(--que-error)]",
  },
  on_hold: {
    icon: Pause,
    label: "홀드",
    className:
      "border-[var(--que-warning)] bg-[var(--que-warning-bg)] text-[var(--que-warning)]",
  },
  awaiting_response: {
    icon: Clock,
    label: "응답대기",
    className:
      "border-[var(--que-violet)] bg-[var(--que-violet-bg)] text-[var(--que-violet)]",
  },
  help_request: {
    icon: HandHelping,
    label: "도움 요청",
    className:
      "border-[var(--que-violet)] bg-[var(--que-violet-bg)] text-[var(--que-violet)]",
  },
};
