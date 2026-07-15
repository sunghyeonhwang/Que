"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useAnimate } from "motion/react";
import { TriangleAlert, Check, ChevronLeft, ChevronRight, LocateFixed } from "lucide-react";
import type { GanttMilestone, GanttTask, ProjectGantt } from "@/lib/projects-data";
import { updateMilestoneAction } from "@/app/(app)/planning/actions";
import { useOptimisticAction } from "@/components/app/use-optimistic-action";
import { TONE_STYLE, type StatusTone } from "@/lib/pm-columns";
import type { TaskStatus } from "@que/core";
import { MilestoneChip } from "@/components/milestones/milestone-chip";
import { cn } from "@/lib/utils";

// 간트 뷰 — E-9b·E-9d. "일정이 밀리는 게 눈에 보이는 그림"(PM 용어 없이).
// - 좌측 작업·담당자 열은 sticky(가로 스크롤 시 고정), 날짜 헤더는 sticky top — 내부 스크롤만
//   쓰고 페이지 전체를 깨지 않는다(화면 원칙). 라이브러리 없이 CSS 막대 + SVG 화살표 오버레이.
// - 상태색은 기존 의미 고정 팔레트(TONE_STYLE) 재사용: 예정=blue, 진행=green, 홀드·문제=amber/red,
//   완료=중립+취소선(남은 일이 도드라지게). 새 색 없음.
// - 선행 화살표: 평상시 중립 회색 실선, **일정 주의(atRisk)일 때만 amber 점선 + ⚠ 아이콘 + 사유
//   툴팁** — 색·모양·아이콘 3중 표현(색상 단독 금지).
// - 오늘 = 브랜드색 점선 세로선 + '오늘' 칩(red는 문제 의미라 쓰지 않는다).
// - 마일스톤은 최상단 전용 레인의 다이아(위험 상태색 반영).
// - 시간은 무시하고 일 단위 스냅. 일정 없는 작업은 하단 칩(잊히지 않게 날짜 지정 유도).

const DEFAULT_COL_W = 46; // 일 컬럼 폭 기본(px) — 4주 상세. 줌(분기 조망)은 colWidth prop으로 좁힌다.
const DRAG_THRESHOLD = 5; // 클릭(Popover 수정)과 드래그(기한 이동)를 가르는 px 임계값
const ROW_H = 48; // 행 높이(px) — 터치 40px+ 여유
const HEADER_H = 52;
const NAME_W = 232; // 좌측 고정 열 폭
const BAR_H = 28;
const BAR_TOP = (ROW_H - BAR_H) / 2;

/** 상태 → 톤. 보드 4열 매핑(pm-columns)과 같은 의미, done만 중립(뒤로 물러남). */
function toneOf(status: TaskStatus): StatusTone {
  if (status === "done") return "neutral";
  if (status === "in_progress") return "green";
  if (status === "on_hold" || status === "needs_reschedule") return "amber";
  if (status === "issue") return "red";
  return "blue"; // scheduled
}

/** 'yyyy-MM-dd' 두 dateKey 사이 일수(달력 기준). */
function dayDiff(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

function buildDays(rangeStart: string, rangeEnd: string): { key: string; dow: number; label: string }[] {
  const out: { key: string; dow: number; label: string }[] = [];
  const count = dayDiff(rangeStart, rangeEnd) + 1;
  const start = new Date(`${rangeStart}T00:00:00`);
  for (let i = 0; i < count; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    const mm = d.getMonth() + 1;
    const dd = d.getDate();
    out.push({
      key: `${d.getFullYear()}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`,
      dow: d.getDay(),
      label: `${mm}/${dd}`,
    });
  }
  return out;
}

const DOW_LABEL = ["일", "월", "화", "수", "목", "금", "토"];

/** 본문 행 — 그룹 헤더(클라이언트·프로젝트) 또는 작업. taskIndex는 visibleTasks 내 원 index. */
type LayoutRow =
  | { kind: "group"; key: string; label: string }
  | { kind: "task"; task: GanttTask; taskIndex: number };

export function GanttView({
  data,
  taskHref,
  showProject,
  colWidth = DEFAULT_COL_W,
  hideDone: hideDoneProp,
}: {
  data: ProjectGantt;
  taskHref: (taskId: string) => string;
  showProject: boolean;
  /** 일 컬럼 폭(px). 줌 전환용 — 46=4주 상세, 22=분기 조망. 기본 46. */
  colWidth?: number;
  /** 미완료만 보기(제어형). 상위(프로젝트 화면 공통 토글)가 주면 그 값을 쓰고 내부 버튼은 숨긴다.
   *  미지정이면 기존처럼 내부 토글(회의용 통합 간트 경로). */
  hideDone?: boolean;
}) {
  const COL_W = colWidth;
  const days = useMemo(() => buildDays(data.rangeStart, data.rangeEnd), [data.rangeStart, data.rangeEnd]);
  const idx = (day: string) => Math.min(Math.max(dayDiff(data.rangeStart, day), 0), days.length - 1);
  const todayIdx = days.findIndex((d) => d.key === data.today);
  const hasMilestoneLane = data.milestones.length > 0;

  // 미완료만 보기 — 완료(done) 작업 행을 숨긴다(2026-07-14 사용자 요청). 받은 데이터를 클라에서
  // 거르기만 하므로 즉시 반응. 선행 화살표는 rowIndexByTask 미스 가드가 있어 필터에 안전하다.
  const [hideDoneLocal, setHideDoneLocal] = useState(false);
  const hideDone = hideDoneProp ?? hideDoneLocal;
  const visibleTasks = useMemo(
    () => (hideDone ? data.tasks.filter((t) => t.status !== "done") : data.tasks),
    [hideDone, data.tasks],
  );
  // 마일스톤 드래그 낙관 반영 — id → 덮어쓴 day(yyyy-MM-dd). 서버 확정 전까지 새 위치를 유지한다.
  const [dayOverride, setDayOverride] = useState<Record<string, string>>({});
  const { run: runMilestone } = useOptimisticAction();
  const milestoneDay = (m: GanttMilestone) => dayOverride[m.id] ?? m.day;

  // 드롭 → 기한 이동: 원래 시각(H:M:S)은 보존하고 날짜만 바꿔 updateMilestoneAction 낙관 호출.
  const commitMilestoneMove = (m: GanttMilestone, targetIdx: number) => {
    const key = days[Math.min(Math.max(targetIdx, 0), days.length - 1)]?.key;
    if (!key || key === milestoneDay(m)) return;
    const [y, mo, d] = key.split("-").map(Number);
    const next = new Date(m.dueAt);
    next.setFullYear(y, mo - 1, d);
    const prev = dayOverride[m.id];
    // asDecision: 드래그 기한 조정을 결정(연기)으로 기록 — 긴급 결정 카드가 당일 종결을 인식한다.
    runMilestone(() => updateMilestoneAction({ milestoneId: m.id, dueAt: next.toISOString(), asDecision: true }), {
      apply: () => setDayOverride((o) => ({ ...o, [m.id]: key })),
      rollback: () =>
        setDayOverride((o) => {
          const copy = { ...o };
          if (prev === undefined) delete copy[m.id];
          else copy[m.id] = prev;
          return copy;
        }),
      success: "마일스톤 기한을 옮겼습니다.",
      // [실행 취소] — 서버가 mutation 직전에 뜬 previousDueAt으로 복원한다. m.dueAt(prop)은 이 화면의
      // revalidate 경로(/planning만) 밖이라 연속 드래그 후 stale — 클라이언트 스냅샷은 신뢰 불가(게이트 High).
      // 되돌리기에는 undo를 다시 붙이지 않는다(무한 체인 방지).
      undo: (result) => {
        const prevDueAt = result.previousDueAt;
        if (!prevDueAt) return undefined;
        const pd = new Date(prevDueAt);
        const prevDayKey = `${pd.getFullYear()}-${String(pd.getMonth() + 1).padStart(2, "0")}-${String(pd.getDate()).padStart(2, "0")}`;
        return {
          onClick: () =>
            runMilestone(() => updateMilestoneAction({ milestoneId: m.id, dueAt: prevDueAt, asDecision: true }), {
              apply: () => setDayOverride((o) => ({ ...o, [m.id]: prevDayKey })),
              rollback: () => setDayOverride((o) => ({ ...o, [m.id]: key })),
              success: "기한을 되돌렸습니다.",
              source: "gantt-milestone-undo",
            }),
        };
      },
      source: "gantt-milestone-drag",
    });
  };
  // 전체 보기(showProject)면 클라이언트→프로젝트 그룹 헤더 행을 작업 행 사이에 끼운다.
  // layout = 본문 행(마일스톤 레인 제외)의 순서. 각 항목은 그룹 헤더 또는 작업.
  // 데이터가 이미 클라이언트→프로젝트 순으로 정렬돼 오므로 같은 프로젝트가 연속 → 헤더 1회.
  const layout = useMemo<LayoutRow[]>(() => {
    if (!showProject) {
      return visibleTasks.map((t, i) => ({ kind: "task", task: t, taskIndex: i }));
    }
    const rows: LayoutRow[] = [];
    let prevKey: string | null = null;
    visibleTasks.forEach((t, i) => {
      const key = t.projectId ?? "__none__";
      if (key !== prevKey) {
        rows.push({
          kind: "group",
          key,
          label: t.clientName
            ? `${t.clientName} · ${t.projectName ?? ""}`
            : (t.projectName ?? "미소속 작업"),
        });
        prevKey = key;
      }
      rows.push({ kind: "task", task: t, taskIndex: i });
    });
    return rows;
  }, [showProject, visibleTasks]);

  // 작업 index → 본문 시각 행 번호(마일스톤 레인 아래, 헤더 행 포함). 오버레이 좌표 계산에 쓴다.
  const taskVisualRow = useMemo(() => {
    const m = new Map<number, number>();
    layout.forEach((r, vi) => {
      if (r.kind === "task") m.set(r.taskIndex, vi);
    });
    return m;
  }, [layout]);

  // 행 y 오프셋: (마일스톤 레인) + 본문 시각 행(vi). vi는 layout 인덱스(헤더 행 포함).
  const laneOffset = hasMilestoneLane ? ROW_H : 0;
  const rowY = (vi: number) => laneOffset + vi * ROW_H;
  const bodyH = laneOffset + layout.length * ROW_H;
  const gridW = days.length * COL_W;
  const rowIndexByTask = useMemo(
    () => new Map(visibleTasks.map((t, i) => [t.taskId, i])),
    [visibleTasks],
  );

  // 첫 렌더에 오늘이 보이도록 스크롤(오늘 x가 뷰포트 앞 1/3쯤 오게) — DayBlocks scroll-to-now 관례.
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || todayIdx < 0) return;
    el.scrollLeft = Math.max(0, NAME_W + todayIdx * COL_W - (el.clientWidth - NAME_W) / 3 - NAME_W);
    // COL_W(줌) 변경 시에도 오늘이 다시 뷰포트 앞쪽에 오도록 재정렬.
  }, [todayIdx, COL_W]);

  if (data.tasks.length === 0 && data.milestones.length === 0 && data.unscheduled.length === 0) {
    return <GanttEmptyPrimer />;
  }

  return (
    <div className="flex flex-col gap-3">
      {/* 범례 — 처음 보는 팀원용 읽기 안내(교육) */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-xs text-[var(--que-text-secondary)]">
        <span className="font-medium text-[var(--que-text)]">막대 = 작업 기간(시작~마감)</span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block size-2 rounded-full" style={{ background: "var(--que-brand)" }} />예정
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block size-2 rounded-full" style={{ background: "var(--que-success)" }} />진행중
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block size-2 rounded-full" style={{ background: "var(--que-warning)" }} />홀드·주의
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden
            className="inline-block h-3 w-4 rounded-[3px] bg-[linear-gradient(144deg,rgba(0,242,255,1)_0%,rgba(255,247,0,1)_100%)]"
          />
          마일스톤
        </span>
        <span style={{ color: "var(--que-brand)" }}>┆ 오늘</span>
        <span>→ 선행 작업(앞의 일이 끝나야 시작)</span>
        <span className="inline-flex items-center gap-1" style={{ color: "var(--que-warning)" }}>
          <TriangleAlert className="size-3.5" aria-hidden />
          일정 주의
        </span>
        {/* 미완료만 보기 — 완료 행을 숨겨 남은 일에 집중(즉시 반응, 클라 필터).
            상위 공통 토글(hideDone prop)이 있으면 중복이라 렌더하지 않는다. */}
        {hideDoneProp === undefined && (
        <button
          type="button"
          onClick={() => setHideDoneLocal((v) => !v)}
          aria-pressed={hideDone}
          className={
            "ml-auto inline-flex min-h-10 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition-colors " +
            (hideDone
              ? "border-[var(--que-brand)] bg-[var(--que-brand-subtle)] text-[var(--que-brand)]"
              : "border-[var(--que-border)] text-[var(--que-text-secondary)] hover:bg-[var(--que-bg-muted)]")
          }
        >
          <Check className={"size-3.5 " + (hideDone ? "" : "opacity-30")} aria-hidden />
          미완료만 보기
        </button>
        )}

        {/* 차트 좌우 이동(2026-07-11 요청) — 한 번에 7일치, '오늘'로 즉시 복귀 버튼 포함. */}
        <span className="ml-auto inline-flex items-center gap-1">
          <button
            type="button"
            aria-label="이전 7일 보기"
            onClick={() => scrollRef.current?.scrollBy({ left: -COL_W * 7, behavior: "smooth" })}
            className="flex size-10 items-center justify-center rounded-lg border border-[var(--que-border)] bg-[var(--que-bg)] text-[var(--que-text-secondary)] transition-colors hover:bg-[var(--que-bg-muted)] hover:text-[var(--que-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--que-brand)]"
          >
            <ChevronLeft className="size-4" aria-hidden />
          </button>
          <button
            type="button"
            aria-label="오늘 위치로 이동"
            onClick={() => {
              const el = scrollRef.current;
              if (!el || todayIdx < 0) return;
              el.scrollTo({
                left: Math.max(0, NAME_W + todayIdx * COL_W - (el.clientWidth - NAME_W) / 3 - NAME_W),
                behavior: "smooth",
              });
            }}
            className="flex h-10 items-center gap-1.5 rounded-lg border border-[var(--que-border)] bg-[var(--que-bg)] px-3 text-xs font-medium text-[var(--que-text-secondary)] transition-colors hover:bg-[var(--que-bg-muted)] hover:text-[var(--que-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--que-brand)]"
          >
            <LocateFixed className="size-3.5" aria-hidden />
            오늘
          </button>
          <button
            type="button"
            aria-label="다음 7일 보기"
            onClick={() => scrollRef.current?.scrollBy({ left: COL_W * 7, behavior: "smooth" })}
            className="flex size-10 items-center justify-center rounded-lg border border-[var(--que-border)] bg-[var(--que-bg)] text-[var(--que-text-secondary)] transition-colors hover:bg-[var(--que-bg-muted)] hover:text-[var(--que-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--que-brand)]"
          >
            <ChevronRight className="size-4" aria-hidden />
          </button>
        </span>
      </div>

      {/* 그리드 — 내부 스크롤 + sticky(이름 열·날짜 헤더) */}
      <div ref={scrollRef} className="overflow-auto rounded-xl border border-[var(--que-border)] bg-[var(--que-bg)]" style={{ maxHeight: "70vh" }}>
        <div className="relative flex w-max min-w-full">
          {/* 좌측 고정 열 */}
          <div className="sticky left-0 z-20 shrink-0 border-r border-[var(--que-border)] bg-[var(--que-bg)]" style={{ width: NAME_W }}>
            <div
              className="sticky top-0 z-10 flex items-end border-b border-[var(--que-border)] bg-[var(--que-bg)] px-3.5 pb-2 text-xs text-[var(--que-text-tertiary)]"
              style={{ height: HEADER_H }}
            >
              작업 · 담당자
            </div>
            {hasMilestoneLane && (
              <div className="flex items-center border-b border-[var(--que-bg-muted)] px-3.5" style={{ height: ROW_H }}>
                <span className="text-xs font-medium text-[var(--que-text-tertiary)]">◆ 마일스톤</span>
              </div>
            )}
            {layout.map((r, vi) =>
              r.kind === "group" ? (
                // 그룹 헤더 행 — 낮은 톤 muted 배경 + 작은 "클라이언트 · 프로젝트명" 라벨.
                <div
                  key={`g-${r.key}-${vi}`}
                  className="flex items-center border-b border-[var(--que-border)] bg-[var(--que-bg-muted)] px-3.5"
                  style={{ height: ROW_H }}
                >
                  <span className="truncate text-[11px] font-semibold text-[var(--que-text-secondary)]">
                    {r.label}
                  </span>
                </div>
              ) : (
                <Link
                  key={r.task.taskId}
                  href={taskHref(r.task.taskId)}
                  scroll={false}
                  className="flex items-center gap-2 border-b border-[var(--que-bg-muted)] px-3.5 hover:bg-[var(--que-bg-muted)] focus-visible:outline-2 focus-visible:outline-[var(--que-brand)]"
                  style={{ height: ROW_H }}
                >
                  {r.task.assignee ? (
                    <span
                      aria-hidden
                      className="flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white"
                      style={{ background: r.task.assignee.avatarColor }}
                    >
                      {r.task.assignee.name.slice(0, 1)}
                    </span>
                  ) : (
                    <span className="size-6 shrink-0 rounded-full bg-[var(--que-bg-muted)]" aria-hidden />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className={cn("block truncate text-[13px] font-medium text-[var(--que-text)]", r.task.status === "done" && "text-[var(--que-text-tertiary)] line-through")}>
                      {r.task.title}
                    </span>
                    {/* 전체 보기에선 그룹 헤더가 프로젝트를 알려주므로 행 내 프로젝트 부제는 생략(중복 방지). */}
                  </span>
                  <span className="shrink-0 text-[11px] text-[var(--que-text-tertiary)]">
                    {r.task.assignee?.name ?? ""}
                  </span>
                </Link>
              ),
            )}
          </div>

          {/* 타임라인 */}
          <div className="relative shrink-0" style={{ width: gridW }}>
            {/* 날짜 헤더 */}
            <div className="sticky top-0 z-10 flex border-b border-[var(--que-border)] bg-[var(--que-bg)]" style={{ height: HEADER_H }}>
              {days.map((d) => (
                <div
                  key={d.key}
                  className={cn(
                    "flex shrink-0 flex-col items-center justify-end pb-1.5 text-[11px] tabular-nums",
                    d.key === data.today
                      ? "font-bold text-[var(--que-brand)]"
                      : "text-[var(--que-text-secondary)]",
                    (d.dow === 0 || d.dow === 6) && d.key !== data.today && "text-[var(--que-text-tertiary)]",
                  )}
                  style={{ width: COL_W }}
                >
                  <span className="text-[10px]">{DOW_LABEL[d.dow]}</span>
                  {d.label}
                </div>
              ))}
            </div>

            {/* 본문 */}
            <div className="relative" style={{ height: bodyH, width: gridW }}>
              {/* 주말 음영 + 세로 눈금 */}
              {days.map((d, i) =>
                d.dow === 0 || d.dow === 6 ? (
                  <div
                    key={d.key}
                    aria-hidden
                    className="absolute top-0 bottom-0 bg-[var(--que-bg-muted)] opacity-50"
                    style={{ left: i * COL_W, width: COL_W }}
                  />
                ) : null,
              )}
              <div
                aria-hidden
                className="absolute inset-0"
                style={{
                  backgroundImage: `repeating-linear-gradient(to right, transparent, transparent ${COL_W - 1}px, var(--que-bg-muted) ${COL_W - 1}px, var(--que-bg-muted) ${COL_W}px)`,
                }}
              />
              {/* 행 구분선 */}
              {Array.from({ length: layout.length + (hasMilestoneLane ? 1 : 0) }, (_, r) => (
                <div
                  key={r}
                  aria-hidden
                  className="absolute right-0 left-0 border-b border-[var(--que-bg-muted)]"
                  style={{ top: (r + 1) * ROW_H - 1 }}
                />
              ))}

              {/* 그룹 헤더 행 배경 — 좌측 라벨 행과 맞춘 낮은 톤 빈 밴드(타임라인 쪽은 빈 행). */}
              {layout.map((r, vi) =>
                r.kind === "group" ? (
                  <div
                    key={`gb-${r.key}-${vi}`}
                    aria-hidden
                    className="absolute right-0 left-0 bg-[var(--que-bg-muted)] opacity-60"
                    style={{ top: rowY(vi), height: ROW_H }}
                  />
                ) : null,
              )}

              {/* 마일스톤 레인 — /schedule과 동일한 그라데이션 칩(클릭 → 상세/수정, 권한 있을 때).
                  기한 날짜 컬럼 위치에 칩 왼쪽 끝(다이아 마커)을 맞춘다. */}
              {hasMilestoneLane &&
                data.milestones.map((m) => (
                  <DraggableMilestone
                    key={m.id}
                    milestone={m}
                    baseIdx={idx(milestoneDay(m))}
                    colWidth={COL_W}
                    top={ROW_H / 2 - 14}
                    daysLen={days.length}
                    onCommit={(targetIdx) => commitMilestoneMove(m, targetIdx)}
                  />
                ))}

              {/* 선행 화살표(SVG 오버레이) — 시각 보조라 aria-hidden, 의미는 막대 라벨·툴팁이 전달 */}
              <svg aria-hidden className="pointer-events-none absolute inset-0" width={gridW} height={bodyH}>
                <defs>
                  <marker id="gantt-ah" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
                    <path d="M0,0 L7,3.5 L0,7 z" fill="var(--que-text-tertiary)" />
                  </marker>
                  <marker id="gantt-ah-warn" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
                    <path d="M0,0 L7,3.5 L0,7 z" fill="var(--que-warning)" />
                  </marker>
                </defs>
                {visibleTasks.flatMap((t, row) =>
                  t.predecessorIds.map((pid) => {
                    const pRow = rowIndexByTask.get(pid);
                    if (pRow === undefined) return null; // 선행이 화면 밖(일정 없음 등)이면 생략
                    const p = visibleTasks[pRow];
                    const x1 = (idx(p.endDay) + 1) * COL_W - 4;
                    const y1 = rowY(taskVisualRow.get(pRow) ?? pRow) + ROW_H / 2;
                    const x2 = idx(t.startDay) * COL_W + 2;
                    const y2 = rowY(taskVisualRow.get(row) ?? row) + ROW_H / 2;
                    const bend = Math.max(x1 + 12, x2 - 14);
                    const warn = t.atRisk;
                    return (
                      <path
                        key={`${pid}-${t.taskId}`}
                        d={`M ${x1} ${y1} L ${bend} ${y1} L ${bend} ${y2} L ${x2} ${y2}`}
                        fill="none"
                        stroke={warn ? "var(--que-warning)" : "var(--que-text-tertiary)"}
                        strokeWidth={1.5}
                        strokeDasharray={warn ? "4 3" : undefined}
                        markerEnd={warn ? "url(#gantt-ah-warn)" : "url(#gantt-ah)"}
                      />
                    );
                  }),
                )}
              </svg>

              {/* 작업 막대 */}
              {visibleTasks.map((t, row) => {
                const vi = taskVisualRow.get(row) ?? row;
                const s = idx(t.startDay);
                const e = idx(t.endDay);
                const tone = TONE_STYLE[toneOf(t.status)];
                const period = t.startDay === t.endDay ? t.startDay : `${t.startDay} ~ ${t.endDay}`;
                const label = `${t.title} — ${period}${t.riskReason ? ` · 일정 주의: ${t.riskReason}` : ""}`;
                // 좁은 막대(3일 미만)는 제목이 안 들어가므로 막대 오른쪽 밖에 라벨을 뺀다.
                const narrow = e - s + 1 < 3;
                return (
                  <div key={t.taskId} className="absolute" style={{ top: rowY(vi), height: ROW_H, left: 0, right: 0 }}>
                    {t.atRisk && (
                      <span
                        title={t.riskReason ?? undefined}
                        className="absolute z-10 flex size-[18px] items-center justify-center rounded-full border bg-[var(--que-warning-bg)] text-[var(--que-warning)]"
                        style={{ left: Math.max(s * COL_W - 22, 2), top: ROW_H / 2 - 9, borderColor: "var(--que-warning)" }}
                      >
                        <TriangleAlert className="size-3" aria-hidden />
                      </span>
                    )}
                    <Link
                      href={taskHref(t.taskId)}
                      scroll={false}
                      aria-label={label}
                      title={t.riskReason ?? undefined}
                      className={cn(
                        "absolute flex items-center gap-1.5 truncate rounded-[7px] border px-2.5 text-xs font-medium",
                        "focus-visible:outline-2 focus-visible:outline-[var(--que-brand)]",
                        t.status === "done" && "line-through opacity-80",
                      )}
                      style={{
                        left: s * COL_W + 3,
                        width: Math.max((e - s + 1) * COL_W - 6, COL_W - 6),
                        top: BAR_TOP,
                        height: BAR_H,
                        background: tone.tint,
                        borderColor: tone.dot,
                        color: tone.text,
                      }}
                    >
                      <span aria-hidden className="size-[7px] shrink-0 rounded-full" style={{ background: tone.dot }} />
                      {!narrow && (
                        <span className="truncate">
                          {t.title}
                          {t.status === "done" && <Check className="ml-1 inline size-3" aria-hidden />}
                        </span>
                      )}
                    </Link>
                    {narrow && (
                      <span
                        aria-hidden
                        className={cn(
                          "pointer-events-none absolute truncate text-xs font-medium",
                          t.status === "done" ? "text-[var(--que-text-tertiary)] line-through" : "text-[var(--que-text-secondary)]",
                        )}
                        style={{ left: (e + 1) * COL_W + 8, top: BAR_TOP + 6, maxWidth: 180 }}
                      >
                        {t.title}
                      </span>
                    )}
                  </div>
                );
              })}

              {/* 오늘 라인 */}
              {todayIdx >= 0 && (
                <div
                  aria-hidden
                  className="absolute top-0 bottom-0 z-10 border-l-2 border-dashed"
                  style={{ left: todayIdx * COL_W + COL_W / 2, borderColor: "var(--que-brand)" }}
                >
                  <span className="absolute -top-0.5 -left-4 rounded-full bg-[var(--que-brand)] px-1.5 py-px text-[10px] text-white">
                    오늘
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 일정 없는 작업 — 간트에서 잊히지 않게 날짜 지정 유도 */}
      {data.unscheduled.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--que-border)] bg-[var(--que-bg)] px-4 py-2.5 text-sm">
          <span className="rounded-full bg-[var(--que-warning-bg)] px-2.5 py-0.5 text-xs font-semibold text-[var(--que-warning)]">
            일정 없는 작업 {data.unscheduled.length}
          </span>
          <span className="text-[var(--que-text-secondary)]">간트에 표시하려면 상세에서 날짜를 지정하세요 →</span>
          {data.unscheduled.map((u) => (
            <Link
              key={u.taskId}
              href={taskHref(u.taskId)}
              scroll={false}
              className="rounded-lg border border-[var(--que-border)] px-2.5 py-1 text-xs text-[var(--que-text)] hover:bg-[var(--que-bg-muted)]"
            >
              {u.title}
              {showProject && u.projectName && (
                <span className="text-[var(--que-text-tertiary)]"> · {u.projectName}</span>
              )}
              {u.assigneeName && <span className="text-[var(--que-text-tertiary)]"> · {u.assigneeName}</span>}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * 마일스톤 레인 칩 + 가로 드래그(기한 이동). 관리 권한(canManage)이 있을 때만 드래그.
 * - 클릭(수정 Popover)과 공존: 이동 거리가 DRAG_THRESHOLD 미만이면 드래그로 보지 않아
 *   MilestoneChip의 클릭(Popover)이 그대로 열린다. 임계값을 넘으면 pointer capture로
 *   칩 클릭을 가로채(Popover 안 열림) 컬럼 스냅 미리보기를 그리고, 드롭 때 onCommit.
 * - canManage=false면 드래그 비활성(커서 기본 · 이동 핸들러 없음) — 조회 전용 칩으로만 동작.
 */
function DraggableMilestone({
  milestone: m,
  baseIdx,
  colWidth,
  top,
  daysLen,
  onCommit,
}: {
  milestone: GanttMilestone;
  baseIdx: number;
  colWidth: number;
  top: number;
  daysLen: number;
  onCommit: (targetIdx: number) => void;
}) {
  const [drag, setDrag] = useState<{ startX: number; dx: number; active: boolean } | null>(null);
  const canDrag = m.canManage;
  // 드롭 세틀 모션 전용 — 위치 계산/스냅/onCommit과 독립. transform(scale)만 스프링으로 잠깐 튕긴다.
  const [scope, animate] = useAnimate();

  // 스냅된 미리보기 오프셋(컬럼 단위) — 드래그 중에만 칩을 옮겨 그린다.
  const snappedSteps = drag?.active ? Math.round(drag.dx / colWidth) : 0;
  const clampedSteps = Math.min(Math.max(baseIdx + snappedSteps, 0), daysLen - 1) - baseIdx;
  const left = baseIdx * colWidth + 2 + clampedSteps * colWidth;

  const onPointerDown = (e: ReactPointerEvent) => {
    if (!canDrag) return;
    setDrag({ startX: e.clientX, dx: 0, active: false });
  };
  const onPointerMove = (e: ReactPointerEvent) => {
    setDrag((s) => {
      if (!s) return s;
      const dx = e.clientX - s.startX;
      if (!s.active && Math.abs(dx) < DRAG_THRESHOLD) return { ...s, dx };
      // 임계값 초과 → 드래그 확정. 칩 클릭(Popover)이 안 열리도록 pointer를 캡처한다.
      if (!s.active) {
        try {
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        } catch {
          /* 캡처 미지원 환경 무시 */
        }
      }
      return { ...s, dx, active: true };
    });
  };
  const onPointerUp = (e: ReactPointerEvent) => {
    setDrag((s) => {
      if (s?.active) {
        try {
          (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
        } catch {
          /* noop */
        }
        const steps = Math.round(s.dx / colWidth);
        if (steps !== 0) {
          onCommit(baseIdx + steps);
          // 드롭 순간 칩이 스냅 위치에 "물리로 안착"하는 피드백 — 살짝 오버슈트 후 스프링으로 1로.
          // 위치(left)는 이미 스냅돼 있으므로 scale만 튕겨 "내가 놓은 게 반영됐다"를 전한다.
          if (scope.current) {
            animate(
              scope.current,
              { scale: [1.08, 1] },
              { type: "spring", visualDuration: 0.25, bounce: 0.45 },
            );
          }
        }
      }
      return null;
    });
  };

  return (
    <div
      ref={scope}
      className={cn("absolute z-10", canDrag && "cursor-grab", drag?.active && "cursor-grabbing")}
      style={{ left, top, touchAction: canDrag ? "none" : undefined }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      <MilestoneChip milestone={m} size="sm" truncate={false} />
    </div>
  );
}

/** 교육형 빈 상태 — 간트가 처음인 팀원에게 개념을 먼저(E-F 요건). */
function GanttEmptyPrimer() {
  return (
    <div className="rounded-xl border border-[var(--que-border)] bg-[var(--que-bg)] px-6 py-10 text-center">
      <p className="text-sm font-medium text-[var(--que-text)]">아직 간트에 표시할 작업이 없습니다.</p>
      <p className="mx-auto mt-2 max-w-lg text-sm text-[var(--que-text-secondary)]">
        간트는 작업 기간을 가로 막대로 늘어놓은 그림입니다. 막대의 왼쪽 끝이 시작, 오른쪽 끝이
        마감이고, 화살표는 &ldquo;앞의 일이 끝나야 뒤의 일을 시작한다&rdquo;는 연결(선행 작업)입니다.
        작업에 시작·마감 날짜를 지정하면 여기에 나타나고, 일정이 밀릴 위험이 있는 작업에는 주의
        표시가 붙습니다.
      </p>
    </div>
  );
}
