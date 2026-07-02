import { format } from "date-fns";
import type { TaskComment } from "@que/core";
import type { TaskCommentView } from "@/components/app/task-comments";
import { getDb } from "./db";

/** 작업별 댓글 뷰 — 오늘/팀 현황 등 TaskStatusSheet를 쓰는 화면이 공유한다. */
export function getCommentViewsByTask(): Map<string, TaskCommentView[]> {
  const db = getDb();
  const userById = new Map(db.users.map((u) => [u.id, u]));
  const map = new Map<string, TaskCommentView[]>();
  for (const comment of db.taskComments as TaskComment[]) {
    const list = map.get(comment.taskId) ?? [];
    list.push({
      id: comment.id,
      authorName: userById.get(comment.authorId)?.name ?? comment.authorId,
      body: comment.body,
      helpUserName: comment.helpUserId
        ? userById.get(comment.helpUserId)?.name
        : undefined,
      timeText: format(new Date(comment.createdAt), "M/d HH:mm"),
    });
    map.set(comment.taskId, list);
  }
  return map;
}
