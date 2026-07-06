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
                  // 세션 정리 성공 → 로그인 화면으로 하드 내비게이션. 소프트 내비(router.push)와 달리
                  // 클라 메모리 상태를 전량 폐기하고, (app) 레이아웃 getCurrentUser·/login auth() 게이트가
                  // 소거된 세션으로 재평가된다(이 앱엔 인증 미들웨어가 없다 — proxy.ts는 view 호스트 라우팅만).
                  window.location.href = "/login";
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
