"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { KeyRound, TriangleAlert, UserMinus, UserCheck } from "lucide-react";
import { toast } from "sonner";
import {
  deactivateStaffAction,
  reactivateStaffAction,
  resetStaffPasswordAction,
} from "@/app/(app)/settings/staff/actions";
import type { ManagedUser } from "@/lib/users-admin";
import { Badge } from "@/components/ui/badge";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { reportError } from "@/lib/report-error";
import { UNEXPECTED_ERROR_MESSAGE } from "@/components/app/use-safe-action";
import { cn } from "@/lib/utils";

interface Props {
  users: ManagedUser[];
  currentUserId: string;
  onTempPassword: (info: { password: string; userName: string }) => void;
}

/** 직원 목록 표 — 이름·이메일·직급·부서·역할·상태 + 행 액션(비활성/복구·비번 재설정). */
export function StaffTable({ users, currentUserId, onTempPassword }: Props) {
  const [pending, startTransition] = useTransition();
  // 비활성 확인 대상(destructive 최종 확인은 Dialog).
  const [target, setTarget] = useState<ManagedUser | null>(null);

  function reset(user: ManagedUser) {
    startTransition(async () => {
      try {
        const res = await resetStaffPasswordAction(user.id);
        if (res.ok) onTempPassword({ password: res.tempPassword, userName: user.name });
        else toast.error(res.error);
      } catch (error) {
        reportError(error, { source: "server-action" });
        toast.error(UNEXPECTED_ERROR_MESSAGE);
      }
    });
  }

  function reactivate(user: ManagedUser) {
    startTransition(async () => {
      try {
        const res = await reactivateStaffAction(user.id);
        if (res.ok) toast.success(`${user.name}님을 복구했습니다.`);
        else toast.error(res.error);
      } catch (error) {
        reportError(error, { source: "server-action" });
        toast.error(UNEXPECTED_ERROR_MESSAGE);
      }
    });
  }

  function confirmDeactivate() {
    if (!target) return;
    const user = target;
    startTransition(async () => {
      try {
        const res = await deactivateStaffAction(user.id);
        if (res.ok) {
          toast.success(`${user.name}님을 비활성했습니다.`);
          setTarget(null);
        } else {
          // 서버가 최신 개수로 차단하면 그대로 안내(다이얼로그 유지).
          toast.error(res.error);
        }
      } catch (error) {
        reportError(error, { source: "server-action" });
        toast.error(UNEXPECTED_ERROR_MESSAGE);
      }
    });
  }

  // 다이얼로그 대상의 차단 여부(열린 작업/활성 템플릿) — 스냅샷 개수로 판단, 서버가 최종 강제.
  const blocked = !!target && (target.openTaskCount > 0 || target.activeTemplateCount > 0);

  return (
    <section className="rounded-xl border border-[var(--que-border)] bg-[var(--que-bg)] shadow-[var(--que-shadow-sm)]">
      <div className="max-h-[560px] overflow-auto">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-[var(--que-bg)]">
            <TableRow>
              <TableHead>이름</TableHead>
              <TableHead>이메일</TableHead>
              <TableHead>직급</TableHead>
              <TableHead>부서</TableHead>
              <TableHead>역할</TableHead>
              <TableHead>상태</TableHead>
              <TableHead className="text-right">관리</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => {
              const inactive = !u.active;
              const isSelf = u.id === currentUserId;
              return (
                <TableRow key={u.id} className={cn(inactive && "opacity-55")}>
                  <TableCell className="font-medium text-[var(--que-text)]">
                    <span className="flex items-center gap-2">
                      <span
                        className="size-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: u.avatarColor }}
                        aria-hidden
                      />
                      {u.name}
                      {isSelf && (
                        <span className="text-xs text-[var(--que-text-tertiary)]">(나)</span>
                      )}
                    </span>
                  </TableCell>
                  <TableCell className="text-[var(--que-text-secondary)]">{u.email}</TableCell>
                  <TableCell className="text-[var(--que-text-secondary)]">{u.rank}</TableCell>
                  <TableCell className="text-[var(--que-text-secondary)]">
                    {u.department || "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={u.role === "admin" ? "secondary" : "outline"}>
                      {u.role === "admin" ? "관리자" : "멤버"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {u.active ? (
                      <span className="inline-flex items-center gap-1.5 text-sm text-[var(--que-success)]">
                        <span className="size-1.5 rounded-full bg-[var(--que-success)]" aria-hidden />
                        활성
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-sm text-[var(--que-text-tertiary)]">
                        <span className="size-1.5 rounded-full bg-current" aria-hidden />
                        비활성
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1.5">
                      <Button
                        variant="outline"
                        className="h-10"
                        disabled={pending || inactive}
                        onClick={() => reset(u)}
                      >
                        <KeyRound className="size-4" aria-hidden />
                        비번 재설정
                      </Button>
                      {u.active ? (
                        <Button
                          variant="outline"
                          className="h-10 text-[var(--que-error)]"
                          disabled={pending || isSelf}
                          title={isSelf ? "본인 계정은 비활성할 수 없습니다." : undefined}
                          onClick={() => setTarget(u)}
                        >
                          <UserMinus className="size-4" aria-hidden />
                          비활성
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          className="h-10"
                          disabled={pending}
                          onClick={() => reactivate(u)}
                        >
                          <UserCheck className="size-4" aria-hidden />
                          복구
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <Dialog
        open={target !== null}
        onOpenChange={(next) => {
          if (!next) setTarget(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserMinus className="size-5 text-[var(--que-error)]" aria-hidden />
              직원 비활성
            </DialogTitle>
            <DialogDescription>
              {target?.name}님의 계정을 비활성합니다. 로그인과 조회가 차단되며, 언제든 복구할 수
              있습니다(삭제 아님).
            </DialogDescription>
          </DialogHeader>

          {blocked && target && (
            <div className="rounded-lg border border-[var(--que-warning)]/40 bg-[var(--que-warning-bg)] p-3 text-sm text-[var(--que-text-secondary)]">
              <p className="flex items-start gap-1.5 font-medium text-[var(--que-text)]">
                <TriangleAlert className="mt-0.5 size-4 shrink-0 text-[var(--que-warning)]" aria-hidden />
                먼저 정리해야 비활성할 수 있습니다
              </p>
              <ul className="mt-1.5 ml-6 list-disc space-y-0.5">
                {target.openTaskCount > 0 && <li>열린 작업 {target.openTaskCount}건 — 재배정 필요</li>}
                {target.activeTemplateCount > 0 && (
                  <li>활성 반복 템플릿 {target.activeTemplateCount}건 — 끄기 필요</li>
                )}
              </ul>
              <Link
                href="/today"
                className="mt-2 inline-block font-medium text-[var(--que-brand)] hover:underline"
              >
                작업 목록에서 재배정하기
              </Link>
            </div>
          )}

          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" className="h-10" />}>
              취소
            </DialogClose>
            <Button
              type="button"
              className="h-10 bg-[var(--que-error)] text-white hover:bg-[var(--que-error)]/90"
              disabled={pending || blocked}
              onClick={confirmDeactivate}
            >
              {pending ? "처리 중…" : "비활성"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
