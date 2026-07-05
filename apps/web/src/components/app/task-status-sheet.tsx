"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { toast } from "sonner";
import {
  TASK_STATUS_LABELS,
  type StatusDetail,
  type TaskStatus,
} from "@que/core";
import {
  cancelTaskAction,
  changeTaskStatusAction,
  getAssignableUsersAction,
  getMergeCandidatesAction,
  getTaskStatusDetailAction,
  reassignTaskAction,
  type TaskStatusDetailView,
} from "@/app/(app)/today/actions";
import { moveTaskToDateAction } from "@/app/(app)/calendar/actions";
import { reportError } from "@/lib/report-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel } from "@/components/ui/field";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { StatusBadge } from "./status-badge";
import { StatusDetailForm } from "./status-detail-form";
import { TaskComments, type TaskCommentView } from "./task-comments";
import { UNEXPECTED_ERROR_MESSAGE, useSafeAction } from "./use-safe-action";

/** 상태 변경 버튼 순서 — 기획서 "작업 상세 패널"의 주요 상태 버튼 기준 */
const STATUS_CHOICES: TaskStatus[] = [
  "in_progress",
  "done",
  "needs_reschedule",
  "on_hold",
  "issue",
  "cancelled",
  "merged",
];

const NEEDS_DETAIL: TaskStatus[] = ["issue", "on_hold"];

export interface TaskRowData {
  id: string;
  title: string;
  status: TaskStatus;
  timeText: string;
  metaText?: string;
  /** 일정 변경 폼 프리필용 시작 시각 (ISO) */
  startAt?: string;
  /** 현재 담당자 id — 재배정 Select의 현재 값. 없으면 미배정으로 표시. */
  assigneeId?: string;
  /** 현재 담당자 이름 — 사용자 목록 로딩 전 즉시 표시용 fallback. */
  assigneeName?: string;
  comments?: TaskCommentView[];
  /** 뷰어가 이 작업을 수정할 수 있는가 (본인/프로젝트 담당자/관리자 — 서버가 최종 강제).
   *  false면 상태 변경·일정 변경 UI를 숨기고 댓글만 노출한다. 기본 true. */
  canEdit?: boolean;
}

/** 작업 row 클릭 → 상세 Sheet에서 원터치 상태 변경. 문제발생/홀드는 사유 입력. */
export function TaskStatusSheet({
  task,
  children,
  triggerClassName = "w-full rounded-md text-left focus-visible:outline-2 focus-visible:outline-ring",
}: {
  task: TaskRowData;
  children: React.ReactNode;
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { run, pending, startTransition } = useSafeAction();
  const [detailFor, setDetailFor] = useState<TaskStatus | null>(null);
  const [mergeCandidates, setMergeCandidates] = useState<{ id: string; label: string }[] | null>(
    null,
  );
  const [mergeTargetId, setMergeTargetId] = useState("");
  const [statusDetail, setStatusDetail] = useState<TaskStatusDetailView | null>(null);
  // 재배정 Select용 팀원 목록 — 시트가 열릴 때 지연 조회(병합 후보 lazy 패턴과 공존).
  const [assignableUsers, setAssignableUsers] = useState<{ id: string; name: string }[] | null>(
    null,
  );
  // 재배정 픽커 열림 여부 — 숫자키 상태 변경 가드에 포함한다(Select 포커스 중 오변경 방지).
  const [reassignPickerOpen, setReassignPickerOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  // 문제발생/홀드 작업의 최신 상세(사유·다음액션·도움·재확인)를 열릴 때 지연 조회한다.
  // 액션이 issue/on_hold가 아니면 null을 돌려주므로, 열릴 때마다 조회 결과로만 세팅하면
  // stale도 함께 정리된다(setState는 콜백 안에서만 — effect 본문 동기 setState 금지 규칙).
  useEffect(() => {
    if (!open) return;
    let active = true;
    getTaskStatusDetailAction(task.id).then((d) => {
      if (active) setStatusDetail(d);
    });
    return () => {
      active = false;
    };
  }, [open, task.id, task.status]);

  // 재배정 Select 옵션(팀원 전체)을 열릴 때 지연 조회한다 — 상태상세 lazy와 같은 패턴.
  // 목록 로딩 전에는 Select를 렌더하지 않아 raw id 노출(base-ui items 누락 버그)을 막는다.
  useEffect(() => {
    if (!open) return;
    let active = true;
    getAssignableUsersAction().then((u) => {
      if (active) setAssignableUsers(u);
    });
    return () => {
      active = false;
    };
  }, [open]);

  const change = (to: TaskStatus, detail?: StatusDetail, mergedIntoTaskId?: string) => {
    run(() => changeTaskStatusAction({ taskId: task.id, to, detail, mergedIntoTaskId }), {
      success: `"${task.title}" → ${TASK_STATUS_LABELS[to]}`,
      onSuccess: () => {
        setDetailFor(null);
        setMergeCandidates(null);
        setOpen(false);
      },
    });
  };

  const openMergePicker = () => {
    if (mergeCandidates) {
      setMergeCandidates(null); // 토글 닫기
      return;
    }
    startTransition(async () => {
      setMergeCandidates(await getMergeCandidatesAction(task.id));
      setMergeTargetId("");
    });
  };

  // 담당자 재배정 — Select 값 변경 시 호출. 편집 권한은 서버가 최종 강제한다.
  const reassign = (assigneeId: string) => {
    if (!assigneeId || assigneeId === task.assigneeId || pending) return;
    const name = assignableUsers?.find((u) => u.id === assigneeId)?.name ?? "담당자";
    run(() => reassignTaskAction({ taskId: task.id, assigneeId }), {
      success: `담당자를 ${name}(으)로 변경했습니다.`,
      onSuccess: () => setOpen(false),
    });
  };

  // 작업 삭제 = 취소(soft). cancelTaskAction은 previousStatus를 돌려주므로 useSafeAction
  // (ActionResult 전용) 대신 직접 처리해 실행취소 토스트를 붙인다.
  const deleteTask = () => {
    startTransition(async () => {
      try {
        const res = await cancelTaskAction({ taskId: task.id });
        if (res.ok) {
          setDeleteOpen(false);
          setOpen(false);
          router.refresh();
          toast("작업을 삭제했습니다.", {
            description: `"${task.title}" 은(는) 취소 상태로 보관됩니다.`,
            action: {
              label: "실행 취소",
              onClick: () => {
                // 되돌릴 상태가 issue/on_hold면 detail(사유 등)이 필수다 — 취소 시점에 함께
                // 받은 previousStatusDetail을 실어 보내야 STATUS_DETAIL_REQUIRED로 거부되지 않는다.
                changeTaskStatusAction({
                  taskId: task.id,
                  to: res.previousStatus,
                  detail: res.previousStatusDetail,
                }).then((r) => {
                  if (r.ok) {
                    toast.success("삭제를 되돌렸습니다.");
                    router.refresh();
                  } else {
                    toast.error(r.error);
                  }
                });
              },
            },
          });
        } else {
          toast.error(res.error);
        }
      } catch (error) {
        reportError(error, { source: "server-action" });
        toast.error(UNEXPECTED_ERROR_MESSAGE);
      }
    });
  };

  // 클릭·숫자키가 공유하는 상태 선택 핸들러.
  // issue/on_hold는 사유 폼 토글, merged는 병합 픽커, 그 외는 즉시 변경.
  const chooseStatus = (status: TaskStatus) => {
    if (pending || status === task.status) return;
    if (NEEDS_DETAIL.includes(status)) {
      setDetailFor((current) => (current === status ? null : status));
    } else if (status === "merged") {
      openMergePicker();
    } else {
      change(status);
    }
  };

  // 숫자키 1~7 = 상태 버튼(STATUS_CHOICES 순서). 시트는 Radix 포커스 트랩이라
  // 열리면 포커스가 시트 안에 있다 — 버튼 그리드에 스코프해 여러 시트/배경 충돌을 막는다.
  // 사유 폼 입력 중(input/textarea)·병합 Select 포커스·수정키 동반 시엔 무시한다.
  const onGridKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    // 상세 폼이 열려 사유를 작성 중이거나 병합 픽커·재배정 픽커가 떠 있으면 숫자키를 무시한다
    // (작성 중 사유 유실·오변경 방지 — checkin-panel의 issueOpen 가드와 같은 취지).
    if (detailFor || mergeCandidates || reassignPickerOpen) return;
    const target = e.target as HTMLElement;
    if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) {
      return;
    }
    const idx = Number(e.key) - 1;
    if (!Number.isInteger(idx) || idx < 0 || idx >= STATUS_CHOICES.length) return;
    e.preventDefault();
    chooseStatus(STATUS_CHOICES[idx]);
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setDetailFor(null);
      }}
    >
      <SheetTrigger
        render={
          <button
            type="button"
            className={triggerClassName}
            aria-label={`${task.title} 상세 열기`}
          />
        }
      >
        {children}
      </SheetTrigger>
      <SheetContent side="right" className="w-full max-w-md overflow-y-auto p-5">
        <SheetHeader className="p-0 pb-4 text-left">
          <SheetTitle>{task.title}</SheetTitle>
          <SheetDescription>
            {task.timeText}
            {task.metaText ? ` · ${task.metaText}` : ""}
          </SheetDescription>
        </SheetHeader>

        <div className="mb-4 flex items-center gap-2 text-sm">
          현재 상태 <StatusBadge status={task.status} />
        </div>

        {statusDetail && (
          <div className="mb-4 rounded-md border border-dashed p-3 text-sm">
            <p className="mb-1 font-medium">
              {task.status === "issue" ? "문제 내용" : "대기 사유"}
            </p>
            {statusDetail.reason && (
              <p className="text-muted-foreground">{statusDetail.reason}</p>
            )}
            {(statusDetail.nextAction ||
              statusDetail.helpUserName ||
              statusDetail.nextCheckAt) && (
              <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                {statusDetail.nextAction && (
                  <>
                    <dt className="text-muted-foreground">다음 액션</dt>
                    <dd>{statusDetail.nextAction}</dd>
                  </>
                )}
                {statusDetail.helpUserName && (
                  <>
                    <dt className="text-muted-foreground">도움 요청</dt>
                    <dd>{statusDetail.helpUserName}</dd>
                  </>
                )}
                {statusDetail.nextCheckAt && (
                  <>
                    <dt className="text-muted-foreground">재확인</dt>
                    <dd className="tabular-nums">
                      {format(new Date(statusDetail.nextCheckAt), "M월 d일 HH:mm", {
                        locale: ko,
                      })}
                    </dd>
                  </>
                )}
              </dl>
            )}
          </div>
        )}

        {task.canEdit === false ? (
          <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
            이 작업은 본인, 프로젝트 담당자, 관리자만 수정할 수 있습니다. 아래 댓글로 의견을
            남기거나 도움을 요청해주세요.
          </p>
        ) : (
          <>
            <div
              className="grid grid-cols-3 gap-2"
              role="group"
              aria-label="상태 변경 (숫자키 1–7로 빠르게 선택)"
              onKeyDown={onGridKeyDown}
            >
              {STATUS_CHOICES.map((status, i) => (
                <Button
                  key={status}
                  variant={
                    status === "issue" || status === "cancelled" ? "destructive" : "outline"
                  }
                  className="h-10 justify-start gap-1.5"
                  disabled={pending || status === task.status}
                  onClick={() => chooseStatus(status)}
                >
                  <span
                    aria-hidden
                    className="grid size-4 shrink-0 place-items-center rounded bg-black/5 text-[10px] font-semibold tabular-nums text-muted-foreground dark:bg-white/10"
                  >
                    {i + 1}
                  </span>
                  {TASK_STATUS_LABELS[status]}
                </Button>
              ))}
            </div>

            {detailFor && (
              <div className="mt-4 rounded-md border p-3">
                <StatusDetailForm
                  submitLabel={`${TASK_STATUS_LABELS[detailFor]}(으)로 변경`}
                  pending={pending}
                  onSubmit={(detail) => change(detailFor, detail)}
                />
              </div>
            )}

            {mergeCandidates && (
              <div className="mt-4 flex flex-col gap-2 rounded-md border p-3">
                <p className="text-sm font-medium">어느 작업으로 병합할까요?</p>
                {mergeCandidates.length === 0 ? (
                  <p className="text-xs text-muted-foreground">병합할 수 있는 활성 작업이 없습니다.</p>
                ) : (
                  <>
                    <Select
                      items={Object.fromEntries(mergeCandidates.map((c) => [c.id, c.label]))}
                      value={mergeTargetId}
                      onValueChange={(v) => setMergeTargetId(v ?? "")}
                    >
                      <SelectTrigger aria-label="병합 대상 선택" className="h-10 w-full">
                        <SelectValue placeholder="대상 작업 선택" />
                      </SelectTrigger>
                      <SelectContent>
                        {mergeCandidates.map((candidate) => (
                          <SelectItem key={candidate.id} value={candidate.id}>
                            {candidate.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      className="h-10"
                      disabled={pending || !mergeTargetId}
                      onClick={() => change("merged", undefined, mergeTargetId)}
                    >
                      병합
                    </Button>
                  </>
                )}
              </div>
            )}

            <Separator className="my-5" />
            <div>
              <h3 className="mb-2 text-sm font-medium">담당자</h3>
              <p className="mb-2 text-sm text-muted-foreground">
                현재 담당자{" "}
                <span className="font-medium text-foreground">
                  {assignableUsers?.find((u) => u.id === task.assigneeId)?.name ??
                    task.assigneeName ??
                    (task.assigneeId ? "불러오는 중…" : "미배정")}
                </span>
              </p>
              {assignableUsers ? (
                <Select
                  items={Object.fromEntries(assignableUsers.map((u) => [u.id, u.name]))}
                  value={task.assigneeId ?? ""}
                  onValueChange={(v) => reassign(v ?? "")}
                  onOpenChange={(next) => setReassignPickerOpen(next)}
                >
                  <SelectTrigger aria-label="담당자 변경" className="h-10 w-full">
                    <SelectValue placeholder="담당자 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {assignableUsers.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="h-10 w-full animate-pulse rounded-lg border border-input bg-muted/40" />
              )}
            </div>

            <Separator className="my-5" />
            <ScheduleMoveForm
              taskId={task.id}
              taskTitle={task.title}
              startAt={task.startAt}
              onDone={() => setOpen(false)}
            />

            <Separator className="my-5" />
            <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
              <DialogTrigger
                render={
                  <Button variant="destructive" className="h-11 w-full" disabled={pending} />
                }
              >
                작업 삭제
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>작업을 삭제할까요?</DialogTitle>
                  <DialogDescription>&ldquo;{task.title}&rdquo;</DialogDescription>
                </DialogHeader>
                <p className="text-sm text-muted-foreground">
                  이 작업을 삭제하면 목록에서 사라지고 &lsquo;취소&rsquo; 상태로 보관됩니다. 상태
                  이력과 댓글은 유지되며, 나중에 복구할 수 있습니다.
                </p>
                <DialogFooter>
                  <DialogClose render={<Button variant="outline" className="h-11" />}>
                    취소
                  </DialogClose>
                  <Button
                    variant="destructive"
                    className="h-11"
                    disabled={pending}
                    onClick={deleteTask}
                  >
                    삭제
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        )}

        <Separator className="my-5" />
        <TaskComments taskId={task.id} comments={task.comments ?? []} />
      </SheetContent>
    </Sheet>
  );
}

/** 드래그가 어려운 터치 환경용 날짜/시간 변경 폼 (DESIGN.md 11장). */
function ScheduleMoveForm({
  taskId,
  taskTitle,
  startAt,
  onDone,
}: {
  taskId: string;
  taskTitle: string;
  startAt?: string;
  onDone: () => void;
}) {
  const initial = startAt ? new Date(startAt) : new Date();
  const [date, setDate] = useState(
    `${initial.getFullYear()}-${String(initial.getMonth() + 1).padStart(2, "0")}-${String(initial.getDate()).padStart(2, "0")}`,
  );
  const [time, setTime] = useState(
    `${String(initial.getHours()).padStart(2, "0")}:${String(initial.getMinutes()).padStart(2, "0")}`,
  );
  const { run, pending } = useSafeAction();

  const submit = () => {
    const hour = Number(time.split(":")[0]);
    run(() => moveTaskToDateAction({ taskId, date, hour }), {
      success: `"${taskTitle}" 일정이 변경되어 로그에 기록됐습니다.`,
      onSuccess: onDone,
    });
  };

  return (
    <div>
      <h3 className="mb-2 text-sm font-medium">날짜/시간 변경</h3>
      <div className="grid grid-cols-2 gap-3">
        <Field>
          <FieldLabel htmlFor="move-date">날짜</FieldLabel>
          <Input
            id="move-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="move-time">시작 시간</FieldLabel>
          <Input
            id="move-time"
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
          />
        </Field>
      </div>
      <Button
        variant="secondary"
        className="mt-3 h-10 w-full"
        disabled={pending || !date}
        onClick={submit}
      >
        {pending ? "변경 중…" : "일정 변경"}
      </Button>
    </div>
  );
}
