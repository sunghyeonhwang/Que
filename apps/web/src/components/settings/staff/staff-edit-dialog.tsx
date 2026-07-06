"use client";

import { useState, useTransition } from "react";
import { Info, Pencil, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { RANK_VALUES, type Rank, type UpdateUserProfileInput } from "@que/core";
import { updateStaffProfileAction } from "@/app/(app)/settings/staff/actions";
import type { ManagedUser } from "@/lib/users-admin";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { reportError } from "@/lib/report-error";
import { UNEXPECTED_ERROR_MESSAGE } from "@/components/app/use-safe-action";

const RANK_ITEMS: Record<string, string> = { 대표: "대표", 관리: "관리", 사원: "사원" };

// 직급(rank) → 홈·성과 노출 스코프. gradeForRank 매핑과 의미가 일치해야 한다(대표=전원/관리=대표제외/사원=본인).
const GRADE_SCOPE: Record<Rank, string> = {
  대표: "홈 대시보드와 성과 화면에서 팀 전원의 현황을 봅니다.",
  관리: "홈 대시보드와 성과 화면에서 대표를 제외한 팀 전원의 현황을 봅니다.",
  사원: "홈 대시보드와 성과 화면에서 본인 현황만 봅니다.",
};

type Errors = Partial<Record<"email", string>>;

/**
 * 직원 프로필 편집 다이얼로그 — 관리자 전용. 이메일·직급·부서만 편집(이름 편집 없음).
 * 직급 변경은 grade(홈·성과 노출 스코프)에 즉시 영향 → 안내 문구를 강조한다.
 * 저장 시 바뀐 필드만 서버로 보낸다(부분 편집). email 유니크·대표 단일성은 서버가 최종 강제.
 */
export function StaffEditDialog({
  user,
  onOpenChange,
}: {
  user: ManagedUser | null;
  onOpenChange: (open: boolean) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [rank, setRank] = useState<Rank>("사원");
  const [department, setDepartment] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  // 대상이 바뀔 때(다이얼로그 열림) 폼을 대상 값으로 초기화한다 — 렌더 중 상태 리셋(React 권장 패턴).
  const [syncedId, setSyncedId] = useState<string | null>(null);

  if (user && user.id !== syncedId) {
    setSyncedId(user.id);
    setEmail(user.email);
    setRank((RANK_VALUES as readonly string[]).includes(user.rank) ? (user.rank as Rank) : "사원");
    setDepartment(user.department);
    setErrors({});
  } else if (!user && syncedId !== null) {
    // 닫히면 다음 열림에서 같은 대상이라도 다시 초기화되도록 표식을 비운다.
    setSyncedId(null);
  }

  const open = user !== null;

  // 원본과의 diff — 바뀐 필드만 저장 대상.
  // 원본 rank가 enum 밖 값(예: SQL 직삽입 "부장")이면 폼은 "사원"으로 폴백 초기화된다.
  // 폴백값을 원본과 직접 비교하면 rankChanged가 항상 true가 되어(폼 미변경에도) rank가
  // 조용히 "사원"으로 덮인다 → 원본도 같은 방식으로 정규화한 값과 비교해 오탐을 막는다.
  const originalRank: Rank =
    user && (RANK_VALUES as readonly string[]).includes(user.rank) ? (user.rank as Rank) : "사원";
  const rankOutOfEnum = !!user && !(RANK_VALUES as readonly string[]).includes(user.rank);
  const emailChanged = !!user && email.trim().toLowerCase() !== user.email.trim().toLowerCase();
  const rankChanged = !!user && rank !== originalRank;
  const deptChanged = !!user && department.trim() !== user.department.trim();
  const hasChanges = emailChanged || rankChanged || deptChanged;

  function submit() {
    if (!user || !hasChanges) return;

    const next: Errors = {};
    const trimmedEmail = email.trim().toLowerCase();
    if (emailChanged) {
      if (!trimmedEmail) next.email = "이메일을 입력하세요.";
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail))
        next.email = "올바른 이메일 형식이 아닙니다.";
    }
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    const data: UpdateUserProfileInput = {};
    if (emailChanged) data.email = trimmedEmail;
    if (rankChanged) data.rank = rank;
    if (deptChanged) data.department = department.trim();

    startTransition(async () => {
      try {
        const res = await updateStaffProfileAction(user.id, data);
        if (res.ok) {
          toast.success(`${user.name}님의 정보를 수정했습니다.`);
          onOpenChange(false);
        } else {
          toast.error(res.error);
        }
      } catch (error) {
        reportError(error, { source: "server-action" });
        toast.error(UNEXPECTED_ERROR_MESSAGE);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="size-5 text-[var(--que-brand)]" aria-hidden />
            {user?.name} 정보 편집
          </DialogTitle>
          <DialogDescription>
            이메일·직급·부서를 수정합니다. 이름은 편집할 수 없습니다.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <Field>
            <FieldLabel htmlFor="edit-email">이메일</FieldLabel>
            <Input
              id="edit-email"
              className="h-11"
              type="email"
              value={email}
              aria-invalid={!!errors.email}
              onChange={(e) => setEmail(e.target.value)}
            />
            {errors.email ? (
              <p className="text-xs text-[var(--que-error)]">{errors.email}</p>
            ) : (
              <p className="text-xs text-[var(--que-text-tertiary)]">
                이메일은 로그인 식별자입니다. 변경 후에는 새 이메일로 로그인합니다.
              </p>
            )}
          </Field>

          <Field>
            <FieldLabel>직급</FieldLabel>
            <Select
              items={RANK_ITEMS}
              value={rank}
              onValueChange={(v) => v && setRank(v as Rank)}
            >
              <SelectTrigger aria-label="직급 선택" className="h-11 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RANK_VALUES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div
              className={
                rankChanged
                  ? "rounded-lg border border-[var(--que-warning)]/40 bg-[var(--que-warning-bg)] p-3"
                  : "rounded-lg border border-[var(--que-border)] bg-[var(--que-bg-muted)] p-3"
              }
            >
              <p className="flex items-start gap-1.5 text-xs text-[var(--que-text-secondary)]">
                {rankChanged ? (
                  <TriangleAlert
                    className="mt-0.5 size-4 shrink-0 text-[var(--que-warning)]"
                    aria-hidden
                  />
                ) : (
                  <Info className="mt-0.5 size-4 shrink-0 text-[var(--que-text-tertiary)]" aria-hidden />
                )}
                <span>
                  {rankChanged && (
                    <b className="font-semibold text-[var(--que-text)]">
                      직급을 바꾸면 노출 범위가 즉시 달라집니다.{" "}
                    </b>
                  )}
                  {GRADE_SCOPE[rank]}
                </span>
              </p>
            </div>
            {rankOutOfEnum && (
              <div className="rounded-lg border border-[var(--que-border)] bg-[var(--que-bg-muted)] p-3">
                <p className="flex items-start gap-1.5 text-xs text-[var(--que-text-secondary)]">
                  <Info className="mt-0.5 size-4 shrink-0 text-[var(--que-text-tertiary)]" aria-hidden />
                  <span>
                    현재 직급 &lsquo;{user?.rank}&rsquo;은(는) 표준 값(대표·관리·사원)이 아닙니다.
                    직급을 바꾸지 않으면 그대로 유지됩니다.
                  </span>
                </p>
              </div>
            )}
          </Field>

          <Field>
            <FieldLabel htmlFor="edit-dept">부서</FieldLabel>
            <Input
              id="edit-dept"
              className="h-11"
              placeholder="예: 디자인"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
            />
            <p className="text-xs text-[var(--que-text-tertiary)]">비워 두면 부서 없음으로 저장됩니다.</p>
          </Field>
        </div>

        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" className="h-11" />}>
            취소
          </DialogClose>
          <Button type="button" className="h-11" disabled={pending || !hasChanges} onClick={submit}>
            {pending ? "저장 중…" : "저장"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
