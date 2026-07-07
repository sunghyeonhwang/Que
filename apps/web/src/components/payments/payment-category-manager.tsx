"use client";

import { useState } from "react";
import { ArrowUp, ArrowDown, Check, Plus, Settings2 } from "lucide-react";
import type { PaymentCategory } from "@que/core";
import {
  createPaymentCategoryAction,
  reorderPaymentCategoriesAction,
  updatePaymentCategoryAction,
} from "@/app/(app)/payments/actions";
import { useSafeAction } from "@/components/app/use-safe-action";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * 결제 분류(카테고리) 관리 패널 — 관리자 전용.
 * 노출 여부는 서버(page.tsx의 role 판정)가 결정한다. 이 컴포넌트는 관리자에게만 렌더된다.
 * 권한 최종 강제는 core mutation(canManagePaymentCategory)에 있다.
 * 순서는 props(정렬된 전체 목록)에서 직접 읽고, ↑/↓ 버튼으로 orderedIds를 재구성해 저장한다.
 */
export function PaymentCategoryManager({ categories }: { categories: PaymentCategory[] }) {
  const { run, pending } = useSafeAction();
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState("");
  // 인라인 이름 편집 초안 — id별로 저장 전 값을 들고 있다가 성공 시 초기화한다.
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const draftFor = (cat: PaymentCategory) => drafts[cat.id] ?? cat.name;

  const addCategory = () => {
    const name = newName.trim();
    if (!name || pending) return;
    run(() => createPaymentCategoryAction({ name }), {
      success: "분류를 추가했습니다.",
      onSuccess: () => setNewName(""),
    });
  };

  const renameCategory = (cat: PaymentCategory) => {
    const name = draftFor(cat).trim();
    if (!name || name === cat.name || pending) return;
    run(() => updatePaymentCategoryAction({ categoryId: cat.id, name }), {
      success: "분류 이름을 변경했습니다.",
      onSuccess: () =>
        setDrafts((prev) => {
          const next = { ...prev };
          delete next[cat.id];
          return next;
        }),
    });
  };

  const toggleStatus = (cat: PaymentCategory) => {
    if (pending) return;
    const status = cat.status === "active" ? "archived" : "active";
    run(() => updatePaymentCategoryAction({ categoryId: cat.id, status }), {
      success: status === "active" ? "분류를 활성으로 바꿨습니다." : "분류를 보관 처리했습니다.",
    });
  };

  const move = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (pending || target < 0 || target >= categories.length) return;
    const ids = categories.map((c) => c.id);
    [ids[index], ids[target]] = [ids[target], ids[index]];
    run(() => reorderPaymentCategoriesAction({ orderedIds: ids }), {
      success: "분류 순서를 변경했습니다.",
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={<Button variant="outline" className="h-10 gap-1.5 rounded-lg" />}
      >
        <Settings2 className="size-4" aria-hidden />
        분류 관리
      </DialogTrigger>
      <DialogContent className="flex max-h-[85vh] flex-col gap-4 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>결제 분류 관리</DialogTitle>
          <DialogDescription>
            결제 요청 폼에 나타나는 분류를 관리합니다. 보관하면 새 요청에서 선택할 수 없습니다.
          </DialogDescription>
        </DialogHeader>

        {/* 새 분류 추가 */}
        <div className="flex items-center gap-2">
          <Input
            value={newName}
            maxLength={50}
            placeholder="새 분류 이름"
            aria-label="새 분류 이름"
            className="h-10"
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addCategory();
              }
            }}
          />
          <Button
            className="h-10 shrink-0 gap-1.5 rounded-lg bg-[var(--que-brand)] text-[var(--que-on-brand)] hover:bg-[var(--que-brand-hover)]"
            disabled={!newName.trim() || pending}
            onClick={addCategory}
          >
            <Plus className="size-4" aria-hidden />
            추가
          </Button>
        </div>

        {/* 전체 분류 목록 (sortOrder 순) */}
        <div className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1">
          {categories.length === 0 ? (
            <p className="py-6 text-center text-sm text-[var(--que-text-tertiary)]">
              등록된 분류가 없습니다.
            </p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {categories.map((cat, index) => {
                const draft = draftFor(cat);
                const dirty = draft.trim() !== cat.name && draft.trim().length > 0;
                return (
                  <li
                    key={cat.id}
                    className="flex items-center gap-2 rounded-lg border border-[var(--que-border)] bg-[var(--que-bg)] p-2"
                  >
                    {/* 재정렬 버튼 — client-groups의 40px 위/아래 이동 패턴과 통일(터치 40px). */}
                    <div className="flex shrink-0 flex-col gap-1">
                      <Tooltip>
                        <TooltipTrigger
                          render={
                            <Button
                              variant="outline"
                              className="size-10 rounded-lg"
                              aria-label="위로 이동"
                              disabled={index === 0 || pending}
                              onClick={() => move(index, -1)}
                            />
                          }
                        >
                          <ArrowUp className="size-4" aria-hidden />
                        </TooltipTrigger>
                        <TooltipContent>위로</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger
                          render={
                            <Button
                              variant="outline"
                              className="size-10 rounded-lg"
                              aria-label="아래로 이동"
                              disabled={index === categories.length - 1 || pending}
                              onClick={() => move(index, 1)}
                            />
                          }
                        >
                          <ArrowDown className="size-4" aria-hidden />
                        </TooltipTrigger>
                        <TooltipContent>아래로</TooltipContent>
                      </Tooltip>
                    </div>

                    <Input
                      value={draft}
                      maxLength={50}
                      aria-label={`${cat.name} 이름`}
                      className="h-10 min-w-0 flex-1"
                      onChange={(e) =>
                        setDrafts((prev) => ({ ...prev, [cat.id]: e.target.value }))
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          renameCategory(cat);
                        }
                      }}
                    />

                    {dirty ? (
                      <Button
                        variant="outline"
                        aria-label="이름 저장"
                        className="size-10 shrink-0 rounded-lg"
                        disabled={pending}
                        onClick={() => renameCategory(cat)}
                      >
                        <Check className="size-4" aria-hidden />
                      </Button>
                    ) : (
                      <Badge
                        variant="outline"
                        className={
                          cat.status === "active"
                            ? "shrink-0 border-transparent bg-[var(--que-success-bg)] text-[var(--que-success)]"
                            : "shrink-0"
                        }
                      >
                        {cat.status === "active" ? "활성" : "보관"}
                      </Badge>
                    )}

                    <Button
                      variant="outline"
                      className="h-10 shrink-0 rounded-lg"
                      disabled={pending}
                      onClick={() => toggleStatus(cat)}
                    >
                      {cat.status === "active" ? "보관" : "활성화"}
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
