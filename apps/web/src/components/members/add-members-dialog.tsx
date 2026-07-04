"use client";

import { useState } from "react";
import { Copy, Link2, Plus } from "lucide-react";
import { toast } from "sonner";
import type { TeamMemberCard } from "@/lib/members-data";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const SHARE_LINK = "QUE.com/project/team-invite";

/**
 * 새 멤버 초대 Dialog(데모). 실제 계정 생성/초대 발송은 하지 않고 toast 안내만 한다.
 * '접근 권한 있는 사람' 목록은 현재 팀원(비-PII)을 그대로 보여준다.
 */
export function AddMembersDialog({ members }: { members: TeamMemberCard[] }) {
  const [access, setAccess] = useState("view");

  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button className="h-10 gap-1.5 bg-[var(--que-brand)] text-[var(--que-on-brand)] hover:bg-[var(--que-brand-hover)]" />
        }
      >
        <Plus className="size-4" aria-hidden />새 멤버
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>새 멤버</DialogTitle>
          <DialogDescription>새 멤버를 워크스페이스에 초대하세요.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Input
            placeholder="이메일 또는 사람 추가"
            aria-label="이메일 또는 사람 추가"
            className="h-10 flex-1"
          />
          <Select value={access} onValueChange={(v) => setAccess(v as string)}>
            <SelectTrigger aria-label="접근 권한" className="h-10 min-h-10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="view">보기 가능</SelectItem>
              <SelectItem value="edit">편집 가능</SelectItem>
            </SelectContent>
          </Select>
          <Button
            className="h-10 bg-[var(--que-brand)] text-[var(--que-on-brand)] hover:bg-[var(--que-brand-hover)]"
            onClick={() => toast("데모: 초대가 전송되었습니다")}
          >
            초대 보내기
          </Button>
        </div>

        <div>
          <p className="mb-2 text-xs font-medium text-[var(--que-text-secondary)]">
            접근 권한 있는 사람
          </p>
          <div className="max-h-56 space-y-1 overflow-y-auto">
            {members.map((m) => (
              <div key={m.id} className="flex items-center gap-3 rounded-lg px-1 py-1.5">
                <Avatar className="shrink-0">
                  <AvatarFallback
                    style={{ backgroundColor: m.avatarColor }}
                    className="text-xs font-medium text-white"
                  >
                    {m.name.slice(0, 1)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-[var(--que-text)]">{m.name}</p>
                  <p className="truncate text-xs text-[var(--que-text-tertiary)]">{m.email}</p>
                </div>
                <span className="shrink-0 text-xs text-[var(--que-text-tertiary)]">편집 가능</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 rounded-lg border border-[var(--que-border)] bg-[var(--que-bg-muted)] p-2">
          <Link2 className="size-4 shrink-0 text-[var(--que-text-tertiary)]" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs text-[var(--que-text-secondary)]">
              이 링크를 공유하여 멤버를 직접 초대하세요.
            </p>
            <p className="truncate text-xs font-medium text-[var(--que-brand)]">{SHARE_LINK}</p>
          </div>
          <Button
            variant="outline"
            className="h-10 shrink-0 gap-1.5"
            onClick={() => {
              void navigator.clipboard?.writeText(SHARE_LINK);
              toast("링크를 복사했습니다");
            }}
          >
            <Copy className="size-3.5" aria-hidden />
            복사
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
