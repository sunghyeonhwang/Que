"use client";

import { useState } from "react";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { AlertTriangle, Diamond } from "lucide-react";
import { updateMilestoneAction } from "@/app/(app)/planning/actions";
import { useSafeAction } from "@/components/app/use-safe-action";
import { ToneBadge, type BadgeTone } from "@/components/app/tone-badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
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
  const overdue = new Date(m.dueAt) < new Date() && m.riskStatus !== "late";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label={`${m.critical ? "중요 마일스톤" : "마일스톤"} ${m.title} · ${risk.label}${m.canManage ? " · 눌러서 수정" : ""}`}
        title={`${m.critical ? "중요 마일스톤" : "마일스톤"} · ${risk.label} · ${m.title} (${m.projectName})`}
        className={cn(
          "que-shimmer-btn flex items-center rounded font-semibold outline-none",
          // 중요(critical) = 옐로→오렌지 그라데이션(최종 런칭일 등 — 2026-07-13 사용자 지정 색) /
          // 일반 = 시안→옐로(마일스톤 정체성).
          m.critical
            ? "bg-[linear-gradient(90deg,rgba(253,227,29,1)_0%,rgba(252,176,69,1)_100%)] text-[#5b2c00]"
            : "bg-[linear-gradient(144deg,rgba(0,242,255,1)_0%,rgba(255,247,0,1)_100%)] text-[#004466]",
          "focus-visible:ring-2 focus-visible:ring-[var(--que-brand)] focus-visible:ring-offset-1",
          truncate ? "truncate" : "w-max whitespace-nowrap",
          SIZE_CLASS[size],
          className,
        )}
      >
        <Diamond className={cn("size-3 shrink-0", m.critical && "fill-current")} aria-hidden />
        <span className="sr-only">{m.critical ? "중요 마일스톤" : "마일스톤"} {risk.label}: </span>
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
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-[var(--que-text)]">{m.title}</p>
        <ToneBadge tone={RISK[m.riskStatus].tone}>{RISK[m.riskStatus].label}</ToneBadge>
      </div>
      <p className="text-xs text-[var(--que-text-tertiary)]">
        {m.projectName} · 기한 {format(new Date(m.dueAt), "M월 d일 (E) HH:mm", { locale: ko })}
      </p>
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

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-col gap-0.5">
        <p className="text-sm font-semibold text-[var(--que-text)]">마일스톤 수정</p>
        <p className="text-xs text-[var(--que-text-tertiary)]">{m.projectName}</p>
      </div>
      <label className="flex flex-col gap-1 text-xs text-[var(--que-text-secondary)]">
        제목
        <Input className="h-10" value={title} onChange={(e) => setTitle(e.target.value)} />
      </label>
      <label className="flex flex-col gap-1 text-xs text-[var(--que-text-secondary)]">
        기한
        <Input
          type="datetime-local"
          className="h-10"
          value={dueAt}
          onChange={(e) => setDueAt(e.target.value)}
        />
      </label>
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
