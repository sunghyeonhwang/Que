"use client";

import { useState } from "react";
import { Share2, MoreHorizontal, Copy, Link2, Info } from "lucide-react";
import { toast } from "sonner";
import type { ListViewMember } from "@/lib/pm-data";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const SHARE_LINK = "QUE.com/project/team-invite";

/**
 * 프로젝트 헤더 우측 액션(공유 Dialog · 더보기 메뉴).
 * 공유는 접근 멤버 목록 + 링크 복사(데모, 실제 계정 변경 없음).
 * 더보기는 프로젝트 정보 Dialog를 연다(죽은 버튼 방지).
 */
export function ProjectHeaderActions({
  projectName,
  description,
  allMembers,
}: {
  projectName: string;
  description: string;
  allMembers: ListViewMember[];
}) {
  const [shareOpen, setShareOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);

  return (
    <>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="outline"
              aria-label="공유"
              className="size-10 rounded-lg"
              onClick={() => setShareOpen(true)}
            />
          }
        >
          <Share2 className="size-4" aria-hidden />
        </TooltipTrigger>
        <TooltipContent>공유</TooltipContent>
      </Tooltip>

      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="outline" aria-label="더보기" className="size-10 rounded-lg" />}
        >
          <MoreHorizontal className="size-4" aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setInfoOpen(true)}>
            <Info className="size-4" aria-hidden />
            프로젝트 정보
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setShareOpen(true)}>
            <Share2 className="size-4" aria-hidden />
            공유
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* 공유 Dialog */}
      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>프로젝트 공유</DialogTitle>
            <DialogDescription>이 프로젝트에 접근할 수 있는 팀원입니다.</DialogDescription>
          </DialogHeader>

          <div className="max-h-64 space-y-1 overflow-y-auto">
            {allMembers.map((m) => (
              <div key={m.id} className="flex min-h-10 items-center gap-3 rounded-lg px-1">
                <Avatar className="shrink-0">
                  <AvatarFallback
                    style={{ backgroundColor: m.avatarColor }}
                    className="text-xs font-medium text-white"
                  >
                    {m.name.slice(1)}
                  </AvatarFallback>
                </Avatar>
                <p className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--que-text)]">
                  {m.name}
                </p>
                <span className="shrink-0 text-xs text-[var(--que-text-tertiary)]">편집 가능</span>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2 rounded-lg border border-[var(--que-border)] bg-[var(--que-bg-muted)] p-2">
            <Link2 className="size-4 shrink-0 text-[var(--que-text-tertiary)]" aria-hidden />
            <p className="min-w-0 flex-1 truncate text-xs font-medium text-[var(--que-brand)]">
              {SHARE_LINK}
            </p>
            <Button
              variant="outline"
              className="h-10 shrink-0 gap-1.5"
              onClick={() => {
                void navigator.clipboard?.writeText(SHARE_LINK);
                toast("링크를 복사했습니다 (데모)");
              }}
            >
              <Copy className="size-3.5" aria-hidden />
              복사
            </Button>
          </div>
          <p className="text-xs text-[var(--que-text-tertiary)]">
            데모 링크입니다 — 실제 초대·권한 변경은 후속 작업입니다.
          </p>
        </DialogContent>
      </Dialog>

      {/* 프로젝트 정보 Dialog */}
      <Dialog open={infoOpen} onOpenChange={setInfoOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{projectName}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <dl className="flex flex-col gap-2 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-[var(--que-text-secondary)]">멤버</dt>
              <dd className="font-medium text-[var(--que-text)]">{allMembers.length}명</dd>
            </div>
          </dl>
        </DialogContent>
      </Dialog>
    </>
  );
}
