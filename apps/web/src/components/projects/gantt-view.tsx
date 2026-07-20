"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useAnimate } from "motion/react";
import {
  TriangleAlert,
  Check,
  ChevronLeft,
  ChevronRight,
  LocateFixed,
  Pencil,
  Scissors,
  GripVertical,
  ArrowRight,
  X,
} from "lucide-react";
import type { GanttMilestone, GanttTask, ProjectGantt } from "@/lib/projects-data";
import { updateMilestoneAction } from "@/app/(app)/planning/actions";
import { setTaskPredecessorsAction, reorderTasksAction } from "@/app/(app)/projects/pm-actions";
import { useOptimisticAction } from "@/components/app/use-optimistic-action";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
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
  const filteredTasks = useMemo(
    () => (hideDone ? data.tasks.filter((t) => t.status !== "done") : data.tasks),
    [hideDone, data.tasks],
  );

  // ── 선행/후행 연결(연필·가위) 낙관 반영 ─────────────────────────────────────
  // taskId → 덮어쓴 predecessorIds. 서버 revalidate 전까지 화살표가 즉시 반영되도록 유지한다.
  const [predOverride, setPredOverride] = useState<Record<string, string[]>>({});
  const { run: runLink } = useOptimisticAction();
  // 모든 작업(필터 무관) 기준 선행 조회 — 숨긴 완료 작업도 선행/후행 후보가 될 수 있다.
  const tasksById = useMemo(() => new Map(data.tasks.map((t) => [t.taskId, t])), [data.tasks]);
  const titleById = useMemo(() => {
    const m = new Map<string, string>();
    data.tasks.forEach((t) => m.set(t.taskId, t.title));
    data.unscheduled.forEach((u) => m.set(u.taskId, u.title));
    return m;
  }, [data.tasks, data.unscheduled]);
  const predsOf = (id: string): string[] =>
    predOverride[id] ?? tasksById.get(id)?.predecessorIds ?? [];

  /** 선행 배열 전체 교체(전체 교체 시맨틱). 낙관 반영 후 실패 시 롤백. */
  const setPreds = (taskId: string, next: string[], success: string) => {
    const prev = predOverride[taskId];
    runLink(() => setTaskPredecessorsAction({ taskId, predecessorIds: next }), {
      apply: () => setPredOverride((o) => ({ ...o, [taskId]: next })),
      rollback: () =>
        setPredOverride((o) => {
          const copy = { ...o };
          if (prev === undefined) delete copy[taskId];
          else copy[taskId] = prev;
          return copy;
        }),
      success,
      source: "gantt-predecessors",
    });
  };

  // ── 세로 순서 드래그(단일 프로젝트 보기 전용) ────────────────────────────────
  // 표시 순서 낙관 오버라이드 — visibleTasks 위에 taskId 순서를 덮어쓴다. null이면 서버 순서.
  const canReorder = !showProject;
  const [orderOverride, setOrderOverride] = useState<string[] | null>(null);
  const { run: runReorder } = useOptimisticAction();
  const visibleTasks = useMemo(() => {
    if (!orderOverride) return filteredTasks;
    const byId = new Map(filteredTasks.map((t) => [t.taskId, t]));
    const inOrder = orderOverride.map((id) => byId.get(id)).filter((t): t is GanttTask => !!t);
    const seen = new Set(orderOverride);
    // 오버라이드에 없는(새로 생긴) 작업은 뒤에 붙여 유실 방지.
    filteredTasks.forEach((t) => {
      if (!seen.has(t.taskId)) inOrder.push(t);
    });
    return inOrder;
  }, [filteredTasks, orderOverride]);

  // 드래그 상태 — 핸들에서만 시작. preview = 현재 미리보기 순서(드롭 시 커밋 대상).
  const [reorderDrag, setReorderDrag] = useState<
    { id: string; startY: number; base: string[]; fromIndex: number; active: boolean; preview: string[] } | null
  >(null);

  const commitReorder = (base: string[], next: string[]) => {
    const changed = next.length !== base.length || next.some((id, i) => id !== base[i]);
    if (!changed) {
      setOrderOverride(null); // 위치 변화 없음 — 서버 순서로 복귀
      return;
    }
    const projectId = visibleTasks[0]?.projectId;
    if (!projectId) {
      setOrderOverride(null);
      return;
    }
    runReorder(() => reorderTasksAction({ projectId, orderedTaskIds: next }), {
      apply: () => setOrderOverride(next),
      rollback: () => setOrderOverride(base),
      success: "작업 순서를 바꿨습니다.",
      source: "gantt-reorder",
    });
  };

  const onReorderPointerDown = (e: ReactPointerEvent, taskId: string) => {
    if (!canReorder) return;
    e.stopPropagation();
    const base = visibleTasks.map((t) => t.taskId);
    const fromIndex = base.indexOf(taskId);
    if (fromIndex < 0) return;
    setReorderDrag({ id: taskId, startY: e.clientY, base, fromIndex, active: false, preview: base });
  };
  // setState updater 안에서 다른 setState/startTransition을 부르면 React가
  // "Cannot call startTransition while rendering"을 던진다 — 핸들러 본문에서
  // 현재 상태(reorderDrag)를 직접 읽어 부수효과를 밖으로 뺀다.
  const onReorderPointerMove = (e: ReactPointerEvent) => {
    const s = reorderDrag;
    if (!s) return;
    const dy = e.clientY - s.startY;
    if (!s.active && Math.abs(dy) < DRAG_THRESHOLD) return;
    if (!s.active) {
      try {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      } catch {
        /* 캡처 미지원 무시 */
      }
    }
    const steps = Math.round(dy / ROW_H);
    const target = Math.min(Math.max(s.fromIndex + steps, 0), s.base.length - 1);
    const next = s.base.filter((id) => id !== s.id);
    next.splice(target, 0, s.id);
    setOrderOverride(next);
    setReorderDrag({ ...s, active: true, preview: next });
  };
  const onReorderPointerUp = (e: ReactPointerEvent) => {
    const s = reorderDrag;
    if (s?.active) {
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        /* noop */
      }
      commitReorder(s.base, s.preview);
    }
    setReorderDrag(null);
  };

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
                // 행 = Link(상세 열기) + 그 위(z-20)에 드래그 핸들·연결/해제 컨트롤을 겹쳐 둔다.
                // 컨트롤은 Link 밖 형제라서 클릭이 상세 이동으로 새지 않는다(보드 PmDoneCircle 선례).
                <div
                  key={r.task.taskId}
                  className="group relative border-b border-[var(--que-bg-muted)]"
                  style={{ height: ROW_H }}
                >
                  <Link
                    href={taskHref(r.task.taskId)}
                    scroll={false}
                    className={cn(
                      "flex h-full items-center gap-2 pr-3.5 hover:bg-[var(--que-bg-muted)] focus-visible:outline-2 focus-visible:outline-[var(--que-brand)]",
                      canReorder ? "pl-8" : "pl-3.5",
                    )}
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

                  {/* 드래그 핸들 — 단일 프로젝트 보기에서만. 세로 드래그로 순서 변경. */}
                  {canReorder && (
                    <span
                      role="button"
                      aria-label={`${r.task.title} 순서 이동 — 위아래로 끌어 놓으세요`}
                      title="드래그해 순서 변경"
                      onPointerDown={(e) => onReorderPointerDown(e, r.task.taskId)}
                      onPointerMove={onReorderPointerMove}
                      onPointerUp={onReorderPointerUp}
                      className={cn(
                        "absolute top-1/2 left-0.5 z-20 flex h-10 w-6 -translate-y-1/2 touch-none items-center justify-center rounded-md text-[var(--que-text-tertiary)] transition-opacity hover:bg-[var(--que-bg-muted)] hover:text-[var(--que-text-secondary)] focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-[var(--que-brand)]",
                        reorderDrag?.id === r.task.taskId
                          ? "cursor-grabbing opacity-100"
                          : "cursor-grab pointer-events-none opacity-0 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto [@media(pointer:coarse)]:pointer-events-auto [@media(pointer:coarse)]:opacity-100",
                      )}
                    >
                      <GripVertical className="size-4" aria-hidden />
                    </span>
                  )}

                  {/* 연결(연필)·해제(가위) — Link 위 z-20. hover/포커스/터치에서 노출. */}
                  <RowControls
                    task={r.task}
                    allTasks={data.tasks}
                    predsOf={predsOf}
                    titleById={titleById}
                    onSetPreds={setPreds}
                  />
                </div>
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
                  predsOf(t.taskId).map((pid) => {
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

/** icon-only 트리거 공통 스타일(연필·가위) — 터치 40px. */
const CTRL_BTN =
  "flex size-10 items-center justify-center rounded-md text-[var(--que-text-secondary)] transition-colors hover:bg-[var(--que-bg)] hover:text-[var(--que-text)] focus-visible:outline-2 focus-visible:outline-[var(--que-brand)]";

/**
 * 작업 행의 연결(연필)·해제(가위) 컨트롤. 좌측 고정 열 행 Link 위(z-20)에 겹쳐 hover/포커스/터치에서 노출.
 * - 연필: 같은 프로젝트의 다른 작업을 선행/후행으로 연결(setTaskPredecessors 전체 교체).
 * - 가위: 현재 연결된 선행/후행을 목록에서 해제.
 * 순환·권한은 core가 최종 강제하고, 규칙 위반은 액션 결과 → toast(useOptimisticAction)로 안내된다.
 */
function RowControls({
  task,
  allTasks,
  predsOf,
  titleById,
  onSetPreds,
}: {
  task: GanttTask;
  allTasks: GanttTask[];
  predsOf: (id: string) => string[];
  titleById: Map<string, string>;
  onSetPreds: (taskId: string, next: string[], success: string) => void;
}) {
  const myPreds = predsOf(task.taskId);
  const sameProject = (c: GanttTask) => c.projectId === task.projectId && c.taskId !== task.taskId;

  // 선행 후보 = 같은 프로젝트·아직 내 선행이 아님·직접 상호참조(즉시 순환) 아님. 내 작업 편집권 필요.
  const predCandidates = task.canEdit
    ? allTasks.filter(
        (c) => sameProject(c) && !myPreds.includes(c.taskId) && !predsOf(c.taskId).includes(task.taskId),
      )
    : [];
  // 후행 후보 = 같은 프로젝트·그 작업이 내 작업을 선행으로 아직 안 가짐·그 작업 편집권 있음·즉시 순환 아님.
  const succCandidates = allTasks.filter(
    (c) => sameProject(c) && c.canEdit && !predsOf(c.taskId).includes(task.taskId) && !myPreds.includes(c.taskId),
  );

  const linkedPreds = myPreds.map((id) => ({ id, title: titleById.get(id) ?? id }));
  const linkedSuccs = allTasks.filter((c) => predsOf(c.taskId).includes(task.taskId));

  const canConnect = predCandidates.length > 0 || succCandidates.length > 0;
  const hasConnections = linkedPreds.length > 0 || linkedSuccs.length > 0;
  if (!canConnect && !hasConnections) return null;

  return (
    <div className="pointer-events-none absolute top-1/2 right-1 z-20 flex -translate-y-1/2 items-center gap-0.5 rounded-md opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:bg-[var(--que-bg-muted)] group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:bg-[var(--que-bg-muted)] group-focus-within:opacity-100 [@media(pointer:coarse)]:pointer-events-auto [@media(pointer:coarse)]:opacity-100">
      {canConnect && (
        <Popover>
          <Tooltip>
            <TooltipTrigger
              render={
                <PopoverTrigger
                  render={
                    <button type="button" aria-label={`${task.title} 선행·후행 작업 연결`} className={CTRL_BTN} />
                  }
                />
              }
            >
              <Pencil className="size-4" aria-hidden />
            </TooltipTrigger>
            <TooltipContent>선행·후행 연결</TooltipContent>
          </Tooltip>
          <PopoverContent align="start" className="w-72 gap-0 p-0">
            <p className="border-b border-[var(--que-border)] px-3 py-2 text-xs font-semibold text-[var(--que-text)]">
              연결 추가 — {task.title}
            </p>
            <div className="max-h-72 overflow-y-auto p-1.5">
              {task.canEdit && (
                <ConnectSection
                  label="선행 작업 (이 작업 앞에 끝나야 함)"
                  emptyText="연결할 선행 후보가 없습니다."
                  candidates={predCandidates}
                  onPick={(c) =>
                    onSetPreds(task.taskId, [...myPreds, c.taskId], "선행 작업을 연결했습니다.")
                  }
                />
              )}
              <ConnectSection
                label="후행 작업 (이 작업 뒤에 시작)"
                emptyText="연결할 후행 후보가 없습니다."
                candidates={succCandidates}
                onPick={(c) =>
                  onSetPreds(c.taskId, [...predsOf(c.taskId), task.taskId], "후행 작업을 연결했습니다.")
                }
              />
            </div>
          </PopoverContent>
        </Popover>
      )}

      {hasConnections && (
        <Popover>
          <Tooltip>
            <TooltipTrigger
              render={
                <PopoverTrigger
                  render={
                    <button type="button" aria-label={`${task.title} 연결 해제`} className={CTRL_BTN} />
                  }
                />
              }
            >
              <Scissors className="size-4" aria-hidden />
            </TooltipTrigger>
            <TooltipContent>연결 해제</TooltipContent>
          </Tooltip>
          <PopoverContent align="start" className="w-72 gap-0 p-0">
            <p className="border-b border-[var(--que-border)] px-3 py-2 text-xs font-semibold text-[var(--que-text)]">
              연결 해제 — {task.title}
            </p>
            <div className="max-h-72 overflow-y-auto p-1.5">
              {linkedPreds.length > 0 && (
                <DisconnectSection label="선행 작업">
                  {linkedPreds.map((p) => (
                    <DisconnectRow
                      key={p.id}
                      title={p.title}
                      canRemove={task.canEdit}
                      onRemove={() =>
                        onSetPreds(
                          task.taskId,
                          myPreds.filter((x) => x !== p.id),
                          "연결을 해제했습니다.",
                        )
                      }
                    />
                  ))}
                </DisconnectSection>
              )}
              {linkedSuccs.length > 0 && (
                <DisconnectSection label="후행 작업">
                  {linkedSuccs.map((s) => (
                    <DisconnectRow
                      key={s.taskId}
                      title={s.title}
                      canRemove={s.canEdit}
                      onRemove={() =>
                        onSetPreds(
                          s.taskId,
                          predsOf(s.taskId).filter((x) => x !== task.taskId),
                          "연결을 해제했습니다.",
                        )
                      }
                    />
                  ))}
                </DisconnectSection>
              )}
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}

/** 연결 후보 섹션 — 후보 작업 목록을 버튼으로. 선택하면 onPick. */
function ConnectSection({
  label,
  emptyText,
  candidates,
  onPick,
}: {
  label: string;
  emptyText: string;
  candidates: GanttTask[];
  onPick: (c: GanttTask) => void;
}) {
  return (
    <div className="mb-1 last:mb-0">
      <p className="px-1.5 py-1 text-[11px] font-medium text-[var(--que-text-tertiary)]">{label}</p>
      {candidates.length === 0 ? (
        <p className="px-1.5 pb-1 text-[11px] text-[var(--que-text-tertiary)]">{emptyText}</p>
      ) : (
        candidates.map((c) => (
          <button
            key={c.taskId}
            type="button"
            onClick={() => onPick(c)}
            className="flex min-h-9 w-full items-center gap-2 rounded-md px-1.5 py-1 text-left text-[13px] text-[var(--que-text)] hover:bg-[var(--que-bg-muted)] focus-visible:outline-2 focus-visible:outline-[var(--que-brand)]"
          >
            <ArrowRight className="size-3.5 shrink-0 text-[var(--que-text-tertiary)]" aria-hidden />
            <span className="truncate">{c.title}</span>
          </button>
        ))
      )}
    </div>
  );
}

function DisconnectSection({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="mb-1 last:mb-0">
      <p className="px-1.5 py-1 text-[11px] font-medium text-[var(--que-text-tertiary)]">{label}</p>
      {children}
    </div>
  );
}

/** 연결 해제 행 — 제목 + [해제] 버튼. 권한 없으면 버튼 대신 안내. */
function DisconnectRow({
  title,
  canRemove,
  onRemove,
}: {
  title: string;
  canRemove: boolean;
  onRemove: () => void;
}) {
  return (
    <div className="flex min-h-9 items-center gap-2 rounded-md px-1.5 py-1">
      <span className="min-w-0 flex-1 truncate text-[13px] text-[var(--que-text)]">{title}</span>
      {canRemove ? (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`${title} 연결 해제`}
          className="flex min-h-8 shrink-0 items-center gap-1 rounded-md border border-[var(--que-border)] px-2 text-[11px] font-medium text-[var(--que-text-secondary)] hover:bg-[var(--que-bg-muted)] hover:text-[var(--que-text)] focus-visible:outline-2 focus-visible:outline-[var(--que-brand)]"
        >
          <X className="size-3.5" aria-hidden />
          해제
        </button>
      ) : (
        <span className="shrink-0 text-[11px] text-[var(--que-text-tertiary)]">권한 없음</span>
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
  // updater 안에서 onCommit(→ startTransition)·animate를 부르지 않는다 — 핸들러 본문에서
  // 현재 상태(drag)를 읽어 부수효과를 밖으로 뺀다(세로 순서 드래그와 같은 규율).
  const onPointerUp = (e: ReactPointerEvent) => {
    const s = drag;
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
    setDrag(null);
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
