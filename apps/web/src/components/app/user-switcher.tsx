"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { USERS, type User } from "@que/core";
import { switchUser } from "@/app/actions";
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
import { ChevronsUpDown, Check } from "lucide-react";

/** mock 로그인 전환기. 권한 없는 MVP 로그인 — 8명 중 한 명으로 전환한다. */
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
            aria-label={`현재 사용자 ${current.name}, 사용자 전환`}
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
          <DropdownMenuLabel>사용자 전환 (mock 로그인)</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {USERS.map((user) => (
            <DropdownMenuItem
              key={user.id}
              className="h-10 gap-2"
              onClick={() =>
                startTransition(async () => {
                  try {
                    await switchUser(user.id);
                  } catch (error) {
                    reportError(error, { source: "switch-user" });
                    toast.error(UNEXPECTED_ERROR_MESSAGE);
                  }
                })
              }
            >
              <MemberAvatar user={user} />
              <span className="flex-1">{user.name}</span>
              {user.id === current.id && <Check className="size-4" aria-hidden />}
            </DropdownMenuItem>
          ))}
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
