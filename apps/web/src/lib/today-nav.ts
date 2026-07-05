import type { MyTaskTab } from "./my-tasks-data";

/** /today 상단 패널 스위처 값. status=현황+리스트, input=입력+리스트. 기본 status. */
export type TodayPanel = "status" | "input";

export function parseTodayPanel(value: string | undefined): TodayPanel {
  return value === "input" ? "input" : "status";
}

/** /today 링크를 만든다. panel(상단 스위처)과 tab(리스트 필터)을 함께 보존해
 *  둘 중 하나를 바꿔도 다른 하나가 초기화되지 않게 한다. 기본값은 URL에서 생략. */
export function buildTodayHref(tab: MyTaskTab, panel: TodayPanel): string {
  const params = new URLSearchParams();
  if (panel !== "status") params.set("panel", panel);
  if (tab !== "all") params.set("tab", tab);
  const qs = params.toString();
  return qs ? `/today?${qs}` : "/today";
}
