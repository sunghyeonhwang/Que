"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { toast } from "sonner";
import { ChevronDown, FileText, TriangleAlert, ZoomIn, ZoomOut } from "lucide-react";
import type { GanttAdjustment, ProjectGantt } from "@/lib/projects-data";
import { createMeetingMinutesAction } from "@/app/(app)/meeting-notes/actions";
import { GanttView } from "@/components/projects/gantt-view";
import { FullscreenButton } from "@/components/app/fullscreen-button";
import { reportError } from "@/lib/report-error";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

// 회의용 통합 간트 보드 — 상단 컨트롤(클라이언트 필터·위험만 보기·줌·전체화면) + 간트 + 하단 조정 요약.
// - 클라이언트 필터는 서버 재조회가 필요해 URL(?client)로 구동한다.
// - 위험만 보기·줌은 이미 받은 데이터를 필터/렌더 조정만 하므로 클라 상태 + URL(history.replaceState)로
//   반영한다(공유 가능한 URL, 서버 재요청 없음).
// - 데이터·권한(canManage)·상태색은 모두 core를 거친 GanttView 그대로 재사용한다(하드코딩 없음).

type Zoom = "month" | "quarter";
const COL_W_MONTH = 46; // 4주 상세
const COL_W_QUARTER = 22; // 분기 조망

/** 위험만 보기 — 주의/지연 마일스톤 + 위험 작업(주의·기한초과·문제·홀드·재조정)만 남긴다. */
function filterRisk(g: ProjectGantt): ProjectGantt {
  const risky = (status: string, atRisk: boolean, overdue: boolean) =>
    atRisk ||
    overdue ||
    status === "issue" ||
    status === "on_hold" ||
    status === "needs_reschedule";
  return {
    ...g,
    tasks: g.tasks.filter((t) => risky(t.status, t.atRisk, t.isOverdue)),
    milestones: g.milestones.filter((m) => m.riskStatus !== "on_track"),
    unscheduled: [],
  };
}

export function GanttBoard({
  gantt,
  clientOptions,
  selectedClient,
  adjustments,
  initialRisk,
  initialZoom,
}: {
  gantt: ProjectGantt;
  clientOptions: { id: string; name: string }[];
  selectedClient: string; // clientId | "all"
  adjustments: GanttAdjustment[];
  initialRisk: boolean;
  initialZoom: Zoom;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [risk, setRisk] = useState(initialRisk);
  const [zoom, setZoom] = useState<Zoom>(initialZoom);

  const colWidth = zoom === "quarter" ? COL_W_QUARTER : COL_W_MONTH;
  const data = useMemo(() => (risk ? filterRisk(gantt) : gantt), [risk, gantt]);

  // 위험·줌은 서버 재요청 없이 URL만 갱신(공유 가능). 클라이언트 필터는 서버 재조회라 router.push.
  const syncUrl = (next: { risk?: boolean; zoom?: Zoom }) => {
    const sp = new URLSearchParams(searchParams.toString());
    const r = next.risk ?? risk;
    const z = next.zoom ?? zoom;
    if (r) sp.set("risk", "1");
    else sp.delete("risk");
    if (z === "quarter") sp.set("zoom", "quarter");
    else sp.delete("zoom");
    const qs = sp.toString();
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
  };

  const toggleRisk = () => {
    setRisk((v) => {
      syncUrl({ risk: !v });
      return !v;
    });
  };
  const toggleZoom = () => {
    setZoom((z) => {
      const next: Zoom = z === "quarter" ? "month" : "quarter";
      syncUrl({ zoom: next });
      return next;
    });
  };

  const onClientChange = (value: string) => {
    const sp = new URLSearchParams(searchParams.toString());
    if (value && value !== "all") sp.set("client", value);
    else sp.delete("client");
    router.push(sp.toString() ? `?${sp.toString()}` : window.location.pathname);
  };

  const clientItems: Record<string, string> = {
    all: "전체 클라이언트",
    ...Object.fromEntries(clientOptions.map((c) => [c.id, c.name])),
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* 상단 컨트롤 바 */}
      <header className="flex shrink-0 flex-wrap items-center gap-2 border-b border-[var(--que-border)] bg-[var(--que-bg)] px-4 py-3 sm:gap-3 sm:px-6">
        <h1 className="mr-1 text-base font-semibold text-[var(--que-text)]">통합 간트</h1>

        {clientOptions.length > 0 && (
          <Select
            items={clientItems}
            value={selectedClient}
            onValueChange={(v) => v && onClientChange(v)}
          >
            <SelectTrigger aria-label="클라이언트 필터" size="lg" className="min-w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(clientItems).map(([id, name]) => (
                <SelectItem key={id} value={id}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Button
          type="button"
          variant={risk ? "default" : "outline"}
          onClick={toggleRisk}
          aria-pressed={risk}
          className="h-10 gap-1.5"
        >
          <TriangleAlert className="size-4" aria-hidden />
          위험만 보기
        </Button>

        <div className="ml-auto flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  type="button"
                  variant="outline"
                  onClick={toggleZoom}
                  aria-label={zoom === "quarter" ? "4주 상세 보기" : "분기 조망 보기"}
                  className="size-10"
                />
              }
            >
              {zoom === "quarter" ? (
                <ZoomIn className="size-4" aria-hidden />
              ) : (
                <ZoomOut className="size-4" aria-hidden />
              )}
            </TooltipTrigger>
            <TooltipContent>
              {zoom === "quarter" ? "4주 상세" : "분기 조망"}
            </TooltipContent>
          </Tooltip>
          <FullscreenButton variant="outline" />
        </div>
      </header>

      {/* 간트 — 내부 스크롤 유지(GanttView가 자체 sticky 헤더 + 가로/세로 스크롤) */}
      <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
        <GanttView
          data={data}
          colWidth={colWidth}
          showProject
          taskHref={(taskId) => `/projects?project=all&task=${taskId}`}
        />
      </div>

      <TodayAdjustmentsBar adjustments={adjustments} />
    </div>
  );
}

const CHANGE_VERB: Record<GanttAdjustment["changeType"], string> = {
  create: "생성",
  update: "변경",
  move: "이동",
  status_change: "상태 변경",
  delete: "삭제",
};

/** 하단 고정 바 — 오늘 조정된 마일스톤 요약. 펼치면 목록. "회의록 초안으로"는 마일스톤 회의록 초안 저장. */
function TodayAdjustmentsBar({ adjustments }: { adjustments: GanttAdjustment[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const count = adjustments.length;

  // 오늘 시스템 행동을 마일스톤 회의록(kind=milestone) 초안으로 저장(기획 §1-b·§1-f). admin 전용 페이지라 노출 무방.
  const saveMinutes = () => {
    startTransition(async () => {
      try {
        const result = await createMeetingMinutesAction("milestone");
        if (result.ok) {
          toast.success("마일스톤 회의록 초안이 저장됐습니다.", {
            action: { label: "회의록 열기", onClick: () => router.push("/meeting-notes") },
          });
          router.refresh();
        } else {
          toast.error(result.error);
        }
      } catch (error) {
        reportError(error, { source: "server-action" });
        toast.error("회의록 저장 중 오류가 발생했습니다.");
      }
    });
  };

  return (
    <div className="shrink-0 border-t border-[var(--que-border)] bg-[var(--que-bg)]">
      {open && count > 0 && (
        <ul className="max-h-48 overflow-y-auto border-b border-[var(--que-border)] px-4 py-2 sm:px-6">
          {adjustments.map((a) => (
            <li
              key={a.id}
              className="flex items-center gap-2 border-b border-[var(--que-bg-muted)] py-2 text-sm last:border-b-0"
            >
              <span
                aria-hidden
                className="inline-block size-2 shrink-0 rounded-full"
                style={{ background: "var(--que-brand)" }}
              />
              <span className="min-w-0 flex-1 truncate text-[var(--que-text)]">
                {a.milestoneTitle}
                {a.projectName && (
                  <span className="text-[var(--que-text-tertiary)]"> · {a.projectName}</span>
                )}
              </span>
              <span className="shrink-0 text-xs text-[var(--que-text-tertiary)]">
                {a.actorName} · {CHANGE_VERB[a.changeType] ?? a.changeType} ·{" "}
                {format(new Date(a.createdAt), "HH:mm", { locale: ko })}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 sm:px-6">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          disabled={count === 0}
          aria-expanded={open}
          className={cn(
            "flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors",
            count > 0
              ? "text-[var(--que-text)] hover:bg-[var(--que-bg-muted)]"
              : "cursor-default text-[var(--que-text-tertiary)]",
          )}
        >
          {count > 0 && (
            <ChevronDown
              className={cn("size-4 transition-transform", open && "rotate-180")}
              aria-hidden
            />
          )}
          오늘 조정 {count}건
        </button>

        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={saveMinutes}
          className="ml-auto h-10 gap-1.5"
        >
          <FileText className="size-4" aria-hidden />
          {pending ? "저장 중…" : "회의록 초안으로"}
        </Button>
      </div>
    </div>
  );
}
