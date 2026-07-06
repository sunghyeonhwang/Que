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
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

/** date("yyyy-MM-dd") + time("HH:mm") → 로컬(KST) ISO. create-schedule-dialog의 toIso와 동일 규약. */
function toIso(date: string, time: string): string {
  return new Date(`${date}T${time}:00`).toISOString();
}

// 프로젝트 미지정 sentinel(base-ui Select는 빈 문자열 값을 다루기 까다로워 명시 값을 쓴다).
const NO_PROJECT = "__no_project__";

const PRIORITY_ITEMS: Record<"high" | "normal" | "low", string> = {
  high: "높음",
  normal: "보통",
  low: "낮음",
};
const PRIORITY_ORDER: ("high" | "normal" | "low")[] = ["high", "normal", "low"];

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
 * 공유한다. onDone은 등록 성공 시 호출되어 모달을 닫는 데 쓴다(인라인은 미지정).
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
  const userItems = Object.fromEntries(roster.map((u) => [u.id, u.name]));
  const { run, pending, startTransition } = useSafeAction();
  const [text, setText] = useState("");
  const [draft, setDraft] = useState<TaskDraft | null>(null);
  const [title, setTitle] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [projectId, setProjectId] = useState(NO_PROJECT);
  const [priority, setPriority] = useState<"high" | "normal" | "low">("normal");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
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

  const projectItems: Record<string, string> = {
    [NO_PROJECT]: "프로젝트 없음",
    ...Object.fromEntries(projects.map((p) => [p.id, p.name])),
  };

  const parse = () => {
    if (!text.trim()) return;
    startTransition(async () => {
      try {
        const result = await parseTaskAction(text);
        setDraft(result);
        setTitle(result.title);
        setAssigneeId(result.assigneeId ?? currentUserId);
        setProjectId(NO_PROJECT);
        setPriority("normal");
        setDate(toLocalDate(result.startAt));
        setStartTime(toLocalTime(result.startAt));
        // 파싱은 종료 시각을 따로 주지 않으면 시작+1h로 채운다 — 그 값을 마감 기본값으로.
        setEndTime(toLocalTime(result.endAt));
      } catch (error) {
        reportError(error, { source: "parse-task" });
        toast.error(UNEXPECTED_ERROR_MESSAGE);
      }
    });
  };

  // 날짜가 있을 때만 시각 검증. 마감은 시작보다 늦어야 한다.
  const effectiveStart = startTime || "09:00";
  const effectiveEnd = endTime || "10:00";
  const timeError = date && effectiveEnd <= effectiveStart ? "마감 시간은 시작 시간보다 늦어야 합니다." : null;

  const register = () => {
    let startAt: string | undefined;
    let endAt: string | undefined;
    if (date) {
      startAt = toIso(date, effectiveStart);
      endAt = toIso(date, effectiveEnd);
    }
    run(
      () =>
        createTaskAction({
          title,
          assigneeId,
          projectId: projectId === NO_PROJECT ? undefined : projectId,
          priority,
          startAt,
          endAt,
        }),
      {
        success: `"${title}" 작업이 등록되어 캘린더와 담당자 오늘 화면에 표시됩니다.`,
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
                if (!pending && title.trim() && !timeError) register();
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
            <div className="grid gap-3 sm:grid-cols-2">
              <Field className="sm:col-span-2">
                <FieldLabel htmlFor="qa-title">작업명</FieldLabel>
                <Input id="qa-title" value={title} onChange={(e) => setTitle(e.target.value)} />
              </Field>
              <Field>
                <FieldLabel>담당자</FieldLabel>
                <Select
                  items={userItems}
                  value={assigneeId}
                  onValueChange={(v) => setAssigneeId(v ?? currentUserId)}
                >
                  <SelectTrigger aria-label="담당자 선택" className="h-10">
                    <SelectValue />
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
                  onValueChange={(v) => setProjectId(v ?? NO_PROJECT)}
                >
                  <SelectTrigger aria-label="프로젝트 선택" className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_PROJECT}>프로젝트 없음</SelectItem>
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel>우선순위</FieldLabel>
                <Select
                  items={PRIORITY_ITEMS}
                  value={priority}
                  onValueChange={(v) => setPriority((v as "high" | "normal" | "low") ?? "normal")}
                >
                  <SelectTrigger aria-label="우선순위 선택" className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITY_ORDER.map((p) => (
                      <SelectItem key={p} value={p}>
                        {PRIORITY_ITEMS[p]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="qa-date">날짜</FieldLabel>
                <Input
                  id="qa-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="qa-start">시작 시간</FieldLabel>
                <Input
                  id="qa-start"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="qa-end">마감 시간</FieldLabel>
                <Input
                  id="qa-end"
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  aria-invalid={timeError ? true : undefined}
                />
                {timeError && <p className="text-xs text-[var(--que-error)]">{timeError}</p>}
              </Field>
            </div>
            <div className="flex items-center gap-2">
              <Button
                className="h-10"
                disabled={pending || !title.trim() || !!timeError}
                onClick={register}
              >
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
