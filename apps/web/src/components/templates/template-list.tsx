"use client";

import { RECURRENCE_FREQUENCY_LABELS, WEEKDAY_LABELS } from "@que/core";
import { setRecurringTemplateActiveAction } from "@/app/(app)/projects/actions";
import { useSafeAction } from "@/components/app/use-safe-action";

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
  const { run, pending } = useSafeAction();

  const toggle = () => {
    run(() => setRecurringTemplateActiveAction(template.id, !template.active), {
      success: template.active ? "템플릿을 껐습니다." : "템플릿을 켰습니다.",
    });
  };

  const scheduleLabel =
    template.frequency === "weekly"
      ? `매주 ${WEEKDAY_LABELS[template.dayOfWeek ?? 0]}요일 ${template.startTime}`
      : `매월 ${template.dayOfMonth}일 ${template.startTime}`;

  return (
    <div className="flex min-h-12 flex-wrap items-center gap-2 rounded-md border px-3 py-2">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{template.title}</p>
        <p className="truncate text-xs text-muted-foreground">
          {RECURRENCE_FREQUENCY_LABELS[template.frequency]} · {scheduleLabel} · 담당{" "}
          {template.assigneeName}
          {template.projectName ? ` · ${template.projectName}` : ""}
        </p>
      </div>
      {/* 토글 스위치(사용자 요청 2026-07-11) — 켜짐/끄기 버튼 대신 스위치 + 상태 라벨. */}
      <span className="text-xs text-[var(--que-text-secondary)]">
        {template.active ? "켜짐" : "꺼짐"}
      </span>
      {template.canManage && (
        <button
          type="button"
          role="switch"
          aria-checked={template.active}
          aria-label={`${template.title} 반복 ${template.active ? "끄기" : "켜기"}`}
          disabled={pending}
          onClick={toggle}
          className={
            "relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 " +
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--que-brand)] " +
            (template.active ? "bg-[var(--que-success)]" : "bg-[var(--que-border)]")
          }
        >
          <span
            aria-hidden
            className={
              "absolute top-0.5 size-5 rounded-full bg-white shadow transition-[left] " +
              (template.active ? "left-[22px]" : "left-0.5")
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
