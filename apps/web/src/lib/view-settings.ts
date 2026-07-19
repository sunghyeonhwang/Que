import { useSyncExternalStore } from "react";

// 공개 현황판(view) 슬라이드쇼 설정. 무인증·공개 페이지라 서버 저장 대신 기기별 localStorage에 둔다.
// - 설정 다이얼로그(view-settings.tsx)가 쓰고, SlideshowController가 읽어 순회 동작을 구동한다.
// - 저장 시 CustomEvent(VIEW_SETTINGS_EVENT)를 dispatch → 같은 탭의 컨트롤러가 즉시 재구독(다음 스텝부터 반영).
// - 다른 탭 반영은 window "storage" 이벤트로 커버.
// - 모든 읽기/쓰기는 SSR 안전(typeof window 가드) + 값 방어(normalizeSettings clamp/enum 검증).

export type ViewSlideScheduleRange = "1day" | "3day";
export type ViewSlideBoardMode = "paged" | "all";

export interface ViewSettings {
  /** 보드 페이지(또는 전체 보드 화면) 표시 시간(초). */
  boardSeconds: number;
  /** 스케줄 표시 시간(초). */
  scheduleSeconds: number;
  /** 슬라이드쇼 스케줄 뷰 범위. */
  scheduleRange: ViewSlideScheduleRange;
  /** 슬라이드쇼 보드 모드. paged=2명/페이지 순회, all=전체 8명 한 화면. */
  boardMode: ViewSlideBoardMode;
  /** 순회에 보드 포함. */
  includeBoard: boolean;
  /** 순회에 스케줄 포함. */
  includeSchedule: boolean;
  /** 순회에 마일스톤 스트립 페이지 포함. */
  includeMilestones: boolean;
  /** 순회에 위험 보드(문제·홀드) 페이지 포함. */
  includeRisk: boolean;
}

export const VIEW_SETTINGS_STORAGE_KEY = "que-view-settings";
export const VIEW_SETTINGS_EVENT = "que-view-settings-change";

export const VIEW_SECONDS_MIN = 5;
export const VIEW_SECONDS_MAX = 600;

export const DEFAULT_VIEW_SETTINGS: ViewSettings = {
  boardSeconds: 25,
  scheduleSeconds: 120,
  scheduleRange: "3day",
  boardMode: "paged",
  includeBoard: true,
  includeSchedule: true,
  includeMilestones: false,
  includeRisk: false,
};

/** 초 값을 [MIN, MAX]로 clamp하고 정수로 반올림. 숫자가 아니면 fallback. */
export function clampSeconds(value: unknown, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(VIEW_SECONDS_MAX, Math.max(VIEW_SECONDS_MIN, Math.round(n)));
}

/** 임의 입력(localStorage JSON 등)을 안전한 ViewSettings로 정규화한다. */
export function normalizeSettings(raw: unknown): ViewSettings {
  const o =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const range = o.scheduleRange;
  const bmode = o.boardMode;
  return {
    boardSeconds: clampSeconds(o.boardSeconds, DEFAULT_VIEW_SETTINGS.boardSeconds),
    scheduleSeconds: clampSeconds(
      o.scheduleSeconds,
      DEFAULT_VIEW_SETTINGS.scheduleSeconds,
    ),
    scheduleRange:
      range === "1day" || range === "3day"
        ? range
        : DEFAULT_VIEW_SETTINGS.scheduleRange,
    boardMode:
      bmode === "all" || bmode === "paged"
        ? bmode
        : DEFAULT_VIEW_SETTINGS.boardMode,
    includeBoard:
      typeof o.includeBoard === "boolean"
        ? o.includeBoard
        : DEFAULT_VIEW_SETTINGS.includeBoard,
    includeSchedule:
      typeof o.includeSchedule === "boolean"
        ? o.includeSchedule
        : DEFAULT_VIEW_SETTINGS.includeSchedule,
    includeMilestones:
      typeof o.includeMilestones === "boolean"
        ? o.includeMilestones
        : DEFAULT_VIEW_SETTINGS.includeMilestones,
    includeRisk:
      typeof o.includeRisk === "boolean"
        ? o.includeRisk
        : DEFAULT_VIEW_SETTINGS.includeRisk,
  };
}

/** localStorage에서 설정을 읽는다(클라이언트 전용, 실패 시 기본값). */
export function loadViewSettings(): ViewSettings {
  if (typeof window === "undefined") return DEFAULT_VIEW_SETTINGS;
  try {
    const raw = window.localStorage.getItem(VIEW_SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_VIEW_SETTINGS;
    return normalizeSettings(JSON.parse(raw));
  } catch {
    return DEFAULT_VIEW_SETTINGS;
  }
}

/** 설정을 저장하고 같은 탭에 변경 이벤트를 알린다. */
export function saveViewSettings(settings: ViewSettings): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      VIEW_SETTINGS_STORAGE_KEY,
      JSON.stringify(settings),
    );
    window.dispatchEvent(new CustomEvent(VIEW_SETTINGS_EVENT));
  } catch {
    // 저장 실패(quota/private mode)는 무시 — 기본값으로 계속 동작.
  }
}

// ---- 외부 스토어(localStorage) 구독 ----
// useSyncExternalStore용: getSnapshot이 안정 참조를 반환하도록 원본 문자열 기준으로 캐시한다
// (매 호출 새 객체를 만들면 React가 무한 재렌더로 판단). 원본이 바뀔 때만 재파싱.

let snapshotCache: ViewSettings = DEFAULT_VIEW_SETTINGS;
let snapshotKey: string | null = null;

function getStoreSnapshot(): ViewSettings {
  if (typeof window === "undefined") return DEFAULT_VIEW_SETTINGS;
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(VIEW_SETTINGS_STORAGE_KEY);
  } catch {
    raw = null;
  }
  if (raw === snapshotKey) return snapshotCache;
  snapshotKey = raw;
  if (!raw) {
    snapshotCache = DEFAULT_VIEW_SETTINGS;
    return snapshotCache;
  }
  try {
    snapshotCache = normalizeSettings(JSON.parse(raw));
  } catch {
    snapshotCache = DEFAULT_VIEW_SETTINGS;
  }
  return snapshotCache;
}

function getServerSnapshot(): ViewSettings {
  return DEFAULT_VIEW_SETTINGS;
}

function subscribeStore(onChange: () => void): () => void {
  window.addEventListener(VIEW_SETTINGS_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(VIEW_SETTINGS_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/**
 * 현재 설정을 구독하는 클라이언트 훅(useSyncExternalStore).
 * - SSR/첫 렌더는 기본값 → 마운트 후 localStorage 값 반영(하이드레이션 안전).
 * - 저장(같은 탭 CustomEvent)·다른 탭(storage) 변경에 반응해 재렌더한다.
 */
export function useViewSettings(): ViewSettings {
  return useSyncExternalStore(
    subscribeStore,
    getStoreSnapshot,
    getServerSnapshot,
  );
}
