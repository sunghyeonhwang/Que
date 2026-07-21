"use client";

import { useState } from "react";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { AlertTriangle, Check, Diamond } from "lucide-react";
import {
  setMilestoneAchievedAction,
  updateMilestoneAction,
} from "@/app/(app)/planning/actions";
import { useSafeAction } from "@/components/app/use-safe-action";
import { ToneBadge, type BadgeTone } from "@/components/app/tone-badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  DuePicker,
  joinDateTimeLocal,
  splitDateTimeLocal,
} from "@/components/app/due-picker";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

// 공용 마일스톤 칩 — /schedule에서 사용자 지정된 시안→옐로 그라데이션 + shimmer 룩(2026-07-11)을
// 마일스톤의 시각 정체성으로 확정하고, 일정·프로젝트(캘린더/보드/목록/간트)에서 재사용한다.
// 칩 자체가 버튼(Popover 트리거)이라 클릭하면 상세를 열고, 관리 권한(canManage)이 있으면
// 제목·기한·위험 상태를 그 자리에서 수정한다. 권한이 없으면 조회 전용(수정 컨트롤 숨김 + 안내).
// 수정은 core updateMilestone을 거치는 updateMilestoneAction 재사용 — 데이터 하드코딩 없음.

export type MilestoneRisk = "on_track" | "at_risk" | "late";

/** 공용 칩이 받는 최소 마일스톤 뷰모델. 데이터 계층에서 canManage를 판정해 내려보낸다. */
export interface MilestoneChipData {
  id: string;
  title: string;
  /** 기한 ISO datetime. */
  dueAt: string;
  riskStatus: MilestoneRisk;
  /** 중요 마일스톤(최종 런칭일 등) — 붉은 그라데이션으로 표기. */
  critical?: boolean;
  projectName: string;
  /** 완료 시각(ISO). 있으면 달성 완료 — 칩은 그라데이션 대신 중립 muted + ✓로 물러난다.
   *  완료면 위험 상태색을 숨긴다(완료가 위험 표기를 이긴다). null/undefined=미완료. */
  achievedAt?: string | null;
  /** 현재 사용자가 이 마일스톤을 수정할 수 있는지(canManageMilestone). false면 조회 전용. */
  canManage: boolean;
}

const RISK: Record<MilestoneRisk, { label: string; tone: BadgeTone }> = {
  on_track: { label: "정상", tone: "green" },
  at_risk: { label: "주의", tone: "amber" },
  late: { label: "지연", tone: "red" },
};

type Size = "sm" | "md";

const SIZE_CLASS: Record<Size, string> = {
  // 캘린더 셀·일정처럼 촘촘한 곳: 사용자 지정 기준(13px, min-h-8).
  md: "min-h-8 gap-1 px-2 py-1 text-[13px]",
  // 간트 레인처럼 더 촘촘한 곳: 살짝 작게(11px, min-h-7)하되 그라데이션 정체성은 유지.
  sm: "min-h-7 gap-1 px-1.5 py-0.5 text-[11px]",
};

/**
 * 마일스톤 칩(공용). 어디서 쓰든 같은 그라데이션 룩. 클릭 → 상세/수정 Popover.
 * @param truncate 셀 폭에 맞춰 제목을 자를지(캘린더 셀=true). 간트 레인처럼 옆으로
 *   흘려도 되는 곳은 false로 두면 제목이 잘리지 않는다.
 */
export function MilestoneChip({
  milestone: m,
  size = "md",
  truncate = true,
  className,
}: {
  milestone: MilestoneChipData;
  size?: Size;
  truncate?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const risk = RISK[m.riskStatus] ?? RISK.on_track;
  const achieved = Boolean(m.achievedAt);
  // 완료면 위험/기한초과 표기를 숨긴다(완료가 이긴다).
  const overdue = !achieved && new Date(m.dueAt) < new Date() && m.riskStatus !== "late";
  const kind = m.critical ? "중요 마일스톤" : "마일스톤";
  const stateLabel = achieved ? "완료" : risk.label;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label={`${achieved ? "완료된 " : ""}${kind} ${m.title} · ${stateLabel}${m.canManage ? " · 눌러서 수정" : ""}`}
        title={`${kind} · ${stateLabel} · ${m.title} (${m.projectName})`}
        className={cn(
          "flex items-center rounded font-semibold outline-none",
          // 완료 = 중립 muted 톤(간트 완료 작업 선례 — 뒤로 물러나되 읽을 수 있게, 취소선 없음) /
          // 중요(critical) = 옐로→오렌지 그라데이션(최종 런칭일 등 — 2026-07-13 사용자 지정 색) /
          // 일반 = 시안→옐로(마일스톤 정체성).
          achieved
            ? "border border-[var(--que-border-strong)] bg-[var(--que-bg-muted)] text-[var(--que-text-tertiary)]"
            : m.critical
              ? "que-shimmer-btn bg-[linear-gradient(90deg,rgba(253,227,29,1)_0%,rgba(252,176,69,1)_100%)] text-[#5b2c00]"
              : "que-shimmer-btn bg-[linear-gradient(144deg,rgba(0,242,255,1)_0%,rgba(255,247,0,1)_100%)] text-[#004466]",
          "focus-visible:ring-2 focus-visible:ring-[var(--que-brand)] focus-visible:ring-offset-1",
          truncate ? "truncate" : "w-max whitespace-nowrap",
          SIZE_CLASS[size],
          className,
        )}
      >
        {achieved ? (
          // 색 단독 금지 — 완료는 ✓ 아이콘 병기(que-success 틴트).
          <Check className="size-3 shrink-0 text-[var(--que-success)]" aria-hidden />
        ) : (
          <Diamond className={cn("size-3 shrink-0", m.critical && "fill-current")} aria-hidden />
        )}
        <span className="sr-only">
          {achieved ? "완료된 " : ""}
          {kind} {stateLabel}:{" "}
        </span>
        <span className={truncate ? "truncate" : undefined}>{m.title}</span>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80">
        {m.canManage ? (
          <MilestoneEditForm milestone={m} onDone={() => setOpen(false)} />
        ) : (
          <MilestoneReadOnly milestone={m} overdue={overdue} />
        )}
      </PopoverContent>
    </Popover>
  );
}

/** 조회 전용 상세 — 수정 권한이 없는 사용자용. */
function MilestoneReadOnly({
  milestone: m,
  overdue,
}: {
  milestone: MilestoneChipData;
  overdue: boolean;
}) {
  const achieved = Boolean(m.achievedAt);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-[var(--que-text)]">{m.title}</p>
        {achieved ? (
          <ToneBadge tone="neutral">
            <Check className="size-3 text-[var(--que-success)]" aria-hidden />
            완료
          </ToneBadge>
        ) : (
          <ToneBadge tone={RISK[m.riskStatus].tone}>{RISK[m.riskStatus].label}</ToneBadge>
        )}
      </div>
      <p className="text-xs text-[var(--que-text-tertiary)]">
        {m.projectName} · 기한 {format(new Date(m.dueAt), "M월 d일 (E) HH:mm", { locale: ko })}
      </p>
      {achieved && m.achievedAt && (
        <span className="flex items-center gap-1 text-xs font-medium text-[var(--que-text-secondary)]">
          <Check className="size-3.5 text-[var(--que-success)]" aria-hidden />
          {format(new Date(m.achievedAt), "M월 d일 (E)", { locale: ko })} 완료
        </span>
      )}
      {overdue && (
        <span className="flex items-center gap-1 text-xs font-medium text-[var(--que-error)]">
          <AlertTriangle className="size-3.5" aria-hidden />
          기한 초과
        </span>
      )}
      <p className="border-t border-[var(--que-border)] pt-2 text-xs text-[var(--que-text-tertiary)]">
        프로젝트 담당자·관리자만 수정할 수 있습니다.
      </p>
    </div>
  );
}

/** 수정 폼 — 제목·기한·위험 상태. core updateMilestone(updateMilestoneAction) 경유. */
function MilestoneEditForm({
  milestone: m,
  onDone,
}: {
  milestone: MilestoneChipData;
  onDone: () => void;
}) {
  const { run, pending } = useSafeAction();
  const achieved = Boolean(m.achievedAt);
  const [title, setTitle] = useState(m.title);
  const [dueAt, setDueAt] = useState(toLocalInput(m.dueAt));
  const [risk, setRisk] = useState<MilestoneRisk>(m.riskStatus);
  const [critical, setCritical] = useState(m.critical === true);

  const save = () => {
    run(
      () =>
        updateMilestoneAction({
          milestoneId: m.id,
          title: title.trim(),
          dueAt: new Date(dueAt).toISOString(),
          riskStatus: risk,
          critical,
        }),
      { success: "마일스톤을 수정했습니다.", onSuccess: onDone },
    );
  };

  const toggleAchieved = () => {
    run(
      () => setMilestoneAchievedAction({ milestoneId: m.id, achieved: !achieved }),
      {
        success: achieved ? "완료를 해제했습니다." : "마일스톤을 완료했습니다.",
        onSuccess: onDone,
      },
    );
  };

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-col gap-0.5">
        <p className="text-sm font-semibold text-[var(--que-text)]">마일스톤 수정</p>
        <p className="text-xs text-[var(--que-text-tertiary)]">{m.projectName}</p>
      </div>
      {/* 완료 상태에서는 기한 수정보다 완료 해제가 먼저 보이게 상단에 배치(운영 톤). */}
      {achieved && (
        <div className="flex flex-col gap-2 rounded-md border border-[var(--que-border)] bg-[var(--que-bg-muted)] p-2.5">
          <span className="flex items-center gap-1.5 text-xs font-medium text-[var(--que-text-secondary)]">
            <Check className="size-3.5 text-[var(--que-success)]" aria-hidden />
            {m.achievedAt
              ? `${format(new Date(m.achievedAt), "M월 d일 (E)", { locale: ko })} 완료`
              : "완료"}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="h-10 w-full"
            disabled={pending}
            onClick={toggleAchieved}
          >
            {pending ? "처리 중…" : "완료 해제"}
          </Button>
        </div>
      )}
      <label className="flex flex-col gap-1 text-xs text-[var(--que-text-secondary)]">
        제목
        <Input className="h-10" value={title} onChange={(e) => setTitle(e.target.value)} />
      </label>
      <div className="flex flex-col gap-1 text-xs text-[var(--que-text-secondary)]">
        기한
        <DuePicker
          dueDate={splitDateTimeLocal(dueAt).date}
          dueTime={splitDateTimeLocal(dueAt).time}
          timeMin="08:00"
          timeMax="20:00"
          emptyLabel="기한 미정"
          onSelectDate={(d) =>
            setDueAt(joinDateTimeLocal(d, splitDateTimeLocal(dueAt).time, "17:00"))
          }
          onSelectDueTime={(t) =>
            setDueAt(joinDateTimeLocal(splitDateTimeLocal(dueAt).date, t, "17:00"))
          }
          triggerAriaLabel="마일스톤 기한 설정"
        />
      </div>
      <label className="flex flex-col gap-1 text-xs text-[var(--que-text-secondary)]">
        위험 상태
        <Select
          items={Object.fromEntries(
            (Object.keys(RISK) as MilestoneRisk[]).map((r) => [r, RISK[r].label]),
          )}
          value={risk}
          onValueChange={(v) => v && setRisk(v as MilestoneRisk)}
        >
          <SelectTrigger aria-label="위험 상태" size="lg" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(RISK) as MilestoneRisk[]).map((r) => (
              <SelectItem key={r} value={r}>
                {RISK[r].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </label>
      <label className="flex w-fit cursor-pointer items-center gap-2 text-xs text-[var(--que-text-secondary)]">
        <Checkbox
          checked={critical}
          onCheckedChange={(v) => setCritical(v === true)}
          aria-label="중요 마일스톤"
        />
        중요 마일스톤 (붉은 표시 — 최종 런칭일 등)
      </label>
      {/* 미완료일 때만 완료 처리 — 완료 상태 토글은 상단(완료 해제)에서 처리한다. */}
      {!achieved && (
        <Button
          variant="outline"
          size="sm"
          className="h-10 w-full gap-1.5"
          disabled={pending}
          onClick={toggleAchieved}
        >
          <Check className="size-4 text-[var(--que-success)]" aria-hidden />
          {pending ? "처리 중…" : "완료 처리"}
        </Button>
      )}
      <div className="flex justify-end gap-2 pt-0.5">
        <Button variant="outline" size="sm" className="h-10" disabled={pending} onClick={onDone}>
          취소
        </Button>
        <Button
          size="sm"
          className="h-10"
          disabled={pending || !title.trim() || !dueAt}
          onClick={save}
        >
          {pending ? "저장 중…" : "저장"}
        </Button>
      </div>
    </div>
  );
}

/** ISO → datetime-local(YYYY-MM-DDTHH:mm) 로컬 표시값. */
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
