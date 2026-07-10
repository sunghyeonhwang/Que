"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { type TaskDraft } from "@que/core";
import { useRoster } from "@/components/app/roster-provider";
import {
  createTaskAction,
  getAssignableProjectsAction,
  parseTaskAction,
} from "@/app/(app)/today/actions";
import { reportError } from "@/lib/report-error";
import { UNEXPECTED_ERROR_MESSAGE, useSafeAction } from "./use-safe-action";
import {
  ASSIGNEE_ME,
  NO_PROJECT,
  TaskFormFields,
  emptyTaskFormValue,
  taskFormErrors,
  taskFormToIso,
  type TaskFormValue,
} from "./task-form-fields";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

function toLocalDate(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function toLocalTime(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** 자연어 빠른 입력 + 확인 카드 (기획: 등록 전 확인 단계를 반드시 둔다).
 *  /today 입력 탭의 인라인 배치용 얇은 래퍼. 실제 흐름은 QuickAddForm에 있다. */
export function QuickAdd({ currentUserId }: { currentUserId: string }) {
  return (
    <div className="mb-4">
      <QuickAddForm currentUserId={currentUserId} />
    </div>
  );
}

/**
 * 자연어 빠른등록 폼(입력 → 해석 → 확인 카드 → 등록). 인라인(/today)과 모달(전역 "작업 추가")이
 * 공유한다. 확인 카드의 필드는 공통 폼(task-form-fields) — 프로젝트·일정 폼과 같은 구성이라
 * 어디서 만들어도 같은 화면이다. onDone은 등록 성공 시 호출되어 모달을 닫는 데 쓴다.
 */
export function QuickAddForm({
  currentUserId,
  onDone,
  autoFocus = false,
}: {
  currentUserId: string;
  onDone?: () => void;
  autoFocus?: boolean;
}) {
  const roster = useRoster();
  const { run, pending, startTransition } = useSafeAction();
  const [text, setText] = useState("");
  const [draft, setDraft] = useState<TaskDraft | null>(null);
  const [value, setValue] = useState<TaskFormValue>(emptyTaskFormValue());
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);

  // 활성 프로젝트를 지연 조회한다(작업 상세 시트와 동일한 core 경유 목록). 실패는 조용히 무시 —
  // 프로젝트는 선택 항목이라 목록이 없어도 등록은 진행된다.
  useEffect(() => {
    let alive = true;
    getAssignableProjectsAction()
      .then((list) => {
        if (alive) setProjects(list);
      })
      .catch((error) => reportError(error, { source: "quick-add-projects" }));
    return () => {
      alive = false;
    };
  }, []);

  const parse = () => {
    if (!text.trim()) return;
    startTransition(async () => {
      try {
        const result = await parseTaskAction(text);
        setDraft(result);
        // 해석 결과 → 공통 폼 프리필. 파싱은 종료 시각을 따로 주지 않으면 시작+1h로 채운다.
        setValue(
          emptyTaskFormValue({
            title: result.title,
            assigneeId: result.assigneeId ?? currentUserId,
            startDate: toLocalDate(result.startAt),
            startTime: toLocalTime(result.startAt),
            dueDate: toLocalDate(result.endAt),
            dueTime: toLocalTime(result.endAt),
          }),
        );
      } catch (error) {
        reportError(error, { source: "parse-task" });
        toast.error(UNEXPECTED_ERROR_MESSAGE);
      }
    });
  };

  const errors = taskFormErrors(value);
  const canSubmit = !errors.title && !errors.range && !pending;

  const register = () => {
    if (!canSubmit) return;
    run(
      () =>
        createTaskAction({
          title: value.title.trim(),
          assigneeId: value.assigneeId === ASSIGNEE_ME ? undefined : value.assigneeId,
          projectId: value.projectId === NO_PROJECT ? undefined : value.projectId,
          priority: value.priority,
          ...taskFormToIso(value),
          description: value.description.trim() || undefined,
        }),
      {
        success: `"${value.title.trim()}" 작업이 등록되어 캘린더와 담당자 오늘 화면에 표시됩니다.`,
        onSuccess: () => {
          setDraft(null);
          setText("");
          onDone?.();
        },
      },
    );
  };

  return (
    <div>
      <div className="flex gap-2">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") parse();
          }}
          placeholder='예: "내일 오후 3시에 황성현씨 상세페이지 QA 넣어줘"'
          aria-label="자연어 작업 입력"
          className="h-10 flex-1"
          autoFocus={autoFocus}
        />
        <Button className="h-10" disabled={pending || !text.trim()} onClick={parse}>
          {pending && !draft ? "해석 중…" : "해석"}
        </Button>
      </div>

      {draft && (
        <Card className="mt-2">
          <CardContent
            className="flex flex-col gap-3 pt-4"
            onKeyDown={(e) => {
              // ⌘↵ 등록 · Esc 취소. 열린 Select/date 피커의 Esc는 Base UI useDismiss가
              // stopPropagation 하므로 여기까지 오지 않는다(피커부터 닫힘).
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault();
                if (canSubmit) register();
              } else if (e.key === "Escape" && !e.nativeEvent.isComposing) {
                // 한글 IME 조합 중 Esc는 조합 취소용 — 카드까지 폐기하지 않는다.
                e.preventDefault();
                setDraft(null);
              }
            }}
          >
            <p className="text-sm font-medium">이렇게 등록할까요?</p>
            {draft.questions.length > 0 && (
              <ul className="flex flex-col gap-1 text-xs text-muted-foreground">
                {draft.questions.map((question) => (
                  <li key={question}>· {question}</li>
                ))}
              </ul>
            )}

            <TaskFormFields
              value={value}
              onChange={setValue}
              members={roster.map((u) => ({ id: u.id, name: u.name }))}
              projects={projects}
              idPrefix="qa"
            />

            <div className="flex items-center gap-2">
              <Button className="h-10" disabled={!canSubmit} onClick={register}>
                등록
              </Button>
              <Button
                variant="outline"
                className="h-10"
                disabled={pending}
                onClick={() => setDraft(null)}
              >
                취소
              </Button>
              <span className="ml-auto hidden text-xs text-muted-foreground sm:inline">
                ⌘↵ 등록 · Esc 취소
              </span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
