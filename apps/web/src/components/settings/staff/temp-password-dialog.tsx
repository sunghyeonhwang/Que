"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Copy, KeyRound, TriangleAlert } from "lucide-react";
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

export interface TempPasswordInfo {
  password: string;
  userName: string;
  /** create=신규 직원(온보딩 안내 포함) · reset=비번 재설정. */
  mode: "create" | "reset";
}

/**
 * 임시 비밀번호 1회 표시 다이얼로그 — 직원 추가/비번 재설정 공용.
 * 닫으면 다시 볼 수 없다(어디에도 저장하지 않음). create 모드에선 온보딩 안내를 함께 보여준다.
 */
export function TempPasswordDialog({
  info,
  onClose,
}: {
  info: TempPasswordInfo | null;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (!info) return;
    try {
      await navigator.clipboard.writeText(info.password);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* 클립보드 권한 없으면 직접 복사 */
    }
  }

  const open = info !== null;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setCopied(false);
          onClose();
        }
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="size-5 text-[var(--que-brand)]" aria-hidden />
            {info?.mode === "create" ? "직원이 추가되었습니다" : "임시 비밀번호 발급"}
          </DialogTitle>
          <DialogDescription>
            {info?.userName}님의 임시 비밀번호입니다. 안전한 채널로 본인에게 전달하세요.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-[var(--que-warning)]/40 bg-[var(--que-warning-bg)] p-3">
          <p className="flex items-start gap-1.5 text-sm text-[var(--que-text-secondary)]">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-[var(--que-warning)]" aria-hidden />
            <span>
              <b className="font-semibold text-[var(--que-text)]">이 창을 닫으면 다시 볼 수 없습니다.</b>{" "}
              지금 복사해 두세요.
            </span>
          </p>
          <div className="mt-2 flex items-center gap-2">
            <code className="flex-1 rounded-md border border-[var(--que-border)] bg-[var(--que-bg)] px-3 py-2 font-mono text-sm text-[var(--que-text)]">
              {info?.password}
            </code>
            <Button
              type="button"
              variant="outline"
              className="h-10 shrink-0"
              onClick={copy}
            >
              {copied ? (
                <>
                  <Check className="size-4 text-[var(--que-success)]" aria-hidden /> 복사됨
                </>
              ) : (
                <>
                  <Copy className="size-4" aria-hidden /> 복사
                </>
              )}
            </Button>
          </div>
        </div>

        {info?.mode === "create" && (
          <div className="rounded-lg border border-[var(--que-border)] bg-[var(--que-bg-muted)] p-3 text-sm text-[var(--que-text-secondary)]">
            <p className="font-medium text-[var(--que-text)]">첫 로그인 안내</p>
            <p className="mt-1">
              첫 로그인 시 비밀번호 변경이 강제됩니다. 위 임시 비밀번호로 로그인한 뒤 본인만 아는
              비밀번호로 바꾸도록 안내하세요.
            </p>
            <Link
              href="/help"
              className="mt-1.5 inline-block font-medium text-[var(--que-brand)] hover:underline"
            >
              도움말 · 처음 시작하기
            </Link>
          </div>
        )}

        <DialogFooter>
          <DialogClose render={<Button type="button" className="h-10" />}>
            확인했습니다
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
