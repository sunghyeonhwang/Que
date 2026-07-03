"use client";

import { ChevronsUpDown, Check } from "lucide-react";
import type { Workspace } from "@/lib/pm-data";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function WorkspaceMark({ workspace, className }: { workspace: Workspace; className?: string }) {
  return (
    <span
      aria-hidden
      className={
        "flex size-7 shrink-0 items-center justify-center rounded-md text-[11px] font-semibold text-white " +
        (className ?? "")
      }
      style={{ backgroundColor: workspace.color }}
    >
      {workspace.initials}
    </span>
  );
}

/** 워크스페이스 스위처 — 지금은 단일 mock 워크스페이스. 사이드바/모바일 시트 공용. */
export function WorkspaceSwitcher({ workspace }: { workspace: Workspace }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="outline"
            className="h-12 w-full justify-start gap-2.5 rounded-xl border-[var(--que-border)] px-2.5 hover:bg-[var(--que-bg-muted)]"
            aria-label="워크스페이스 전환"
          />
        }
      >
        <WorkspaceMark workspace={workspace} />
        <span className="min-w-0 flex-1 truncate text-left text-sm font-medium text-[var(--que-text)]">
          {workspace.name}
        </span>
        <ChevronsUpDown className="size-4 shrink-0 text-[var(--que-text-tertiary)]" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[204px]">
        {/* Base UI: GroupLabel(=DropdownMenuLabel)은 반드시 Menu.Group(=DropdownMenuGroup)
            안에 있어야 한다. 없으면 클릭 시 MenuGroupContext missing(error #31)로 크래시. */}
        <DropdownMenuGroup>
          <DropdownMenuLabel className="text-xs text-[var(--que-text-tertiary)]">
            워크스페이스
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="h-10 gap-2.5">
            <WorkspaceMark workspace={workspace} />
            <span className="min-w-0 flex-1 truncate text-sm">{workspace.name}</span>
            <Check className="size-4 shrink-0 text-[var(--que-brand)]" aria-hidden />
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
