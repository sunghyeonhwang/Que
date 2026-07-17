"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { TaskGroupKey, TaskSortKey } from "@/lib/my-tasks-data";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** 내 작업 표의 정렬·그룹 토글. 값은 URL(?sort=·?group=)로 반영하고 나머지 파라미터(tab·panel)는
 *  그대로 보존한다. 데이터는 이미 전부 내려와 있어 서버 재조회 없이 표가 재정렬된다. */
export function TaskViewControls({
  sort,
  group,
}: {
  sort: TaskSortKey;
  group: TaskGroupKey;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const update = (key: "sort" | "group", value: string | null, fallback: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (!value || value === fallback) params.delete(key);
    else params.set(key, value);
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  return (
    <div className="flex items-center gap-2">
      <Select value={sort} onValueChange={(v) => update("sort", v, "due")}>
        <SelectTrigger aria-label="정렬 기준" className="h-9 w-[132px] text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="due">마감순</SelectItem>
          <SelectItem value="priority">우선순위순</SelectItem>
        </SelectContent>
      </Select>

      <Select value={group} onValueChange={(v) => update("group", v, "none")}>
        <SelectTrigger aria-label="그룹 기준" className="h-9 w-[132px] text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">그룹 없음</SelectItem>
          <SelectItem value="project">프로젝트별</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
