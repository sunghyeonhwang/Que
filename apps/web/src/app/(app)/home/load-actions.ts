"use server";

import { formatProjectLabel, type TaskStatus } from "@que/core";
import { loadReadOnlyDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import { getClientFilter } from "@/lib/client-filter";
import { OPEN } from "@/lib/home-load";

// 업무 부하 표 재배분 패널 지원 액션 — 특정 팀원의 '열린 작업' 목록을 지연 로드한다.
// 조회 전용(loadReadOnlyDb — sync/persist 미실행). 관리자(role==="admin")만 접근 가능하고,
// 실제 담당자 변경·마감 변경은 기존 core mutation 액션(reassignTaskAction·updateTaskDetailsAction)이
// canEditTask로 다시 강제한다(이 조회는 게이트일 뿐 쓰기 권한을 부여하지 않는다).
// 클라이언트 필터를 존중해 표의 '열린 작업' 수와 목록이 일치하도록 한다.

/** 재배분 시트에 뿌릴 열린 작업 한 건(개인 평가 아님, 배분 조정용). */
export interface MemberOpenTask {
  id: string;
  title: string;
  status: TaskStatus;
  /** 예상 소요 시간(미입력이면 null). */
  estimatedHours: number | null;
  /** 마감 ISO datetime(없으면 null). */
  endAt: string | null;
  projectId: string | null;
  /** 클라이언트 접두 포함 프로젝트 라벨(없으면 null). */
  projectName: string | null;
}

export type MemberOpenTasksResult =
  | { ok: true; tasks: MemberOpenTask[] }
  | { ok: false; error: string };

/** 특정 팀원의 열린 작업 목록. 세션 사용자가 관리자일 때만 반환한다. */
export async function getMemberOpenTasksAction(userId: string): Promise<MemberOpenTasksResult> {
  const user = await getCurrentUser();
  if (user.role !== "admin") return { ok: false, error: "권한이 없습니다." };

  const db = await loadReadOnlyDb();
  const clientId = await getClientFilter();
  const clientTasks = db.tasksForClient(clientId);
  const projectById = new Map(db.projects.map((p) => [p.id, p]));
  const clientById = new Map(db.clients.map((c) => [c.id, c]));
  const projectLabelOf = (projectId?: string): string | null => {
    if (!projectId) return null;
    const p = projectById.get(projectId);
    return p ? formatProjectLabel(p, p.clientId ? clientById.get(p.clientId) : undefined) : null;
  };

  const tasks: MemberOpenTask[] = clientTasks
    .filter((t) => t.assigneeId === userId && OPEN.has(t.status))
    // 마감 임박 → 예상시간 큰 순으로 정렬해 조정이 급한 작업을 위로.
    .sort((a, b) => {
      const ea = a.endAt ? new Date(a.endAt).getTime() : Number.POSITIVE_INFINITY;
      const eb = b.endAt ? new Date(b.endAt).getTime() : Number.POSITIVE_INFINITY;
      if (ea !== eb) return ea - eb;
      return (b.estimatedHours ?? 0) - (a.estimatedHours ?? 0);
    })
    .map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      estimatedHours: t.estimatedHours ?? null,
      endAt: t.endAt ?? null,
      projectId: t.projectId ?? null,
      projectName: projectLabelOf(t.projectId),
    }));

  return { ok: true, tasks };
}
