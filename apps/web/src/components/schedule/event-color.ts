import type { CalendarViewItem } from "@/lib/calendar-data";

/** 일정 블록 색 스와치. bg/border는 파스텔 배경, accent는 시간 배지 텍스트/좌측 강조. */
export interface EventSwatch {
  bg: string;
  border: string;
  accent: string;
  text: string;
}

// 파스텔 카테고리 팔레트 (디자인: 보라/초록/파랑/분홍/노랑/청록).
// 일반 이벤트·작업은 id 해시로 안정 배정한다(같은 항목 = 항상 같은 색).
const PALETTE: EventSwatch[] = [
  { bg: "#f3f0ff", border: "#d8ccf7", accent: "#6b4fbb", text: "#3f2d78" }, // violet
  { bg: "#e9f9ef", border: "#c3ecd1", accent: "#1f8b4c", text: "#155f33" }, // green
  { bg: "#eaf2ff", border: "#c9ddfb", accent: "#2f6fdb", text: "#204a91" }, // blue
  { bg: "#fdeef4", border: "#f5cfe0", accent: "#c14b86", text: "#8a3360" }, // pink
  { bg: "#fef6e6", border: "#f5e2b8", accent: "#a6791b", text: "#775410" }, // amber
  { bg: "#e7f8f7", border: "#c0e9e6", accent: "#2a8f8a", text: "#1c635f" }, // teal
];

// 상태 의미 고정 색(파스텔). 문제/취소만 강제로 red, 나머지는 팔레트로 넘긴다.
const RED: EventSwatch = { bg: "#fdeaea", border: "#f3c9c9", accent: "#c62d2d", text: "#8f2020" };

/** 문자열 → 안정적 양수 해시 (djb2). */
function hash(input: string): number {
  let h = 5381;
  for (let i = 0; i < input.length; i += 1) {
    h = (h * 33) ^ input.charCodeAt(i);
  }
  return Math.abs(h);
}

/** 항목 색 배정: 문제/취소 작업은 red, 그 외는 kind+id 해시로 파스텔 팔레트에서 안정 배정. */
export function eventSwatch(item: CalendarViewItem): EventSwatch {
  if (item.kind === "task" && item.taskStatus === "issue") return RED;
  const idx = hash(`${item.kind}-${item.id}`) % PALETTE.length;
  return PALETTE[idx];
}
