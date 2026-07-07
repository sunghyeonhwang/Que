"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ProjectListItem } from "@/lib/projects-data";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** 클라이언트 필터에서 "전체 클라이언트"를 나타내는 URL sentinel(?client=all). */
export const ALL_CLIENTS = "all";

/**
 * /projects 헤더의 2단 스코프 필터 — 클라이언트 → 프로젝트.
 * - 클라이언트 Select: 전체 / 특정 클라이언트. 선택은 ?client=<id|all>로 URL에 반영.
 *   클라이언트가 바뀌면 프로젝트 집합이 달라지므로 project/task/month를 비워 서버가
 *   그 클라이언트의 첫 프로젝트로 재해석하게 한다.
 * - 프로젝트 Select: 현재 클라이언트 스코프의 활성 프로젝트만(서버가 이미 좁혀 전달).
 *   프로젝트가 1개뿐이면 헤더 제목과 중복이라 숨긴다.
 * 클라이언트 값은 페이지 전용(URL). 전역 클라이언트 스위처 쿠키는 이 필터가 없을 때의
 * 기본값으로만 쓰이고, 페이지에서 바꿔도 쿠키(전역 스코프)는 건드리지 않는다.
 */
export function ProjectScopeFilters({
  clients,
  selectedClient,
  projects,
  selectedProjectId,
}: {
  clients: { id: string; name: string }[];
  /** 표시 값: 특정 clientId 또는 ALL_CLIENTS. */
  selectedClient: string;
  projects: ProjectListItem[];
  selectedProjectId: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const selectClient = (value: string) => {
    if (!value || value === selectedClient) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("client", value);
    params.delete("project");
    params.delete("task");
    params.delete("month");
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const selectProject = (id: string) => {
    if (!id || id === selectedProjectId) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("project", id);
    params.delete("task");
    params.delete("month");
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  // base-ui Select는 items(value→label)로 트리거의 선택 라벨을 표시한다(필수).
  const clientItems: Record<string, string> = {
    [ALL_CLIENTS]: "전체 클라이언트",
    ...Object.fromEntries(clients.map((c) => [c.id, c.name])),
  };
  const projectItems = Object.fromEntries(projects.map((p) => [p.id, p.name]));

  return (
    <div className="flex flex-wrap items-center gap-2">
      {clients.length > 0 && (
        <Select
          items={clientItems}
          value={selectedClient}
          onValueChange={(v) => v && selectClient(v)}
        >
          <SelectTrigger
            aria-label="클라이언트 필터"
            className="h-10 min-h-10 w-full max-w-[15rem] border-[var(--que-border)] sm:w-52"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_CLIENTS}>
              <span className="truncate">전체 클라이언트</span>
            </SelectItem>
            {clients.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                <span className="truncate">{c.name}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      {projects.length > 1 && selectedProjectId && (
        <Select
          items={projectItems}
          value={selectedProjectId}
          onValueChange={(v) => v && selectProject(v)}
        >
          <SelectTrigger
            aria-label="프로젝트 선택"
            className="h-10 min-h-10 w-full max-w-xs border-[var(--que-border)] sm:w-64"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {projects.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                <span className="flex min-w-0 flex-col">
                  <span className="truncate">{p.name}</span>
                  {p.clientName ? (
                    <span className="truncate text-xs text-[var(--que-text-tertiary)]">
                      {p.clientName}
                    </span>
                  ) : null}
                </span>
                <span className="ml-auto text-xs text-[var(--que-text-tertiary)]">
                  {p.taskCount}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
