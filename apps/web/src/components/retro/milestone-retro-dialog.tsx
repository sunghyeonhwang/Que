"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import type { RetroCause, RetroCauseDetail } from "@que/core";
import { createMilestoneRetroAction } from "@/app/(app)/planning/actions";
import { useSafeAction } from "@/components/app/use-safe-action";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

// OS-2a 실패 분류 확인 카드(부록 B, 시안 ②). 마일스톤이 기한을 넘겨 종결됐을 때 1분짜리 회고.
// 원인 2택 → 세부 유형 → 한 줄. 담당자 이름을 강조하지 않는다(감시 아님, 프로젝트·마일스톤 단위).
// 세부 유형 라벨은 client에서 쓰려고 로컬 정의(retro-data는 server-only).

/** 원인별 세부 유형 목록(부록 B). 앞쪽 4종은 내부, 뒤쪽 4종은 외부 성향. 기타는 공통. */
const DETAIL_BY_CAUSE: Record<RetroCause, { value: RetroCauseDetail; label: string }[]> = {
  internal: [
    { value: "schedule_mgmt", label: "일정 관리 미흡" },
    { value: "qa_lack", label: "QA 부족" },
    { value: "communication", label: "커뮤니케이션" },
    { value: "approval_missed", label: "승인 누락" },
    { value: "other", label: "기타" },
  ],
  external: [
    { value: "client_direction", label: "클라이언트 방향 전환" },
    { value: "budget_change", label: "예산 변경" },
    { value: "schedule_change", label: "일정 변경" },
    { value: "event_cancelled", label: "행사 취소" },
    { value: "other", label: "기타" },
  ],
};

export function MilestoneRetroDialog({
  open,
  onOpenChange,
  milestoneId,
  milestoneTitle,
  contextLabel,
  managed = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  milestoneId: string;
  milestoneTitle: string;
  /** 프로젝트·기한 등 부연(예: "에픽게임즈 · 결제 개선 · 기한 7/15"). */
  contextLabel?: string;
  /** 대응 프로세스(외부 변경 접수 등)를 탔는가 — 자동 판정 읽기 표시(부록 B). */
  managed?: boolean;
}) {
  const { run, pending } = useSafeAction();
  const [cause, setCause] = useState<RetroCause>("internal");
  const [detail, setDetail] = useState<RetroCauseDetail>("schedule_mgmt");
  const [note, setNote] = useState("");

  const details = DETAIL_BY_CAUSE[cause];

  const reset = () => {
    setCause("internal");
    setDetail("schedule_mgmt");
    setNote("");
  };

  // 원인을 바꾸면 세부 유형을 그 원인의 첫 항목으로 되돌린다(교차 오염 방지).
  const changeCause = (next: RetroCause) => {
    setCause(next);
    setDetail(DETAIL_BY_CAUSE[next][0].value);
  };

  const submit = () => {
    run(
      () =>
        createMilestoneRetroAction({
          milestoneId,
          cause,
          causeDetail: detail,
          note: note.trim() || undefined,
          managed,
        }),
      {
        success: "회고를 저장했습니다.",
        onSuccess: () => {
          reset();
          onOpenChange(false);
        },
      },
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            「{milestoneTitle}」 회고 남기기
          </DialogTitle>
          <DialogDescription>
            기한을 넘겨 종결된 마일스톤의 실패 원인을 1분 안에 분류합니다. 개인 평가가 아니라 팀이
            무엇을 개선할 수 있는지 보기 위한 기록입니다.
          </DialogDescription>
        </DialogHeader>

        {contextLabel ? (
          <p className="-mt-1 text-sm text-[var(--que-text-tertiary)]">{contextLabel}</p>
        ) : null}

        <div className="flex flex-col gap-4">
          {/* 원인 2택 세그먼트 — 외부는 red 계열(시안 ②) */}
          <Field>
            <FieldLabel>원인</FieldLabel>
            <div className="grid grid-cols-2 gap-2">
              <CauseOption
                selected={cause === "internal"}
                tone="neutral"
                title="내부 요인"
                subtitle="우리가 통제 가능"
                onClick={() => changeCause("internal")}
              />
              <CauseOption
                selected={cause === "external"}
                tone="red"
                title="외부 변경"
                subtitle="클라이언트·환경"
                onClick={() => changeCause("external")}
              />
            </div>
          </Field>

          {/* 세부 유형 — 원인에 따라 목록 필터 */}
          <Field>
            <FieldLabel>세부 유형</FieldLabel>
            <Select
              items={Object.fromEntries(details.map((d) => [d.value, d.label]))}
              value={detail}
              onValueChange={(v) => v && setDetail(v as RetroCauseDetail)}
            >
              <SelectTrigger aria-label="세부 유형 선택" size="lg" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {details.map((d) => (
                  <SelectItem key={d.value} value={d.value}>
                    {d.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          {/* 한 줄 메모 */}
          <Field>
            <FieldLabel htmlFor="retro-note">한 줄 메모 (선택)</FieldLabel>
            <Input
              id="retro-note"
              className="h-10"
              maxLength={300}
              placeholder="예: 런칭 범위가 접수 후 2회 변경 — 대응 프로세스로 재협의 완료"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </Field>

          {/* managed 뱃지 — 자동 판정 읽기 표시 */}
          {managed ? (
            <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-[var(--que-success)]/40 px-2.5 py-1 text-xs font-medium text-[var(--que-success)]">
              <Check className="size-3.5" aria-hidden />
              관리된 대응 (변경 접수 프로세스를 탔음)
            </span>
          ) : null}
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" className="h-10" />}>나중에</DialogClose>
          <Button
            className="h-10 bg-[var(--que-brand)] text-[var(--que-on-brand)] hover:bg-[var(--que-brand-hover)]"
            disabled={pending}
            onClick={submit}
          >
            {pending ? "저장 중…" : "회고 저장"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** 원인 세그먼트 옵션 — 선택 시 tone별 강조(외부=red 시안). 터치 44px+. */
function CauseOption({
  selected,
  tone,
  title,
  subtitle,
  onClick,
}: {
  selected: boolean;
  tone: "neutral" | "red";
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "flex min-h-14 flex-col items-center justify-center rounded-lg border px-3 py-2 text-center transition-colors",
        selected
          ? tone === "red"
            ? "border-[var(--que-error)] bg-[var(--que-error-bg)]"
            : "border-[var(--que-brand)] bg-[var(--que-brand-subtle)]"
          : "border-[var(--que-border)] hover:bg-[var(--que-bg-muted)]",
      )}
    >
      <span
        className={cn(
          "text-sm font-semibold",
          selected
            ? tone === "red"
              ? "text-[var(--que-error)]"
              : "text-[var(--que-brand)]"
            : "text-[var(--que-text)]",
        )}
      >
        {title}
      </span>
      <span className="text-xs text-[var(--que-text-tertiary)]">{subtitle}</span>
    </button>
  );
}
