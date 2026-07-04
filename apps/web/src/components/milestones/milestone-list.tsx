"use client";

import { useState } from "react";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { updateMilestoneAction } from "@/app/(app)/planning/actions";
import { useSafeAction } from "@/components/app/use-safe-action";
import { ToneBadge, type BadgeTone } from "@/components/app/tone-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { MilestoneRow } from "@/lib/planning-data";

type Risk = MilestoneRow["riskStatus"];
const RISK: Record<Risk, { label: string; tone: BadgeTone }> = {
  on_track: { label: "정상", tone: "green" },
  at_risk: { label: "주의", tone: "amber" },
  late: { label: "지연", tone: "red" },
};

export function MilestoneList({ milestones }: { milestones: MilestoneRow[] }) {
  if (milestones.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-[var(--que-text-tertiary)]">
        등록된 마일스톤이 없습니다.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      {milestones.map((m) => (
        <MilestoneRowItem key={m.id} milestone={m} />
      ))}
    </div>
  );
}

function MilestoneRowItem({ milestone: m }: { milestone: MilestoneRow }) {
  const { run, pending } = useSafeAction();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(m.title);
  const [dueAt, setDueAt] = useState(toLocalInput(m.dueAt));

  const changeRisk = (risk: Risk) => {
    run(() => updateMilestoneAction({ milestoneId: m.id, riskStatus: risk }), {
      success: "위험 상태를 바꿨습니다.",
    });
  };

  const saveEdit = () => {
    run(
      () =>
        updateMilestoneAction({
          milestoneId: m.id,
          title,
          dueAt: new Date(dueAt).toISOString(),
        }),
      { success: "마일스톤을 수정했습니다.", onSuccess: () => setEditing(false) },
    );
  };

  return (
    <div className="rounded-lg border border-[var(--que-border)] px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-[var(--que-text)]">{m.title}</p>
          <p className="truncate text-xs text-[var(--que-text-tertiary)]">
            {m.projectName} · 기한 {format(new Date(m.dueAt), "M월 d일 (E) HH:mm", { locale: ko })}
          </p>
        </div>
        <ToneBadge tone={RISK[m.riskStatus].tone}>{RISK[m.riskStatus].label}</ToneBadge>
        {m.canManage && (
          <div className="flex items-center gap-1.5">
            <Select
              items={Object.fromEntries(
                (Object.keys(RISK) as Risk[]).map((r) => [r, RISK[r].label]),
              )}
              value={m.riskStatus}
              onValueChange={(v) => v && v !== m.riskStatus && changeRisk(v as Risk)}
            >
              <SelectTrigger aria-label="위험 상태 변경" className="h-9 w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(RISK) as Risk[]).map((r) => (
                  <SelectItem key={r} value={r}>
                    {RISK[r].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              className="h-9"
              disabled={pending}
              onClick={() => setEditing((v) => !v)}
            >
              {editing ? "닫기" : "수정"}
            </Button>
          </div>
        )}
      </div>

      {editing && m.canManage && (
        <div className="mt-2.5 flex flex-wrap items-end gap-2 border-t border-[var(--que-border)] pt-2.5">
          <label className="flex flex-1 flex-col gap-1 text-xs text-[var(--que-text-secondary)]">
            제목
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-xs text-[var(--que-text-secondary)]">
            기한
            <Input
              type="datetime-local"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
            />
          </label>
          <Button className="h-10" disabled={pending || !title.trim() || !dueAt} onClick={saveEdit}>
            {pending ? "저장 중…" : "저장"}
          </Button>
        </div>
      )}
    </div>
  );
}

/** ISO → datetime-local(YYYY-MM-DDTHH:mm) 로컬 표시값. */
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
