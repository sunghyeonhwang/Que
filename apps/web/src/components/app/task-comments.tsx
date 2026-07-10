"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { useRoster } from "@/components/app/roster-provider";
import { addTaskCommentAction } from "@/app/(app)/today/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSafeAction } from "./use-safe-action";

export interface TaskCommentView {
  id: string;
  authorName: string;
  body: string;
  /** 도움 요청 대상 전체(다중). 비어 있으면 일반 댓글. */
  helpUserNames?: string[];
  timeText: string;
}

/** 작업 댓글 목록 + 작성 폼. 타인 작업에도 댓글/도움 요청이 가능하다 (기획 권한 모델). */
export function TaskComments({
  taskId,
  comments,
}: {
  taskId: string;
  comments: TaskCommentView[];
}) {
  const roster = useRoster();
  const userById = new Map(roster.map((u) => [u.id, u]));
  const { run, pending } = useSafeAction();
  const [body, setBody] = useState("");
  // 도움 요청 대상 — 다중(최대 10). 드롭다운에서 골라 칩으로 쌓고 X로 제거한다(status-detail-form과 동일 패턴).
  const [helpUserIds, setHelpUserIds] = useState<string[]>([]);
  const remaining = roster.filter((u) => !helpUserIds.includes(u.id));

  const submit = () => {
    run(
      () =>
        addTaskCommentAction({
          taskId,
          body,
          helpUserIds: helpUserIds.length > 0 ? helpUserIds : undefined,
        }),
      {
        success: helpUserIds.length > 0 ? "도움 요청을 남겼습니다." : "댓글을 남겼습니다.",
        onSuccess: () => {
          setBody("");
          setHelpUserIds([]);
        },
      },
    );
  };

  return (
    <div>
      <h3 className="mb-2 text-sm font-medium">댓글 · 도움 요청</h3>
      <div className="flex flex-col gap-2">
        {comments.length === 0 && (
          <p className="text-xs text-muted-foreground">
            아직 댓글이 없습니다. 타인의 작업에는 직접 수정 대신 댓글로 의견을 남겨주세요.
          </p>
        )}
        {comments.map((comment) => (
          <div key={comment.id} className="rounded-md border p-2">
            <p className="text-xs text-muted-foreground">
              {comment.authorName} · {comment.timeText}
              {comment.helpUserNames && comment.helpUserNames.length > 0 && (
                <Badge variant="outline" className="ml-2">
                  도움 요청 → {comment.helpUserNames.join(", ")}
                </Badge>
              )}
            </p>
            <p className="mt-1 text-sm whitespace-pre-wrap">{comment.body}</p>
          </div>
        ))}
      </div>

      <div className="mt-3 flex flex-col gap-2">
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={2}
          placeholder="댓글을 입력하세요"
          aria-label="댓글 입력"
        />
        {helpUserIds.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {helpUserIds.map((id) => {
              const user = userById.get(id);
              if (!user) return null;
              return (
                <span
                  key={id}
                  className="flex items-center gap-1 rounded-full bg-muted py-1 pr-1 pl-2.5 text-sm"
                >
                  {user.name}
                  <button
                    type="button"
                    aria-label={`${user.name} 제거`}
                    onClick={() => setHelpUserIds((prev) => prev.filter((x) => x !== id))}
                    className="grid size-5 place-items-center rounded-full hover:bg-border"
                  >
                    <X className="size-3.5" aria-hidden />
                  </button>
                </span>
              );
            })}
          </div>
        )}
        <div className="flex items-center gap-2">
          <Select
            items={Object.fromEntries(remaining.map((u) => [u.id, u.name]))}
            value=""
            onValueChange={(v) => {
              if (v) setHelpUserIds((prev) => (prev.length >= 10 ? prev : [...prev, v as string]));
            }}
            disabled={remaining.length === 0}
          >
            <SelectTrigger aria-label="도움 요청 대상 추가" className="h-10 flex-1">
              <SelectValue
                placeholder={remaining.length === 0 ? "모두 추가됨" : "도움 요청 추가"}
              />
            </SelectTrigger>
            <SelectContent>
              {remaining.map((user) => (
                <SelectItem key={user.id} value={user.id}>
                  {user.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button className="h-10" disabled={pending || !body.trim()} onClick={submit}>
            남기기
          </Button>
        </div>
      </div>
    </div>
  );
}
