"use client";

import { useState } from "react";
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
  helpUserName?: string;
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
  const userItems = Object.fromEntries(roster.map((u) => [u.id, u.name]));
  const { run, pending } = useSafeAction();
  const [body, setBody] = useState("");
  const [helpUserId, setHelpUserId] = useState("");

  const submit = () => {
    run(
      () =>
        addTaskCommentAction({
          taskId,
          body,
          helpUserId: helpUserId || undefined,
        }),
      {
        success: helpUserId ? "도움 요청을 남겼습니다." : "댓글을 남겼습니다.",
        onSuccess: () => {
          setBody("");
          setHelpUserId("");
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
              {comment.helpUserName && (
                <Badge variant="outline" className="ml-2">
                  도움 요청 → {comment.helpUserName}
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
        <div className="flex items-center gap-2">
          <Select
            items={userItems}
            value={helpUserId}
            onValueChange={(v) => setHelpUserId(v ?? "")}
          >
            <SelectTrigger aria-label="도움 요청 대상 선택" className="h-10 flex-1">
              <SelectValue placeholder="도움 요청 안 함" />
            </SelectTrigger>
            <SelectContent>
              {roster.map((user) => (
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
