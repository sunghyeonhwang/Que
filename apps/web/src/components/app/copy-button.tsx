"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * 값을 클립보드로 복사하는 작은 icon-only 버튼.
 * - aria-label + Tooltip 필수, 터치 40px 확보(size-10) + 아이콘은 작게(size-3.5).
 * - 복사 성공/실패는 토스트로 안내한다. 인가된 값만 넘겨줄 것(비인가 값은 렌더하지 않음).
 */
export function CopyButton({
  value,
  label,
  className,
}: {
  value: string;
  label: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      if (!navigator.clipboard) throw new Error("clipboard unavailable");
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success("복사했습니다.");
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      toast.error("복사하지 못했습니다.");
    }
  };

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            aria-label={label}
            onClick={copy}
            className={cn(
              "size-10 shrink-0 rounded-lg text-[var(--que-text-tertiary)] hover:text-[var(--que-text)]",
              className,
            )}
          />
        }
      >
        {copied ? (
          <Check className="size-3.5 text-[var(--que-success)]" />
        ) : (
          <Copy className="size-3.5" />
        )}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
