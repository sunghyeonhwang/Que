import type { MyTaskTab, TaskGroupKey, TaskSortKey } from "./my-tasks-data";

/** /today 상단 패널 스위처 값. status=현황+리스트, input=입력+리스트. 기본 status. */
export type TodayPanel = "status" | "input";

export function parseTodayPanel(value: string | undefined): TodayPanel {
  return value === "input" ? "input" : "status";
}

/** ?sort= 화이트리스트 파싱. 알 수 없는 값은 기본(마감순)으로. */
export function parseTodaySort(value: string | undefined): TaskSortKey {
  return value === "priority" ? "priority" : "due";
}

/** ?group= 화이트리스트 파싱. 알 수 없는 값은 기본(그룹 없음)으로. */
export function parseTodayGroup(value: string | undefined): TaskGroupKey {
  return value === "project" ? "project" : "none";
}

/** /today 링크를 만든다. panel(상단 스위처)·tab(리스트 필터)에 더해 sort·group(표 보기 옵션)까지
 *  보존해, 하나를 바꿔도 다른 값이 초기화되지 않게 한다. 기본값은 URL에서 생략한다. */
export function buildTodayHref(
  tab: MyTaskTab,
  panel: TodayPanel,
  view?: { sort?: TaskSortKey; group?: TaskGroupKey },
): string {
  const params = new URLSearchParams();
  if (panel !== "status") params.set("panel", panel);
  if (tab !== "all") params.set("tab", tab);
  if (view?.sort && view.sort !== "due") params.set("sort", view.sort);
  if (view?.group && view.group !== "none") params.set("group", view.group);
  const qs = params.toString();
  return qs ? `/today?${qs}` : "/today";
}
