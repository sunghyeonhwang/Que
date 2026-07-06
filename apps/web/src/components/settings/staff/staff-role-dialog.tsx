"use client";

import { useTransition } from "react";
import { ShieldCheck, ShieldMinus } from "lucide-react";
import { toast } from "sonner";
import type { UserRole } from "@que/core";
import { updateStaffRoleAction } from "@/app/(app)/settings/staff/actions";
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
import { reportError } from "@/lib/report-error";
import { UNEXPECTED_ERROR_MESSAGE } from "@/components/app/use-safe-action";

/**
 * 권한(role) 변경 확인 다이얼로그 — member↔admin.
 * 승격(→관리자)은 기본 스타일, 강등(→멤버)은 destructive(빨강). 본인·마지막 활성 관리자 방어는 서버가 최종 강제.
 */
export function StaffRoleDialog({
  user,
  onOpenChange,
}: {
  user: ManagedUser | null;
  onOpenChange: (open: boolean) => void;
}) {
  const [pending, startTransition] = useTransition();

  const open = user !== null;
  const promoting = user?.role === "member"; // member → admin
  const nextRole: UserRole = promoting ? "admin" : "member";

  function submit() {
    if (!user) return;
    startTransition(async () => {
      try {
        const res = await updateStaffRoleAction(user.id, nextRole);
        if (res.ok) {
          toast.success(
            promoting
              ? `${user.name}님을 관리자로 승격했습니다.`
              : `${user.name}님을 멤버로 변경했습니다.`,
          );
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
            {promoting ? (
              <ShieldCheck className="size-5 text-[var(--que-brand)]" aria-hidden />
            ) : (
              <ShieldMinus className="size-5 text-[var(--que-error)]" aria-hidden />
            )}
            {promoting ? "관리자로 승격" : "관리자 권한 회수"}
          </DialogTitle>
          <DialogDescription>
            {promoting
              ? `${user?.name}님에게 관리자 권한을 부여합니다.`
              : `${user?.name}님의 관리자 권한을 회수하고 멤버로 되돌립니다.`}
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-[var(--que-border)] bg-[var(--que-bg-muted)] p-3 text-sm text-[var(--que-text-secondary)]">
          {promoting ? (
            <>
              <p className="font-medium text-[var(--que-text)]">관리자가 되면</p>
              <ul className="mt-1.5 ml-4 list-disc space-y-0.5">
                <li>클라이언트·프로젝트 관리에 접근할 수 있습니다.</li>
                <li>직원 관리(추가·정보 편집·권한 변경)를 할 수 있습니다.</li>
                <li>팀 현황의 관리자 리포트를 볼 수 있습니다.</li>
              </ul>
            </>
          ) : (
            <>
              <p className="font-medium text-[var(--que-text)]">멤버가 되면</p>
              <ul className="mt-1.5 ml-4 list-disc space-y-0.5">
                <li>클라이언트·프로젝트 관리에 접근할 수 없습니다.</li>
                <li>직원 관리 화면을 사용할 수 없습니다.</li>
                <li>관리자 리포트가 숨겨집니다.</li>
              </ul>
            </>
          )}
        </div>

        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" className="h-11" />}>
            취소
          </DialogClose>
          {promoting ? (
            <Button type="button" className="h-11" disabled={pending} onClick={submit}>
              {pending ? "처리 중…" : "관리자로 승격"}
            </Button>
          ) : (
            <Button
              type="button"
              className="h-11 bg-[var(--que-error)] text-white hover:bg-[var(--que-error)]/90"
              disabled={pending}
              onClick={submit}
            >
              {pending ? "처리 중…" : "권한 회수"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
