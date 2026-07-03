"use client";

import { useState } from "react";
import { FolderCog, MessageSquare, MoreVertical, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * 멤버 카드 우상단 ⋮ 메뉴. 모든 항목은 데모 상호작용(toast 안내)일 뿐
 * 실제 사용자/부서 mutation은 하지 않는다(시드·Auth 보호). '멤버 제거'만 확인 Dialog를 거친다.
 */
export function MemberCardMenu({ name }: { name: string }) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              aria-label={`${name} 멤버 메뉴`}
              className="size-10 shrink-0 rounded-lg text-[var(--que-text-tertiary)] hover:bg-[var(--que-bg-muted)]"
            />
          }
        >
          <MoreVertical className="size-4" aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem
            className="h-10 gap-2"
            onClick={() => toast("데모: 확인필요 요청이 전송되었습니다", { description: name })}
          >
            <MessageSquare className="size-4" aria-hidden />
            확인필요 보내기
          </DropdownMenuItem>
          <DropdownMenuItem
            className="h-10 gap-2"
            onClick={() => toast("데모: 부서 변경은 지원되지 않습니다", { description: name })}
          >
            <FolderCog className="size-4" aria-hidden />
            부서 변경
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            className="h-10 gap-2"
            onClick={() => setConfirmOpen(true)}
          >
            <Trash2 className="size-4" aria-hidden />
            멤버 제거
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>멤버 제거</DialogTitle>
            <DialogDescription>
              {name} 님을 팀에서 제거하시겠습니까? 이 작업은 되돌릴 수 없습니다.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" className="h-10" />}>취소</DialogClose>
            <Button
              variant="destructive"
              className="h-10"
              onClick={() => {
                setConfirmOpen(false);
                toast("데모: 실제로 제거되지 않습니다", { description: name });
              }}
            >
              제거
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
