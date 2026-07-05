"use client";

import { useState } from "react";
import { AlertTriangle, Pause } from "lucide-react";
import type { StatusDetail } from "@que/core";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StatusDetailForm } from "@/components/app/status-detail-form";
import { cn } from "@/lib/utils";

/** 홀드·문제 컬럼으로 옮길 때 status(on_hold/issue) 택1 + 사유를 받는다.
 *  core assertStatusDetail이 detail을 강제하므로, 취소 시 카드는 이동하지 않는다(원위치 유지). */
export type BlockedStatus = "on_hold" | "issue";

const CHOICES: { value: BlockedStatus; label: string; icon: typeof Pause; tone: string }[] = [
  { value: "on_hold", label: "홀드", icon: Pause, tone: "var(--que-warning)" },
  { value: "issue", label: "문제발생", icon: AlertTriangle, tone: "var(--que-error)" },
];

export function BlockedStatusDialog({
  open,
  onOpenChange,
  taskTitle,
  pending,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskTitle: string;
  pending: boolean;
  onConfirm: (to: BlockedStatus, detail: StatusDetail) => void;
}) {
  const [to, setTo] = useState<BlockedStatus>("on_hold");

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setTo("on_hold");
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>홀드·문제로 이동</DialogTitle>
          <DialogDescription>
            &quot;{taskTitle}&quot;의 상태와 사유를 입력하세요. 사유는 필수입니다.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-2" role="group" aria-label="상태 선택">
          {CHOICES.map((choice) => {
            const Icon = choice.icon;
            const active = to === choice.value;
            return (
              <button
                key={choice.value}
                type="button"
                aria-pressed={active}
                onClick={() => setTo(choice.value)}
                className={cn(
                  "flex h-10 items-center justify-center gap-1.5 rounded-lg border text-sm font-medium transition-colors",
                  active
                    ? "border-[var(--que-brand)] bg-[var(--que-brand-subtle)] text-[var(--que-text)]"
                    : "border-[var(--que-border)] text-[var(--que-text-secondary)] hover:bg-[var(--que-bg-muted)]",
                )}
              >
                <Icon className="size-4" style={{ color: choice.tone }} aria-hidden />
                {choice.label}
              </button>
            );
          })}
        </div>

        <StatusDetailForm
          submitLabel={to === "issue" ? "문제발생으로 이동" : "홀드로 이동"}
          pending={pending}
          onSubmit={(detail) => onConfirm(to, detail)}
        />
      </DialogContent>
    </Dialog>
  );
}
