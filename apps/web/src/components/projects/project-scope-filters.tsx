"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import type { ProjectListItem } from "@/lib/projects-data";
import { ALL_CLIENTS, ALL_PROJECTS } from "@/lib/projects-scope";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** 클라이언트명이 없는(미소속) 프로젝트를 묶는 그룹 키. */
const NO_CLIENT_KEY = "__none__";

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
  isAllProjects = false,
}: {
  clients: { id: string; name: string }[];
  /** 표시 값: 특정 clientId 또는 ALL_CLIENTS. */
  selectedClient: string;
  projects: ProjectListItem[];
  selectedProjectId: string | null;
  /** 전체 프로젝트 보기 여부(?project=all). true면 프로젝트 Select 값이 ALL_PROJECTS. */
  isAllProjects?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // 스코프 전환은 서버 재렌더(force-dynamic)라 한 박자 걸린다 — 전환 중임을 스피너로
  // 즉시 알려 "눌렀는데 반응이 없다"는 체감 지연을 줄인다(2026-07-20 로딩 피드백).
  const [isPending, startTransition] = useTransition();

  const selectClient = (value: string) => {
    if (!value || value === selectedClient) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("client", value);
    params.delete("project");
    params.delete("task");
    params.delete("month");
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    });
  };

  // 현재 프로젝트 Select 값: 전체 보기면 sentinel, 아니면 선택 프로젝트 id.
  const projectValue = isAllProjects ? ALL_PROJECTS : selectedProjectId;

  const selectProject = (id: string) => {
    if (!id || id === projectValue) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("project", id);
    params.delete("task");
    params.delete("month");
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    });
  };

  // base-ui Select는 items(value→label)로 트리거의 선택 라벨을 표시한다(필수).
  const clientItems: Record<string, string> = {
    [ALL_CLIENTS]: "전체 클라이언트",
    ...Object.fromEntries(clients.map((c) => [c.id, c.name])),
  };
  const projectItems: Record<string, string> = {
    [ALL_PROJECTS]: "전체 프로젝트",
    ...Object.fromEntries(projects.map((p) => [p.id, p.name])),
  };

  // "전체 클라이언트" 스코프에선 프로젝트를 클라이언트별 그룹으로 묶는다(정렬은 서버 유지).
  const grouped = selectedClient === ALL_CLIENTS;
  const groupOrder: string[] = [];
  const groupMap = new Map<string, ProjectListItem[]>();
  for (const p of projects) {
    const key = p.clientName ?? NO_CLIENT_KEY;
    if (!groupMap.has(key)) {
      groupMap.set(key, []);
      groupOrder.push(key);
    }
    groupMap.get(key)!.push(p);
  }

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
      {projects.length > 0 && projectValue && (
        <Select
          items={projectItems}
          value={projectValue}
          onValueChange={(v) => v && selectProject(v)}
        >
          <SelectTrigger
            aria-label="프로젝트 선택"
            className="h-10 min-h-10 w-full max-w-xs border-[var(--que-border)] sm:w-64"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_PROJECTS}>
              <span className="truncate">전체 프로젝트</span>
              <span className="ml-auto text-xs text-[var(--que-text-tertiary)]">
                {projects.length}
              </span>
            </SelectItem>
            {grouped
              ? groupOrder.map((key) => (
                  <SelectGroup key={key}>
                    <SelectLabel>
                      {key === NO_CLIENT_KEY ? "미소속" : key}
                    </SelectLabel>
                    {groupMap.get(key)!.map((p) => (
                      <ProjectOption key={p.id} project={p} />
                    ))}
                  </SelectGroup>
                ))
              : projects.map((p) => <ProjectOption key={p.id} project={p} />)}
          </SelectContent>
        </Select>
      )}
      {isPending && (
        <span
          className="inline-flex items-center gap-1.5 text-xs text-[var(--que-text-tertiary)]"
          role="status"
          aria-live="polite"
        >
          <Loader2 className="size-3.5 animate-spin" aria-hidden />
          불러오는 중
        </span>
      )}
    </div>
  );
}

/** 프로젝트 Select 항목 — 이름 + 보드 노출 태스크 수. 클라이언트명은 그룹 헤더가 대신한다. */
function ProjectOption({ project }: { project: ProjectListItem }) {
  return (
    <SelectItem value={project.id}>
      <span className="truncate">{project.name}</span>
      <span className="ml-auto text-xs text-[var(--que-text-tertiary)]">
        {project.taskCount}
      </span>
    </SelectItem>
  );
}
