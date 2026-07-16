"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { Check, Fingerprint, Pencil, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { deleteMyPasskey, renameMyPasskey } from "@/app/(app)/settings/passkey-actions";
import type { CredentialSummary } from "@/lib/auth/webauthn";
import { registerPasskey, usePasskeySupported } from "@/lib/auth/webauthn-client";
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
 * 설정 > 보안 — 패스키(WebAuthn) 등록·관리 카드.
 * 기기(Touch ID·Face ID·Windows Hello)로 비밀번호 없이 로그인하는 추가 수단. 비밀번호 로그인은 그대로 유지.
 * 목록은 서버 컴포넌트가 초기 로드해 prop으로 내리고, 변경 후 router.refresh()로 갱신한다.
 */
export function PasskeySettings({ passkeys }: { passkeys: CredentialSummary[] }) {
  const router = useRouter();
  const [deviceName, setDeviceName] = useState("");
  const [registering, startRegister] = useTransition();
  // 브라우저 지원 여부 — 일단 지원으로 가정(true)하고, 미지원이면 마운트 후 비활성화한다
  // (미지원 안내가 첫 프레임에 깜빡이지 않게).
  const supported = usePasskeySupported(true);

  function onRegister() {
    startRegister(async () => {
      try {
        const result = await registerPasskey(deviceName.trim() || undefined);
        if (result.status === "ok") {
          toast.success(`패스키 "${result.deviceName}"을(를) 등록했습니다.`);
          setDeviceName("");
          router.refresh();
        } else if (result.status === "disabled") {
          toast.info("이 환경에서는 패스키를 사용할 수 없습니다.");
        } else if (result.status === "error") {
          toast.error(result.message);
        }
        // "cancelled"는 조용히 무시(사용자가 프롬프트를 닫음).
      } catch (error) {
        reportError(error, { source: "webauthn-register" });
        toast.error(UNEXPECTED_ERROR_MESSAGE);
      }
    });
  }

  const disabled = !supported;

  return (
    <section className="rounded-xl border border-[var(--que-border)] bg-[var(--que-bg)] p-5 shadow-[var(--que-shadow-sm)]">
      <h2 className="flex items-center gap-2 text-base font-semibold text-[var(--que-text)]">
        <span className="flex size-8 items-center justify-center rounded-lg bg-[var(--que-brand-subtle)] text-[var(--que-brand)]">
          <Fingerprint className="size-[18px]" aria-hidden />
        </span>
        패스키
      </h2>
      <p className="mt-1.5 text-sm text-[var(--que-text-secondary)]">
        패스키를 등록하면 Touch ID·Face ID·Windows Hello로 비밀번호 없이 로그인합니다. 비밀번호 로그인은
        그대로 유지됩니다.
      </p>

      {/* 등록 폼 */}
      <div className="mt-4 flex flex-wrap items-end gap-2">
        <label className="flex min-w-[200px] flex-1 flex-col gap-1.5 text-sm font-medium text-[var(--que-text)]">
          기기 이름 (선택)
          <input
            value={deviceName}
            onChange={(e) => setDeviceName(e.target.value)}
            maxLength={60}
            disabled={disabled}
            placeholder="예: 내 맥북"
            className="h-11 rounded-lg border border-[var(--que-border-strong)] bg-[var(--que-bg)] px-3 text-sm text-[var(--que-text)] outline-none placeholder:text-[var(--que-placeholder)] focus:border-[var(--que-brand)] focus:ring-2 focus:ring-[var(--que-brand)]/20 disabled:opacity-60"
          />
        </label>
        <Button
          type="button"
          onClick={onRegister}
          disabled={registering || disabled}
          className="h-11"
        >
          <Fingerprint className="size-4" aria-hidden />
          {registering ? "등록 중…" : "패스키 등록"}
        </Button>
      </div>

      {disabled && (
        <p className="mt-2 text-sm text-[var(--que-text-tertiary)]">
          이 브라우저는 패스키를 지원하지 않습니다. 최신 브라우저에서 다시 시도하세요.
        </p>
      )}

      {/* 등록된 패스키 목록 */}
      <div className="mt-4">
        <p className="mb-2 text-sm font-medium text-[var(--que-text)]">등록된 패스키</p>
        {passkeys.length === 0 ? (
          <p className="text-sm text-[var(--que-text-tertiary)]">
            아직 등록한 패스키가 없습니다. 위에서 이 기기를 등록하세요.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {passkeys.map((pk) => (
              <PasskeyRow key={pk.id} passkey={pk} />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function PasskeyRow({ passkey }: { passkey: CredentialSummary }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(passkey.deviceName);
  const [pending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  function saveName() {
    const next = name.trim();
    if (!next || next === passkey.deviceName) {
      setEditing(false);
      setName(passkey.deviceName);
      return;
    }
    startTransition(async () => {
      try {
        const res = await renameMyPasskey(passkey.id, next);
        if (res.ok) {
          toast.success("기기 이름을 변경했습니다.");
          setEditing(false);
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

  function onDelete() {
    startTransition(async () => {
      try {
        const res = await deleteMyPasskey(passkey.id);
        if (res.ok) {
          toast.success("패스키를 삭제했습니다.");
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
        {editing ? (
          <input
            ref={inputRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                saveName();
              } else if (e.key === "Escape") {
                setEditing(false);
                setName(passkey.deviceName);
              }
            }}
            maxLength={60}
            aria-label="기기 이름"
            className="h-9 w-full max-w-[240px] rounded-md border border-[var(--que-border-strong)] bg-[var(--que-bg)] px-2 text-sm text-[var(--que-text)] outline-none focus:border-[var(--que-brand)] focus:ring-2 focus:ring-[var(--que-brand)]/20"
          />
        ) : (
          <p className="truncate text-sm font-medium text-[var(--que-text)]">{passkey.deviceName}</p>
        )}
        <p className="mt-0.5 truncate text-xs text-[var(--que-text-tertiary)]">
          {format(new Date(passkey.createdAt), "yyyy년 M월 d일", { locale: ko })} 등록 ·{" "}
          {passkey.lastUsedAt
            ? `마지막 사용 ${format(new Date(passkey.lastUsedAt), "yyyy년 M월 d일", { locale: ko })}`
            : "사용 전"}
        </p>
      </div>

      {editing ? (
        <div className="flex items-center gap-1">
          <IconButton label="이름 저장" onClick={saveName} disabled={pending}>
            <Check className="size-4" aria-hidden />
          </IconButton>
          <IconButton
            label="편집 취소"
            onClick={() => {
              setEditing(false);
              setName(passkey.deviceName);
            }}
            disabled={pending}
          >
            <X className="size-4" aria-hidden />
          </IconButton>
        </div>
      ) : (
        <div className="flex items-center gap-1">
          <IconButton label="기기 이름 변경" onClick={() => setEditing(true)} disabled={pending}>
            <Pencil className="size-4" aria-hidden />
          </IconButton>
          <IconButton label="패스키 삭제" onClick={() => setConfirmOpen(true)} disabled={pending}>
            <Trash2 className="size-4" aria-hidden />
          </IconButton>
        </div>
      )}

      {/* 삭제 확인 — 파괴적 최종 확인은 Dialog 규약 */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="size-5 text-[var(--que-error)]" aria-hidden />
              패스키를 삭제할까요?
            </DialogTitle>
            <DialogDescription>
              &lsquo;{passkey.deviceName}&rsquo; 패스키를 삭제하면 이 기기로는 더 이상 패스키
              로그인을 할 수 없습니다. 비밀번호 로그인은 그대로 유지됩니다.
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
              {pending ? "삭제 중…" : "삭제"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </li>
  );
}

/** 아이콘 전용 버튼 — 40px 터치 타깃 + aria-label + Tooltip. */
function IconButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            aria-label={label}
            className="flex size-10 items-center justify-center rounded-lg border border-[var(--que-border-strong)] text-[var(--que-text-secondary)] transition-colors hover:bg-[var(--que-bg-muted)] hover:text-[var(--que-text)] disabled:opacity-60"
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
