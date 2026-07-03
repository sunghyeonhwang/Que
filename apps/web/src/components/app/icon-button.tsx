"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/** icon-only 버튼 공통 — aria-label + Tooltip 필수. 터치 40px 기본. */
export function IconButton({
  label,
  children,
  onClick,
  variant = "ghost",
  className,
}: {
  label: string;
  children: ReactNode;
  onClick?: () => void;
  variant?: "ghost" | "outline";
  className?: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant={variant}
            aria-label={label}
            onClick={onClick}
            className={cn("size-10 rounded-lg", className)}
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
