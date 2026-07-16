"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { Fingerprint, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { adminDeletePasskey } from "@/app/(app)/members/[id]/passkey-admin-actions";
import type { CredentialSummary } from "@/lib/auth/webauthn";
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { reportError } from "@/lib/report-error";
import { UNEXPECTED_ERROR_MESSAGE } from "@/components/app/use-safe-action";

/**
 * 관리자 전용 — 팀원 패스키 관리 카드.
 * 대상이 기기를 분실했을 때 관리자가 대신 패스키를 제거해 주는 용도(등록은 본인만 가능).
 * 목록은 서버 컴포넌트가 초기 로드해 prop으로 내리고, 제거 후 router.refresh()로 갱신한다.
 */
export function AdminPasskey({
  targetId,
  targetName,
  passkeys,
}: {
  targetId: string;
  targetName: string;
  passkeys: CredentialSummary[];
}) {
  return (
    <section className="rounded-xl border border-[var(--que-border)] bg-[var(--que-bg)] p-4 shadow-[var(--que-shadow-sm)]">
      <h2 className="flex items-center gap-2 text-base font-semibold text-[var(--que-text)]">
        <span className="flex size-8 items-center justify-center rounded-lg bg-[var(--que-brand-subtle)] text-[var(--que-brand)]">
          <Fingerprint className="size-[18px]" aria-hidden />
        </span>
        패스키 관리
        <span className="rounded-full bg-[var(--que-bg-muted)] px-2 py-0.5 text-xs font-medium text-[var(--que-text-tertiary)]">
          관리자
        </span>
      </h2>
      <p className="mt-1.5 text-sm text-[var(--que-text-secondary)]">
        {targetName}님이 기기를 분실했을 때, 여기서 해당 패스키를 제거해 다른 사람이 그 기기로 로그인하지
        못하게 합니다.
      </p>

      <div className="mt-3">
        {passkeys.length === 0 ? (
          <p className="text-sm text-[var(--que-text-tertiary)]">
            {targetName}님이 등록한 패스키가 없습니다.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {passkeys.map((pk) => (
              <AdminPasskeyRow
                key={pk.id}
                targetId={targetId}
                targetName={targetName}
                passkey={pk}
              />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function AdminPasskeyRow({
  targetId,
  targetName,
  passkey,
}: {
  targetId: string;
  targetName: string;
  passkey: CredentialSummary;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);

  function onDelete() {
    startTransition(async () => {
      try {
        const res = await adminDeletePasskey(targetId, passkey.id);
        if (res.ok) {
          toast.success("패스키를 제거했습니다.");
          setConfirmOpen(false);
          router.refresh();
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
    <li className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--que-border)] px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-[var(--que-text)]">{passkey.deviceName}</p>
        <p className="mt-0.5 truncate text-xs text-[var(--que-text-tertiary)]">
          {format(new Date(passkey.createdAt), "yyyy년 M월 d일", { locale: ko })} 등록 ·{" "}
          {passkey.lastUsedAt
            ? `마지막 사용 ${format(new Date(passkey.lastUsedAt), "yyyy년 M월 d일", { locale: ko })}`
            : "사용 전"}
        </p>
      </div>

      <Tooltip>
        <TooltipTrigger
          render={
            <button
              type="button"
              onClick={() => setConfirmOpen(true)}
              disabled={pending}
              aria-label="패스키 제거"
              className="flex size-10 items-center justify-center rounded-lg border border-[var(--que-border-strong)] text-[var(--que-text-secondary)] transition-colors hover:bg-[var(--que-bg-muted)] hover:text-[var(--que-text)] disabled:opacity-60"
            />
          }
        >
          <Trash2 className="size-4" aria-hidden />
        </TooltipTrigger>
        <TooltipContent>패스키 제거</TooltipContent>
      </Tooltip>

      {/* 제거 확인 — 파괴적 최종 확인은 Dialog 규약 */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="size-5 text-[var(--que-error)]" aria-hidden />
              패스키를 제거할까요?
            </DialogTitle>
            <DialogDescription>
              {targetName}님의 &lsquo;{passkey.deviceName}&rsquo; 패스키를 제거하면 그 기기로는 더 이상
              패스키 로그인을 할 수 없습니다. 비밀번호 로그인은 그대로 유지됩니다.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" className="h-11" />}>
              취소
            </DialogClose>
            <Button
              type="button"
              variant="destructive"
              className="h-11"
              disabled={pending}
              onClick={onDelete}
            >
              {pending ? "제거 중…" : "제거"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </li>
  );
}
