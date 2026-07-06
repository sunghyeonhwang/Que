import type { RevisionNoteStatus } from "@que/core";
import type { BadgeTone } from "@/components/app/tone-badge";
import { MENU_SECTIONS } from "@/lib/menu";

// 수정사항 트래커 공용 상수 — 폼/목록/필터가 함께 쓴다.
// 상태 라벨 매핑은 프론트에서만 한다(core는 enum 값만 안다).
// 상태 색상 의미 고정(CLAUDE.md): 미해결=red(문제) · 보류=amber(대기) · 해결=green(완료).

export const REVISION_STATUS_LABELS: Record<RevisionNoteStatus, string> = {
  unresolved: "미해결",
  hold: "보류",
  resolved: "해결",
};

export const REVISION_STATUS_TONE: Record<RevisionNoteStatus, BadgeTone> = {
  unresolved: "red",
  hold: "amber",
  resolved: "green",
};

// Select에 넣을 상태 순서(등록/변경/필터 공용).
export const REVISION_STATUSES: RevisionNoteStatus[] = ["unresolved", "hold", "resolved"];

// 메뉴 옵션 소스 — menu.ts의 MENU_SECTIONS 라벨을 flatten하고,
// 메뉴 밖에서 나오는 수정사항을 위해 외부 뷰어와 기타를 덧붙인다.
// 백엔드는 자유 텍스트를 허용하지만 UI는 Select로 오타/표기 흔들림을 줄인다.
export const REVISION_MENU_OPTIONS: string[] = [
  ...MENU_SECTIONS.flatMap((section) => section.items.map((item) => item.label)),
  "view.griff.co.kr",
  "기타",
];

/** 작성/변경 시각 KST 표기(TZ는 instrumentation.ts에서 Asia/Seoul 고정). */
export function formatRevisionTime(iso: string): string {
  return new Date(iso).toLocaleString("ko-KR", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}
