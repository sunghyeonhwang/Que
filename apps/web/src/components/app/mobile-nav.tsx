"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Brand } from "./brand";
import { SidebarNav } from "./sidebar-nav";

/** 태블릿 세로(lg 미만)에서 사이드바를 대체하는 Sheet 내비게이션. */
export function MobileNav({
  badges,
  isAdmin = false,
}: {
  badges?: Record<string, number>;
  isAdmin?: boolean;
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
          <SheetTitle className="sr-only">메뉴</SheetTitle>
          <Brand />
        </SheetHeader>
        <SidebarNav onNavigate={() => setOpen(false)} badges={badges} isAdmin={isAdmin} />
      </SheetContent>
    </Sheet>
  );
}
