"use client";

import { useState } from "react";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { AlertTriangle, ClipboardList } from "lucide-react";
import { updateMilestoneAction } from "@/app/(app)/planning/actions";
import { useSafeAction } from "@/components/app/use-safe-action";
import { ToneBadge, type BadgeTone } from "@/components/app/tone-badge";
import { MilestoneRetroDialog } from "@/components/retro/milestone-retro-dialog";
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

export function MilestoneList({
  milestones,
  canCreate = false,
}: {
  milestones: MilestoneRow[];
  /** 관리 가능한 프로젝트가 있어 위 등록 폼을 쓸 수 있는지. 빈 상태 안내 문구 분기용. */
  canCreate?: boolean;
}) {
  if (milestones.length === 0) {
    // 교육형 빈 상태 — '마일스톤'이 무엇인지 모르는 팀원에게 개념·예시를 함께 안내한다.
    return (
      <div className="py-6 text-center">
        <p className="text-sm font-medium text-[var(--que-text)]">
          아직 등록된 마일스톤이 없습니다.
        </p>
        <p className="mx-auto mt-1.5 max-w-md text-sm text-[var(--que-text-secondary)]">
          마일스톤이란 프로젝트의 중요한 기한 지점입니다. 예를 들어 1차 오픈, 최종 납품처럼 꼭
          지켜야 하는 날을 표시합니다. 마일스톤을 등록하면 기한 위험을 미리 확인할 수 있습니다.
        </p>
        {canCreate && (
          <p className="mt-1.5 text-xs text-[var(--que-text-tertiary)]">
            위 <b className="font-medium text-[var(--que-text-secondary)]">마일스톤 등록</b> 폼에서
            추가할 수 있습니다.
          </p>
        )}
      </div>
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
  const [retroOpen, setRetroOpen] = useState(false);
  const [title, setTitle] = useState(m.title);
  const [dueAt, setDueAt] = useState(toLocalInput(m.dueAt));

  // 기한이 지났는데 리스크가 아직 '지연'이 아니면 시각 힌트만 덧붙인다(리스크 값 자동 변경 안 함).
  const overdue = new Date(m.dueAt) < new Date() && m.riskStatus !== "late";
  // OS-2a — 회고가 필요한데 아직 없는 마일스톤에 "회고 남기기" 강조(부록 B). 담당·관리자만.
  const retroNeeded = m.needsRetro && !m.hasRetro;

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
        {overdue && (
          <span className="flex items-center gap-1 text-xs font-medium text-[var(--que-error)]">
            <AlertTriangle className="size-3.5" aria-hidden />
            기한 초과
          </span>
        )}
        {retroNeeded && (
          <span className="flex items-center gap-1 text-xs font-medium text-[var(--que-warning)]">
            <ClipboardList className="size-3.5" aria-hidden />
            회고 필요
          </span>
        )}
        {retroNeeded && m.canManage && (
          <Button
            size="sm"
            className="h-10 gap-1.5 bg-[var(--que-warning)] text-[var(--que-on-brand)] hover:opacity-90"
            onClick={() => setRetroOpen(true)}
          >
            <ClipboardList className="size-4" aria-hidden />
            회고 남기기
          </Button>
        )}
        {m.canManage && (
          <div className="flex items-center gap-1.5">
            <Select
              items={Object.fromEntries(
                (Object.keys(RISK) as Risk[]).map((r) => [r, RISK[r].label]),
              )}
              value={m.riskStatus}
              onValueChange={(v) => v && v !== m.riskStatus && changeRisk(v as Risk)}
            >
              <SelectTrigger aria-label="위험 상태 변경" size="lg" className="w-24">
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
              className="h-10"
              disabled={pending}
              onClick={() => setEditing((v) => !v)}
            >
              {editing ? "닫기" : "수정"}
            </Button>
          </div>
        )}
        {!m.canManage && (
          <p className="text-xs text-[var(--que-text-tertiary)]">
            프로젝트 담당자·관리자만 수정할 수 있습니다.
          </p>
        )}
      </div>

      {editing && m.canManage && (
        <div className="mt-2.5 flex flex-wrap items-end gap-2 border-t border-[var(--que-border)] pt-2.5">
          <label className="flex flex-1 flex-col gap-1 text-xs text-[var(--que-text-secondary)]">
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
          <Button className="h-10" disabled={pending || !title.trim() || !dueAt} onClick={saveEdit}>
            {pending ? "저장 중…" : "저장"}
          </Button>
        </div>
      )}

      {m.canManage && (
        <MilestoneRetroDialog
          open={retroOpen}
          onOpenChange={setRetroOpen}
          milestoneId={m.id}
          milestoneTitle={m.title}
          contextLabel={`${m.projectName} · 기한 ${format(new Date(m.dueAt), "M월 d일", { locale: ko })}`}
          managed={m.managed}
        />
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
