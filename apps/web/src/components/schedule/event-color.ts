import type { CalendarViewItem } from "@/lib/calendar-data";

/** 일정 블록 색 스와치. bg/border는 파스텔 배경, accent는 시간 배지 텍스트/좌측 강조. */
export interface EventSwatch {
  bg: string;
  border: string;
  accent: string;
  text: string;
}

// 카테고리 팔레트 (초록/파랑/분홍/노랑/청록). 값은 globals.css --ev-* 토큰(라이트=파스텔·
// 다크=어두운 틴트)을 참조 — 소비처(month-view·week-calendar)가 인라인 style이라 var() 해석됨.
// 일반 이벤트·작업은 id 해시로 안정 배정한다(같은 항목 = 항상 같은 색).
// violet은 회의록/응답대기 고정 의미(CLAUDE.md §색상)라 일반 항목 해시 팔레트에서 제외한다.
const PALETTE: EventSwatch[] = [
  { bg: "var(--ev-green-bg)", border: "var(--ev-green-border)", accent: "var(--ev-green-accent)", text: "var(--ev-green-text)" },
  { bg: "var(--ev-blue-bg)", border: "var(--ev-blue-border)", accent: "var(--ev-blue-accent)", text: "var(--ev-blue-text)" },
  { bg: "var(--ev-pink-bg)", border: "var(--ev-pink-border)", accent: "var(--ev-pink-accent)", text: "var(--ev-pink-text)" },
  { bg: "var(--ev-amber-bg)", border: "var(--ev-amber-border)", accent: "var(--ev-amber-accent)", text: "var(--ev-amber-text)" },
  { bg: "var(--ev-teal-bg)", border: "var(--ev-teal-border)", accent: "var(--ev-teal-accent)", text: "var(--ev-teal-text)" },
];

// 상태 의미 고정 색. 문제=red, 홀드=amber(주의/대기), 완료=흐리게. 나머지는 팔레트로 넘긴다.
const RED: EventSwatch = {
  bg: "var(--ev-red-bg)",
  border: "var(--ev-red-border)",
  accent: "var(--ev-red-accent)",
  text: "var(--ev-red-text)",
};

// 홀드=amber. PALETTE[4]와 같은 --ev-amber-* 토큰(주의/대기 의미 고정).
const AMBER: EventSwatch = {
  bg: "var(--ev-amber-bg)",
  border: "var(--ev-amber-border)",
  accent: "var(--ev-amber-accent)",
  text: "var(--ev-amber-text)",
};

// 완료 작업은 중립 톤으로 흐리게 — 지난 일 위에 시선이 안 머물게(달력에서 뒤로 물러남).
const DONE: EventSwatch = {
  bg: "var(--que-bg-muted)",
  border: "var(--que-border)",
  accent: "var(--que-text-tertiary)",
  text: "var(--que-text-tertiary)",
};

/** 문자열 → 안정적 양수 해시 (djb2). */
function hash(input: string): number {
  let h = 5381;
  for (let i = 0; i < input.length; i += 1) {
    h = (h * 33) ^ input.charCodeAt(i);
  }
  return Math.abs(h);
}

/** 항목 색 배정: 문제=red·홀드=amber·완료=흐리게. 그 외 작업은 **담당자(ownerId) 해시**로
 *  배정해 같은 사람의 작업이 항상 같은 색이 되게 한다(2026-07-20 사용자 요청 — 같은 담당자의
 *  두 작업이 다른 색으로 보이던 문제). 이벤트(회의·외부)는 기존대로 kind+id 해시. */
export function eventSwatch(item: CalendarViewItem): EventSwatch {
  if (item.kind === "task") {
    if (item.taskStatus === "issue") return RED;
    if (item.taskStatus === "on_hold") return AMBER;
    if (item.taskStatus === "done") return DONE;
    const idx = hash(`task-${item.ownerId || item.id}`) % PALETTE.length;
    return PALETTE[idx];
  }
  const idx = hash(`${item.kind}-${item.id}`) % PALETTE.length;
  return PALETTE[idx];
}
