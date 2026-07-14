"use client";

import { useRef, useState } from "react";
import { Pencil } from "lucide-react";
import { RECURRENCE_FREQUENCY_LABELS, WEEKDAY_LABELS } from "@que/core";
import {
  setRecurringTemplateActiveAction,
  updateRecurringTemplateAction,
} from "@/app/(app)/projects/actions";
import { useOptimisticAction } from "@/components/app/use-optimistic-action";
import { useSafeAction } from "@/components/app/use-safe-action";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface TemplateListItem {
  id: string;
  title: string;
  assigneeName: string;
  projectName?: string;
  frequency: "weekly" | "monthly";
  dayOfWeek?: number;
  dayOfMonth?: number;
  startTime: string;
  active: boolean;
  canManage: boolean;
}

export function TemplateList({ templates }: { templates: TemplateListItem[] }) {
  return (
    <div className="flex flex-col gap-2">
      {templates.length === 0 && (
        // 교육형 빈 상태 — '반복 업무 템플릿'이 무엇인지 개념·예시와 함께 안내한다.
        <div className="py-6 text-center">
          <p className="text-sm font-medium text-[var(--que-text)]">
            아직 등록된 반복 업무 템플릿이 없습니다.
          </p>
          <p className="mx-auto mt-1.5 max-w-md text-sm text-[var(--que-text-secondary)]">
            반복 업무 템플릿이란 정기적으로 되풀이되는 작업을 미리 등록해 두는 틀입니다. 예를 들어
            매주 월요일 주간 보고처럼, 한 번 등록하면 때가 될 때마다 회차 작업이 자동으로 생성됩니다.
            매번 직접 만들지 않아도 됩니다.
          </p>
        </div>
      )}
      {templates.map((template) => (
        <TemplateRow key={template.id} template={template} />
      ))}
    </div>
  );
}

function TemplateRow({ template }: { template: TemplateListItem }) {
  // 스위치는 즉시 전환하고 서버는 백그라운드로 커밋 — 실패 시에만 롤백.
  const [active, setActive] = useState(template.active);
  const { run } = useOptimisticAction();

  // 제목 인라인 편집(생성자·관리자만 — 서버 강제). titleCommittedRef로 Enter 후 blur 중복 저장 차단.
  const { run: runTitle, pending: titlePending } = useSafeAction();
  const [title, setTitle] = useState(template.title);
  const [editingTitle, setEditingTitle] = useState(false);
  const titleCommittedRef = useRef(true);

  const beginTitleEdit = () => {
    setTitle(template.title);
    titleCommittedRef.current = false;
    setEditingTitle(true);
  };
  const commitTitle = () => {
    if (titleCommittedRef.current) return;
    titleCommittedRef.current = true;
    setEditingTitle(false);
    const trimmed = title.trim();
    if (!trimmed) {
      setTitle(template.title);
      return;
    }
    if (trimmed === template.title) return;
    runTitle(() => updateRecurringTemplateAction({ templateId: template.id, title: trimmed }), {
      success: "제목을 수정했습니다.",
      onError: () => setTitle(template.title), // 저장 실패 시 표시 원복
    });
  };
  const cancelTitleEdit = () => {
    titleCommittedRef.current = true;
    setTitle(template.title);
    setEditingTitle(false);
  };

  const toggle = () => {
    const next = !active;
    run(() => setRecurringTemplateActiveAction(template.id, next), {
      apply: () => setActive(next),
      rollback: () => setActive(!next),
      success: next ? "템플릿을 켰습니다." : "템플릿을 껐습니다.",
      source: "template-active-toggle",
    });
  };

  const scheduleLabel =
    template.frequency === "weekly"
      ? `매주 ${WEEKDAY_LABELS[template.dayOfWeek ?? 0]}요일 ${template.startTime}`
      : `매월 ${template.dayOfMonth}일 ${template.startTime}`;

  return (
    <div className="flex min-h-12 flex-wrap items-center gap-2 rounded-md border px-3 py-2">
      <div className="min-w-0 flex-1">
        {editingTitle ? (
          <Input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commitTitle();
              } else if (e.key === "Escape") {
                e.preventDefault();
                cancelTitleEdit();
              }
            }}
            onBlur={commitTitle}
            aria-label={`${template.title} 제목 수정 입력`}
            className="h-10 w-full rounded-lg text-sm font-medium"
          />
        ) : (
          <div className="flex items-center gap-1.5">
            <p className="min-w-0 flex-1 truncate text-sm font-medium">{title}</p>
            {template.canManage && (
              <Button
                type="button"
                variant="ghost"
                aria-label="제목 수정"
                className="size-8 shrink-0 rounded-lg p-0 text-[var(--que-text-tertiary)]"
                disabled={titlePending}
                onClick={beginTitleEdit}
              >
                <Pencil className="size-3.5" aria-hidden />
              </Button>
            )}
          </div>
        )}
        <p className="truncate text-xs text-muted-foreground">
          {RECURRENCE_FREQUENCY_LABELS[template.frequency]} · {scheduleLabel} · 담당{" "}
          {template.assigneeName}
          {template.projectName ? ` · ${template.projectName}` : ""}
        </p>
      </div>
      {/* 토글 스위치(사용자 요청 2026-07-11) — 켜짐/끄기 버튼 대신 스위치 + 상태 라벨. */}
      <span className="text-xs text-[var(--que-text-secondary)]">{active ? "켜짐" : "꺼짐"}</span>
      {template.canManage && (
        <button
          type="button"
          role="switch"
          aria-checked={active}
          aria-label={`${template.title} 반복 ${active ? "끄기" : "켜기"}`}
          onClick={toggle}
          className={
            "relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 " +
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--que-brand)] " +
            (active ? "bg-[var(--que-success)]" : "bg-[var(--que-border)]")
          }
        >
          <span
            aria-hidden
            className={
              "absolute top-0.5 size-5 rounded-full bg-white shadow transition-[left] " +
              (active ? "left-[22px]" : "left-0.5")
            }
          />
        </button>
      )}
      {!template.canManage && (
        <p className="w-full text-xs text-muted-foreground">
          프로젝트 담당자·관리자만 수정할 수 있습니다.
        </p>
      )}
    </div>
  );
}
