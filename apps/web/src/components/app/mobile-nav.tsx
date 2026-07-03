"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import type { Workspace } from "@/lib/pm-data";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { SidebarNav } from "./sidebar-nav";
import { WorkspaceSwitcher } from "./workspace-switcher";

/** 태블릿 세로(lg 미만)에서 사이드바를 대체하는 Sheet 내비게이션. */
export function MobileNav({
  workspace,
  badges,
}: {
  workspace: Workspace;
  badges?: Record<string, number>;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button variant="ghost" size="icon" className="size-10" aria-label="메뉴 열기" />
        }
      >
        <Menu className="size-5" aria-hidden />
      </SheetTrigger>
      <SheetContent side="left" className="w-72 gap-4 p-4">
        <SheetHeader className="p-0 text-left">
          <SheetTitle className="text-xs font-medium text-[var(--que-text-tertiary)]">
            워크스페이스
          </SheetTitle>
        </SheetHeader>
        <WorkspaceSwitcher workspace={workspace} />
        <SidebarNav onNavigate={() => setOpen(false)} badges={badges} />
      </SheetContent>
    </Sheet>
  );
}
