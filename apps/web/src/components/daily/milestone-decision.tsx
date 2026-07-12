"use client";

import { useState } from "react";
import { CalendarClock, Check, TriangleAlert } from "lucide-react";
import { resolveMilestoneAgendaAction } from "@/app/(app)/planning/actions";
import { useSafeAction } from "@/components/app/use-safe-action";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

// 마일스톤 안건 결정 컨트롤 — 회의 진행 모드 ⑶ 마일스톤 안건과 /daily 긴급 결정 카드가 공유한다.
// [유지][연기(날짜 입력)][보류/주의로(사유 입력)] → resolveMilestoneAgendaAction(core 권한 강제).
// 비담당자(canManage=false)에게는 버튼 대신 조회 전용 안내를 보인다(서버가 최종 강제, UI는 노출만 조정).

type Mode = "idle" | "defer" | "hold";

interface MilestoneDecisionProps {
  milestoneId: string;
  canManage: boolean;
  /** 보류 버튼 라벨 — 회의 모드는 "주의로", 긴급 결정은 "보류"(둘 다 riskStatus=주의로 반영). */
  holdLabel?: string;
  /** 결정 반영 후 콜백(호명 다음 사람 이동 등). */
  onResolved?: () => void;
}

export function MilestoneDecision({
  milestoneId,
  canManage,
  holdLabel = "보류",
  onResolved,
}: MilestoneDecisionProps) {
  const { run, pending } = useSafeAction();
  const [mode, setMode] = useState<Mode>("idle");
  const [newDueAt, setNewDueAt] = useState("");
  const [reason, setReason] = useState("");

  if (!canManage) {
    return (
      <p className="text-sm text-[var(--que-text-tertiary)]">
        결정 권한은 담당자·관리자에게 있습니다 (조회 전용).
      </p>
    );
  }

  const resolve = (
    input: Parameters<typeof resolveMilestoneAgendaAction>[0],
    success: string,
  ) => {
    run(() => resolveMilestoneAgendaAction(input), {
      success,
      onSuccess: () => {
        setMode("idle");
        setNewDueAt("");
        setReason("");
        onResolved?.();
      },
    });
  };

  if (mode === "defer") {
    return (
      <div className="flex flex-col gap-2">
        <label className="text-xs font-medium text-[var(--que-text-secondary)]" htmlFor={`due-${milestoneId}`}>
          새 마감일
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            id={`due-${milestoneId}`}
            type="datetime-local"
            className="h-10 w-[13.5rem]"
            value={newDueAt}
            onChange={(e) => setNewDueAt(e.target.value)}
          />
          <Button
            className="h-10"
            disabled={!newDueAt || pending}
            onClick={() => resolve({ milestoneId, decision: "defer", newDueAt }, "마감일을 연기했습니다.")}
          >
            <Check className="size-4" aria-hidden />
            연기 확정
          </Button>
          <Button variant="ghost" className="h-10" disabled={pending} onClick={() => setMode("idle")}>
            취소
          </Button>
        </div>
      </div>
    );
  }

  if (mode === "hold") {
    return (
      <div className="flex flex-col gap-2">
        <label className="text-xs font-medium text-[var(--que-text-secondary)]" htmlFor={`reason-${milestoneId}`}>
          사유 (필수)
        </label>
        <Textarea
          id={`reason-${milestoneId}`}
          rows={2}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="왜 주의/보류인지 적습니다."
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button
            className="h-10"
            disabled={!reason.trim() || pending}
            onClick={() =>
              resolve({ milestoneId, decision: "hold", reason: reason.trim() }, "주의 상태로 표시했습니다.")
            }
          >
            <Check className="size-4" aria-hidden />
            확정
          </Button>
          <Button variant="ghost" className="h-10" disabled={pending} onClick={() => setMode("idle")}>
            취소
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant="outline"
        className="h-10"
        disabled={pending}
        onClick={() => resolve({ milestoneId, decision: "keep" }, "기한을 유지했습니다.")}
      >
        <Check className="size-4" aria-hidden />
        유지
      </Button>
      <Button variant="outline" className="h-10" disabled={pending} onClick={() => setMode("defer")}>
        <CalendarClock className="size-4" aria-hidden />
        연기
      </Button>
      <Button variant="outline" className="h-10" disabled={pending} onClick={() => setMode("hold")}>
        <TriangleAlert className="size-4" aria-hidden />
        {holdLabel}
      </Button>
    </div>
  );
}
