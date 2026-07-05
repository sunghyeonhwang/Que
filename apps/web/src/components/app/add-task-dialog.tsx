"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { QuickAddForm } from "./quick-add";

/**
 * 전역 "작업 추가" 모달 — 자연어 빠른등록(QuickAddForm)을 Dialog에 담아 어느 페이지에서든 연다.
 * 자연어는 등록 전 확인 카드를 반드시 거친다(도메인 규칙). 상단바 버튼과 홈 FAB가 공유한다.
 * - variant="header": 상단바용 컴팩트 버튼(좁은 폭에서 라벨을 숨겨 아이콘만).
 * - variant="fab": 홈 우하단 플로팅 원형 버튼.
 */
export function AddTaskDialog({
  currentUserId,
  variant = "header",
}: {
  currentUserId: string;
  variant?: "header" | "fab";
}) {
  const [open, setOpen] = useState(false);

  const trigger =
    variant === "fab" ? (
      <DialogTrigger
        render={
          <Button
            aria-label="작업 추가"
            className="size-14 rounded-full bg-[var(--que-brand)] p-0 text-[var(--que-on-brand)] shadow-lg hover:bg-[var(--que-brand-hover)]"
          />
        }
      >
        <Plus className="size-6" aria-hidden />
      </DialogTrigger>
    ) : (
      <DialogTrigger
        render={
          <Button
            aria-label="작업 추가"
            className="h-10 gap-1.5 rounded-lg bg-[var(--que-brand)] px-2.5 font-medium text-[var(--que-on-brand)] hover:bg-[var(--que-brand-hover)] sm:px-3.5"
          />
        }
      >
        <Plus className="size-4" aria-hidden />
        <span className="hidden sm:inline">작업 추가</span>
      </DialogTrigger>
    );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger}
      <DialogContent className="max-h-[calc(100dvh-3rem)] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>새로운 작업을 등록하세요</DialogTitle>
          <DialogDescription>
            자연어로 입력하면 담당자·날짜·시간을 해석합니다. 등록 전 확인 카드에서 내용을 확인하세요.
          </DialogDescription>
        </DialogHeader>
        <QuickAddForm currentUserId={currentUserId} onDone={() => setOpen(false)} autoFocus />
      </DialogContent>
    </Dialog>
  );
}
