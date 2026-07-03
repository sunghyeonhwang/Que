"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { type User } from "@que/core";
import { logout } from "@/app/actions";
import { reportError } from "@/lib/report-error";
import { UNEXPECTED_ERROR_MESSAGE } from "./use-safe-action";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { ChevronDown, LogOut } from "lucide-react";

/** 상단바 사용자 메뉴 — 아바타 + 이름/직급 + 로그아웃. */
export function UserSwitcher({ current, rank }: { current: User; rank: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            className="h-12 gap-2.5 rounded-xl px-1.5 sm:pr-2.5 hover:bg-[var(--que-bg-muted)]"
            disabled={pending}
            aria-label={`${current.name} 메뉴`}
          />
        }
      >
        <MemberAvatar user={current} />
        <span className="hidden flex-col text-left leading-tight sm:flex">
          <span className="text-sm font-semibold text-[var(--que-text)]">{current.name}</span>
          <span className="text-xs text-[var(--que-text-tertiary)]">{rank}</span>
        </span>
        <ChevronDown
          className="hidden size-4 text-[var(--que-text-tertiary)] sm:block"
          aria-hidden
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>
            <span className="block text-sm font-semibold text-[var(--que-text)]">
              {current.name}
            </span>
            <span className="block text-xs font-normal text-[var(--que-text-tertiary)]">
              {rank} · {current.role === "admin" ? "관리자" : "팀원"}
            </span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="h-10 gap-2"
            onClick={() =>
              startTransition(async () => {
                try {
                  await logout();
                } catch (error) {
                  reportError(error, { source: "logout" });
                  toast.error(UNEXPECTED_ERROR_MESSAGE);
                }
              })
            }
          >
            <LogOut className="size-4" aria-hidden />
            <span className="flex-1">로그아웃</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function MemberAvatar({ user }: { user: User }) {
  return (
    <Avatar className="size-8">
      <AvatarFallback
        className="text-[11px] font-semibold text-white"
        style={{ backgroundColor: user.avatarColor }}
      >
        {user.name.slice(1)}
      </AvatarFallback>
    </Avatar>
  );
}
