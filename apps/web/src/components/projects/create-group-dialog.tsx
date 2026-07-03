"use client";

import { useState } from "react";
import { FolderPlus } from "lucide-react";
import { createGroupAction } from "@/app/(app)/projects/pm-actions";
import { useSafeAction } from "@/components/app/use-safe-action";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

/** 그룹(태스크 열) 추가 Dialog. 이름만 받아 createGroupAction 호출(색은 기본값). */
export function CreateGroupDialog({ projectId }: { projectId: string }) {
  const { run, pending } = useSafeAction();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

  const canSubmit = name.trim().length > 0 && !pending;

  const submit = () => {
    if (!canSubmit) return;
    run(() => createGroupAction({ projectId, name: name.trim() }), {
      success: `"${name.trim()}" 그룹을 추가했습니다.`,
      onSuccess: () => {
        setName("");
        setOpen(false);
      },
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setName("");
      }}
    >
      <DialogTrigger
        render={<Button variant="outline" className="h-10 gap-1.5 rounded-lg px-3.5" />}
      >
        <FolderPlus className="size-4" aria-hidden />
        그룹 추가
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>새 그룹</DialogTitle>
          <DialogDescription>작업을 묶을 새 그룹(열)을 추가합니다.</DialogDescription>
        </DialogHeader>

        <Field>
          <FieldLabel htmlFor="cg-name">그룹 이름</FieldLabel>
          <Input
            id="cg-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
            }}
            placeholder="예: 검토 대기"
            className="h-10"
            autoFocus
          />
        </Field>

        <DialogFooter>
          <Button variant="outline" className="h-10" onClick={() => setOpen(false)}>
            취소
          </Button>
          <Button
            className="h-10 bg-[var(--que-brand)] text-white hover:bg-[var(--que-brand-hover)]"
            disabled={!canSubmit}
            onClick={submit}
          >
            {pending ? "추가 중…" : "추가"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
