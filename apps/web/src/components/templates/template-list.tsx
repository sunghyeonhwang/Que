"use client";

import { RECURRENCE_FREQUENCY_LABELS, WEEKDAY_LABELS } from "@que/core";
import { setRecurringTemplateActiveAction } from "@/app/(app)/projects/actions";
import { useSafeAction } from "@/components/app/use-safe-action";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

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
      <Badge variant={template.active ? "secondary" : "outline"}>
        {template.active ? "켜짐" : "꺼짐"}
      </Badge>
      {template.canManage && (
        <Button
          variant="outline"
          size="sm"
          className="h-10"
          disabled={pending}
          onClick={toggle}
        >
          {template.active ? "끄기" : "켜기"}
        </Button>
      )}
      {!template.canManage && (
        <p className="w-full text-xs text-muted-foreground">
          프로젝트 담당자·관리자만 수정할 수 있습니다.
        </p>
      )}
    </div>
  );
}
