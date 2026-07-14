"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ChevronDown, ChevronUp, Pencil, Plus, Split } from "lucide-react";
import { ACTION_ITEM_STATUS_LABELS, type ActionItemStatus } from "@que/core";
import { useRoster } from "@/components/app/roster-provider";
import { useSafeAction } from "@/components/app/use-safe-action";
import { DuePicker, formatDueLabel } from "@/components/app/due-picker";
import { SplitActionDialog } from "@/components/action/split-action-dialog";
import {
  confirmActionItemAction,
  createProjectAction,
  setActionItemStatusAction,
  updateActionItemAction,
} from "@/app/(app)/action/actions";
import { ToneBadge, type BadgeTone } from "@/components/app/tone-badge";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** 프로젝트 선택 옵션 — name은 "클라이언트 · 프로젝트" 병기 라벨(조립은 서버에서). */
export interface ActionProjectOption {
  id: string;
  name: string;
}

/** 인라인 프로젝트 생성용 클라이언트 옵션. */
export interface ActionClientOption {
  id: string;
  name: string;
}

export interface ActionRowData {
  id: string;
  title: string;
  sourceText: string;
  noteName: string;
  status: ActionItemStatus;
  assigneeId?: string;
  projectId?: string;
  dueDate?: string; // YYYY-MM-DD
  dueTime?: string; // HH:mm
  projectName?: string;
}

// 상태 색상 의미 고정: 확인 필요=violet(응답대기) · 후보=blue(정보) · 생성=green(완료) ·
// 보류=amber(대기) · 무시=red(취소).
const STATUS_TONE: Record<ActionItemStatus, BadgeTone> = {
  needs_review: "violet",
  candidate: "blue",
  created: "green",
  held: "amber",
  ignored: "red",
};

const NEW_PROJECT = "__new_project__";
const CLIENT_NONE = "__client_none__";
const pad = (n: number) => String(n).padStart(2, "0");

/** HH:mm에서 1시간을 빼되 00:00 밑으로는 클램프. */
function minusOneHour(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return hhmm;
  const total = Math.max(0, h * 60 + m - 60);
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
}

/** Action 후보 한 줄 — 기본 접힘(요약), 펼치면 담당자·프로젝트·마감 편집과 처리 버튼. */
export function ActionRow({
  item,
  projects,
  clients,
}: {
  item: ActionRowData;
  projects: ActionProjectOption[];
  clients: ActionClientOption[];
}) {
  const roster = useRoster();
  const userItems = Object.fromEntries(roster.map((u) => [u.id, u.name]));
  const { run: runAction, pending } = useSafeAction();

  const [expanded, setExpanded] = useState(false);
  const [title, setTitle] = useState(item.title);
  const [editingTitle, setEditingTitle] = useState(false);
  const [assigneeId, setAssigneeId] = useState(item.assigneeId ?? "");
  const [projectId, setProjectId] = useState(item.projectId ?? "");
  const [dueDate, setDueDate] = useState(item.dueDate ?? "");
  const [dueTime, setDueTime] = useState(item.dueTime ?? "");
  const [startTime, setStartTime] = useState("");
  // 시작 시각을 사용자가 직접 만졌으면 자동(−1h) 갱신을 멈춘다.
  const [startManual, setStartManual] = useState(false);

  // 인라인 생성한 프로젝트를 즉시 목록에 반영(revalidate 전 낙관 표시).
  const [extraProjects, setExtraProjects] = useState<ActionProjectOption[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [splitOpen, setSplitOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newClientId, setNewClientId] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const resolved = item.status === "created" || item.status === "ignored";

  const allProjects = useMemo(() => {
    const seen = new Set(projects.map((p) => p.id));
    return [...projects, ...extraProjects.filter((p) => !seen.has(p.id))];
  }, [projects, extraProjects]);
  const projectItems = Object.fromEntries(allProjects.map((p) => [p.id, p.name]));
  const clientItems = Object.fromEntries(clients.map((c) => [c.id, c.name]));

  const run = (fn: Parameters<typeof runAction>[0], successMessage: string) => {
    runAction(fn, { success: successMessage });
  };

  // 저장 대상: 제목·담당자·프로젝트·마감일·마감시각. 시작시각은 확정 전용(저장 대상 아님).
  const dirty =
    title !== item.title ||
    assigneeId !== (item.assigneeId ?? "") ||
    projectId !== (item.projectId ?? "") ||
    dueDate !== (item.dueDate ?? "") ||
    dueTime !== (item.dueTime ?? "");

  const save = () =>
    run(
      () =>
        updateActionItemAction({
          actionItemId: item.id,
          title: title !== item.title ? title : undefined,
          assigneeId: assigneeId || undefined,
          projectId: projectId || undefined,
          dueDate: dueDate || undefined,
          dueTime: dueTime || undefined,
        }),
      "후보 정보를 저장했습니다.",
    );

  const cancelTitleEdit = () => {
    setTitle(item.title);
    setEditingTitle(false);
  };

  // 마감 시각 변경 → 시작 시각 −1h 자동(수동 편집 전까지).
  const handleDueTime = (time: string) => {
    setDueTime(time);
    // 자동 모드에서는 마감 시각을 따라간다 — 지우면 시작도 비워 이전 마감의 잔존 시작이
    // Task 생성에 딸려가지 않게 한다(글래도스 경미 지적).
    if (!startManual) setStartTime(time ? minusOneHour(time) : "");
  };
  const handleStartTime = (time: string) => {
    setStartTime(time);
    setStartManual(true);
  };
  const clearDue = () => {
    setDueDate("");
    setDueTime("");
  };

  const handleProjectChange = (value: string | null) => {
    if (value === NEW_PROJECT) {
      setCreateError(null);
      setDialogOpen(true);
      return;
    }
    setProjectId(value ?? "");
  };

  const submitNewProject = async () => {
    const name = newName.trim();
    if (!name) {
      setCreateError("프로젝트명을 입력하세요.");
      return;
    }
    setCreating(true);
    setCreateError(null);
    const result = await createProjectAction({
      name,
      clientId: newClientId || undefined,
    });
    setCreating(false);
    if (!result.ok) {
      setCreateError(result.error);
      return;
    }
    setExtraProjects((prev) => [...prev, result.project]);
    setProjectId(result.project.id);
    setDialogOpen(false);
    setNewName("");
    setNewClientId("");
    toast.success("프로젝트를 만들었습니다.");
  };

  // 접힘 요약 텍스트 — 담당/마감.
  const assigneeName = assigneeId ? (userItems[assigneeId] ?? assigneeId) : null;
  const summary =
    (assigneeName ? `담당 ${assigneeName}` : "담당 미지정") +
    (dueDate ? ` · ${formatDueLabel(dueDate, dueTime)}` : "");

  // resolved(생성/무시)는 편집 없이 요약만.
  if (resolved) {
    return (
      <div className="rounded-xl border border-[var(--que-border)] bg-[var(--que-bg)] p-3">
        <div className="flex items-center gap-2">
          <ToneBadge tone={STATUS_TONE[item.status]}>
            {ACTION_ITEM_STATUS_LABELS[item.status]}
          </ToneBadge>
          <p className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--que-text)]">
            {title}
          </p>
        </div>
        <p className="mt-1 truncate text-xs text-[var(--que-text-tertiary)]">
          원문: “{item.sourceText}” — {item.noteName}
          {item.projectName ? ` · ${item.projectName}` : ""}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--que-border)] bg-[var(--que-bg)]">
      {!expanded ? (
        // 접힘: '생성된 Task' 행과 같은 밀도의 요약 1행(전체 클릭 44px).
        <button
          type="button"
          aria-expanded={false}
          onClick={() => setExpanded(true)}
          className="flex min-h-11 w-full items-center gap-2 rounded-xl px-3 py-2 text-left transition-colors hover:bg-[var(--que-bg-muted)]"
        >
          <ToneBadge tone={STATUS_TONE[item.status]}>
            {ACTION_ITEM_STATUS_LABELS[item.status]}
          </ToneBadge>
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--que-text)]">
            {title}
          </span>
          <span className="hidden shrink-0 truncate text-xs text-[var(--que-text-tertiary)] sm:block">
            {summary}
          </span>
          <ChevronDown
            className="size-4 shrink-0 text-[var(--que-text-tertiary)]"
            aria-hidden
          />
        </button>
      ) : (
        <div className="p-3.5">
          {/* 펼침 헤더 — 상태·제목(연필 편집)·접기 */}
          <div className="flex items-center gap-2">
            <ToneBadge tone={STATUS_TONE[item.status]}>
              {ACTION_ITEM_STATUS_LABELS[item.status]}
            </ToneBadge>
            {editingTitle ? (
              <Input
                autoFocus
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    setEditingTitle(false);
                    save();
                  } else if (e.key === "Escape") {
                    e.preventDefault();
                    cancelTitleEdit();
                  }
                }}
                onBlur={() => setEditingTitle(false)}
                aria-label={`${item.title} 제목 수정 입력`}
                className="h-10 min-w-0 flex-1 rounded-lg text-sm font-medium"
              />
            ) : (
              <>
                <p className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--que-text)]">
                  {title}
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  aria-label="제목 수정"
                  className="size-10 shrink-0 rounded-lg p-0 text-[var(--que-text-tertiary)]"
                  disabled={pending}
                  onClick={() => {
                    setTitle(item.title);
                    setEditingTitle(true);
                  }}
                >
                  <Pencil className="size-4" aria-hidden />
                </Button>
              </>
            )}
            <Button
              type="button"
              variant="ghost"
              aria-expanded
              aria-label="접기"
              className="size-10 shrink-0 rounded-lg p-0 text-[var(--que-text-tertiary)]"
              onClick={() => setExpanded(false)}
            >
              <ChevronUp className="size-4" aria-hidden />
            </Button>
          </div>

          <p className="mt-1 text-xs text-[var(--que-text-tertiary)]">
            원문: “{item.sourceText}” — {item.noteName}
            {item.projectName ? ` · ${item.projectName}` : ""}
          </p>

          <div className="mt-2.5 flex flex-col gap-2.5">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <Field>
                <FieldLabel>담당자</FieldLabel>
                <Select
                  items={userItems}
                  value={assigneeId}
                  onValueChange={(v) => setAssigneeId(v ?? "")}
                >
                  <SelectTrigger
                    aria-label={`${item.title} 담당자 선택`}
                    className="!h-10 w-full rounded-lg text-sm"
                  >
                    <SelectValue placeholder="미지정" />
                  </SelectTrigger>
                  <SelectContent>
                    {roster.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel>프로젝트</FieldLabel>
                <Select
                  items={projectItems}
                  value={projectId}
                  onValueChange={handleProjectChange}
                >
                  <SelectTrigger
                    aria-label={`${item.title} 프로젝트 선택`}
                    className="!h-10 w-full rounded-lg text-sm"
                  >
                    <SelectValue placeholder="미지정" />
                  </SelectTrigger>
                  <SelectContent>
                    {allProjects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}
                      </SelectItem>
                    ))}
                    <SelectItem
                      value={NEW_PROJECT}
                      className="font-medium text-[var(--que-brand)]"
                    >
                      <Plus className="size-4" aria-hidden />새 프로젝트
                    </SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel>마감</FieldLabel>
                <DuePicker
                  dueDate={dueDate}
                  dueTime={dueTime}
                  startTime={startTime}
                  onSelectDate={setDueDate}
                  onSelectDueTime={handleDueTime}
                  onSelectStartTime={handleStartTime}
                  onClear={clearDue}
                  triggerAriaLabel={`${item.title} 마감 설정`}
                />
              </Field>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {dirty && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-10 rounded-lg"
                  disabled={pending}
                  onClick={save}
                >
                  저장
                </Button>
              )}
              <span className="ml-auto flex gap-2">
                <Button
                  size="sm"
                  className="h-10 rounded-lg bg-[var(--que-brand)] px-3.5 text-[var(--que-on-brand)] hover:bg-[var(--que-brand-hover)]"
                  disabled={pending}
                  onClick={() =>
                    run(
                      () =>
                        confirmActionItemAction(item.id, {
                          assigneeId: assigneeId || undefined,
                          projectId: projectId || undefined,
                          dueDate: dueDate || undefined,
                          dueTime: dueTime || undefined,
                          startTime: startTime || undefined,
                        }),
                      "Task가 생성되어 캘린더와 담당자 오늘 화면에 표시됩니다.",
                    )
                  }
                >
                  Task 생성
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-10 gap-1.5 rounded-lg"
                  disabled={pending}
                  onClick={() => setSplitOpen(true)}
                >
                  <Split className="size-4" aria-hidden />
                  나누기
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-10 rounded-lg"
                  disabled={pending}
                  onClick={() =>
                    run(
                      () => setActionItemStatusAction({ actionItemId: item.id, to: "held" }),
                      "보류했습니다.",
                    )
                  }
                >
                  보류
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-10 rounded-lg border-[var(--que-error)]/40 text-[var(--que-error)] hover:bg-[var(--que-error-bg)] hover:text-[var(--que-error)]"
                  disabled={pending}
                  onClick={() =>
                    run(
                      () => setActionItemStatusAction({ actionItemId: item.id, to: "ignored" }),
                      "무시했습니다.",
                    )
                  }
                >
                  무시
                </Button>
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 후보 나누기 — 날짜 프리필 후 사람이 확정(확인 카드 원칙). 실행은 core splitActionItem. */}
      <SplitActionDialog
        open={splitOpen}
        onOpenChange={setSplitOpen}
        actionItemId={item.id}
        title={item.title}
        sourceText={item.sourceText}
      />

      {/* 인라인 프로젝트 생성 다이얼로그 — core createProject(전원 허용) 경유 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>새 프로젝트</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <Field>
              <FieldLabel htmlFor={`new-project-name-${item.id}`}>
                이름 <span className="text-[var(--que-error)]">*</span>
              </FieldLabel>
              <Input
                id={`new-project-name-${item.id}`}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void submitNewProject();
                  }
                }}
                placeholder="프로젝트명"
                aria-label="새 프로젝트 이름"
                className="h-10 rounded-lg text-sm"
              />
            </Field>
            <Field>
              <FieldLabel>클라이언트 (선택)</FieldLabel>
              <Select
                items={clientItems}
                value={newClientId || CLIENT_NONE}
                onValueChange={(v) =>
                  setNewClientId(v === CLIENT_NONE ? "" : (v ?? ""))
                }
                disabled={clients.length === 0}
              >
                <SelectTrigger
                  aria-label="클라이언트 선택"
                  className="!h-10 w-full rounded-lg text-sm"
                >
                  <SelectValue placeholder="클라이언트 없음" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={CLIENT_NONE}>클라이언트 없음</SelectItem>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            {createError && (
              <p className="text-xs text-[var(--que-error)]">{createError}</p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              className="h-10 rounded-lg"
              disabled={creating}
              onClick={() => setDialogOpen(false)}
            >
              취소
            </Button>
            <Button
              className="h-10 rounded-lg"
              disabled={creating || !newName.trim()}
              onClick={() => void submitNewProject()}
            >
              {creating ? "만드는 중…" : "만들기"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
