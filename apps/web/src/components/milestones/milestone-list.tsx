"use client";

import { useState } from "react";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { AlertTriangle, Check, ClipboardList, Trash2 } from "lucide-react";
import {
  deleteMilestoneAction,
  setMilestoneAchievedAction,
  updateMilestoneAction,
} from "@/app/(app)/planning/actions";
import { useSafeAction } from "@/components/app/use-safe-action";
import { ToneBadge, type BadgeTone } from "@/components/app/tone-badge";
import { MilestoneRetroDialog } from "@/components/retro/milestone-retro-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  DuePicker,
  joinDateTimeLocal,
  splitDateTimeLocal,
} from "@/components/app/due-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { MilestoneRow } from "@/lib/planning-data";
import { cn } from "@/lib/utils";

type Risk = MilestoneRow["riskStatus"];
const RISK: Record<Risk, { label: string; tone: BadgeTone }> = {
  on_track: { label: "정상", tone: "green" },
  at_risk: { label: "주의", tone: "amber" },
  late: { label: "지연", tone: "red" },
};

export function MilestoneList({
  milestones,
  manageableProjects = [],
  canCreate = false,
}: {
  milestones: MilestoneRow[];
  /** 마일스톤을 옮길 수 있는 프로젝트(관리자·담당자만) — 수정 폼의 프로젝트 Select 소스. */
  manageableProjects?: { id: string; name: string }[];
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
  // 완료 행은 목록 하단으로(표시용 정렬만 — 서버 정렬은 그대로 두고 완료 여부로 안정 정렬).
  const ordered = [...milestones].sort(
    (a, b) => Number(Boolean(a.achievedAt)) - Number(Boolean(b.achievedAt)),
  );
  return (
    <div className="flex flex-col gap-2">
      {ordered.map((m) => (
        <MilestoneRowItem key={m.id} milestone={m} manageableProjects={manageableProjects} />
      ))}
    </div>
  );
}

function MilestoneRowItem({
  milestone: m,
  manageableProjects,
}: {
  milestone: MilestoneRow;
  manageableProjects: { id: string; name: string }[];
}) {
  const { run, pending } = useSafeAction();
  const [editing, setEditing] = useState(false);
  const [retroOpen, setRetroOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [title, setTitle] = useState(m.title);
  const [dueAt, setDueAt] = useState(toLocalInput(m.dueAt));
  const [critical, setCritical] = useState(m.critical === true);
  const [projectId, setProjectId] = useState(m.projectId);

  const achieved = Boolean(m.achievedAt);
  // 완료면 위험/기한초과/회고 신호를 숨긴다(완료가 이긴다).
  // 기한이 지났는데 리스크가 아직 '지연'이 아니면 시각 힌트만 덧붙인다(리스크 값 자동 변경 안 함).
  const overdue = !achieved && new Date(m.dueAt) < new Date() && m.riskStatus !== "late";
  // OS-2a — 회고가 필요한데 아직 없는 마일스톤에 "회고 남기기" 강조(부록 B). 담당·관리자만.
  const retroNeeded = m.needsRetro && !m.hasRetro && !achieved;

  const changeRisk = (risk: Risk) => {
    run(() => updateMilestoneAction({ milestoneId: m.id, riskStatus: risk }), {
      success: "위험 상태를 바꿨습니다.",
    });
  };

  const toggleAchieved = () => {
    run(() => setMilestoneAchievedAction({ milestoneId: m.id, achieved: !achieved }), {
      success: achieved ? "완료를 해제했습니다." : "마일스톤을 완료했습니다.",
    });
  };

  const saveEdit = () => {
    run(
      () =>
        updateMilestoneAction({
          milestoneId: m.id,
          title,
          dueAt: new Date(dueAt).toISOString(),
          // projectId가 바뀌었을 때만 전달 — core가 대상 프로젝트 실존·활성·양쪽 권한을 강제한다.
          projectId: projectId !== m.projectId ? projectId : undefined,
          critical,
        }),
      { success: "마일스톤을 수정했습니다.", onSuccess: () => setEditing(false) },
    );
  };

  const removeMilestone = () => {
    run(() => deleteMilestoneAction({ milestoneId: m.id }), {
      success: "마일스톤을 삭제했습니다.",
      onSuccess: () => setConfirmDelete(false),
    });
  };

  return (
    <div
      className={cn(
        "rounded-lg border border-[var(--que-border)] px-3 py-2.5",
        // 완료 행은 뒤로 물러남(중립 배경) — 취소선 없이 읽을 수 있게.
        achieved && "bg-[var(--que-bg-muted)]",
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "flex items-center gap-1.5 truncate text-sm font-medium",
              achieved ? "text-[var(--que-text-tertiary)]" : "text-[var(--que-text)]",
            )}
          >
            {achieved && (
              <Check className="size-3.5 shrink-0 text-[var(--que-success)]" aria-hidden />
            )}
            <span className="truncate">{m.title}</span>
          </p>
          <p className="truncate text-xs text-[var(--que-text-tertiary)]">
            {m.projectName} · 기한 {format(new Date(m.dueAt), "M월 d일 (E) HH:mm", { locale: ko })}
            {achieved &&
              m.achievedAt &&
              ` · ${format(new Date(m.achievedAt), "M월 d일", { locale: ko })} 완료`}
          </p>
        </div>
        {/* 중요 마일스톤(최종 런칭일 등) — 칩과 같은 옐로→오렌지 그라데이션 미니 뱃지(완료면 숨김). */}
        {m.critical && !achieved && (
          <span className="rounded bg-[linear-gradient(90deg,rgba(253,227,29,1)_0%,rgba(252,176,69,1)_100%)] px-1.5 py-0.5 text-xs font-semibold text-[#5b2c00]">
            중요
          </span>
        )}
        {achieved ? (
          <ToneBadge tone="neutral">
            <Check className="size-3 text-[var(--que-success)]" aria-hidden />
            완료
          </ToneBadge>
        ) : (
          <ToneBadge tone={RISK[m.riskStatus].tone}>{RISK[m.riskStatus].label}</ToneBadge>
        )}
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
            {/* 완료면 위험 상태 변경은 무의미 — 숨기고 완료 해제를 먼저 노출한다. */}
            {!achieved && (
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
            )}
            <Button
              variant="outline"
              size="sm"
              className="h-10 gap-1.5"
              disabled={pending}
              onClick={toggleAchieved}
            >
              <Check
                className={cn("size-4", !achieved && "text-[var(--que-success)]")}
                aria-hidden
              />
              {achieved ? "완료 해제" : "완료"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-10"
              disabled={pending}
              onClick={() => setEditing((v) => !v)}
            >
              {editing ? "닫기" : "수정"}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="마일스톤 삭제"
              className="size-10 text-[var(--que-text-tertiary)] hover:bg-[var(--que-error)]/10 hover:text-[var(--que-error)]"
              disabled={pending}
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 className="size-4" aria-hidden />
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
          {/* 소속 프로젝트 변경 — 내가 관리하는 프로젝트로만 옮길 수 있다(core가 양쪽 권한 재검사). */}
          {manageableProjects.length > 0 && (
            <div className="flex w-48 flex-col gap-1 text-xs text-[var(--que-text-secondary)]">
              프로젝트
              <Select
                items={Object.fromEntries(manageableProjects.map((p) => [p.id, p.name]))}
                value={projectId}
                onValueChange={(v) => v && setProjectId(v)}
              >
                <SelectTrigger aria-label="프로젝트 변경" size="lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {manageableProjects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <label className="flex flex-1 flex-col gap-1 text-xs text-[var(--que-text-secondary)]">
            제목
            <Input className="h-10" value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <div className="flex w-56 flex-col gap-1 text-xs text-[var(--que-text-secondary)]">
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
          <label className="flex h-10 cursor-pointer items-center gap-2 text-xs text-[var(--que-text-secondary)]">
            <Checkbox
              checked={critical}
              onCheckedChange={(v) => setCritical(v === true)}
              aria-label="중요 마일스톤"
            />
            중요
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

      {m.canManage && (
        <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>마일스톤 삭제</DialogTitle>
              <DialogDescription>
                &quot;{m.title}&quot; 마일스톤을 삭제하면 되돌릴 수 없습니다. 회고나 변경 접수
                이력이 있는 마일스톤은 이력 보존을 위해 삭제되지 않습니다.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose render={<Button variant="outline" className="h-10" />}>취소</DialogClose>
              <Button
                variant="destructive"
                className="h-10"
                disabled={pending}
                onClick={removeMilestone}
              >
                {pending ? "삭제 중…" : "삭제"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
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
