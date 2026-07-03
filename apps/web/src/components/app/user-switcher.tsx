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
import { ChevronsUpDown, LogOut } from "lucide-react";

/** 로그인한 사용자 메뉴 — 이름/역할 표시 + 로그아웃. (실 인증 전환으로 사용자 전환 기능은 제거됨) */
export function UserSwitcher({ current }: { current: User }) {
  const [pending, startTransition] = useTransition();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            className="h-11 w-full justify-start gap-2 px-2"
            disabled={pending}
            aria-label={`${current.name} 메뉴`}
          />
        }
      >
        <MemberAvatar user={current} />
        <span className="flex-1 truncate text-left text-sm">
          {current.name}
          <span className="block text-xs text-muted-foreground">
            {current.role === "admin" ? "관리자" : "팀원"}
          </span>
        </span>
        <ChevronsUpDown className="size-4 text-muted-foreground" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{current.name}</DropdownMenuLabel>
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
    <Avatar className="size-6">
      <AvatarFallback
        className="text-[10px] font-semibold text-white"
        style={{ backgroundColor: user.avatarColor }}
      >
        {user.name.slice(1)}
      </AvatarFallback>
    </Avatar>
  );
}
