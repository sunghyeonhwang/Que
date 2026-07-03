"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/current-user";
import {
  createGroup,
  createTask,
  deleteTask,
  moveTask,
  setTaskDone,
  updateTask,
  type PmPriority,
} from "@/lib/pm-data";
import type { ActionResult } from "@/app/(app)/today/actions";

// /projects 편집용 서버 액션. mock in-place 변경 후 revalidatePath("/projects").
// 인증 게이트만 두고 권한 세분화는 없다(본 화면은 팀 공용 편집 화면).
// recurring-template 액션(projects/actions.ts)과는 별개 파일이다.

/**
 * 입력 검증 거부 전용 에러. run()이 이것만 { ok:false } 로 변환하고,
 * 그 외(예: getCurrentUser의 NEXT_REDIRECT, 예상 밖 예외)는 그대로 rethrow해
 * 리다이렉트가 전파되고 use-safe-action의 reportError 경로가 살아 있게 한다.
 * (today/actions.ts의 "getCurrentUser는 try 밖 · catch는 규칙 에러만" 패턴과 동일 취지.)
 */
class PmInputError extends Error {}

/** mutation 실행 → revalidate. 입력 거부만 error 문자열로 변환, 나머지는 전파. */
async function run(fn: () => void): Promise<ActionResult> {
  // 출시 강등(HANDOFF 51): PM 모델이 비영속 in-memory mock이라 프로덕션 쓰기를 차단한다.
  // 저장돼도 서버 재시작/다중 인스턴스에서 소실되므로 실 데이터 입력을 막는다.
  // dev 데모에서만 QUE_PM_WRITE=1로 실제 mutation 허용. (getCurrentUser는 각 액션에서 이미
  // 호출돼 미인증은 이 지점 전에 /login으로 redirect된다 — 회귀 없음.)
  if (process.env.QUE_PM_WRITE !== "1") {
    return { ok: false, error: "미리보기 모드입니다 — 프로젝트 화면은 아직 저장되지 않습니다." };
  }
  try {
    fn();
    revalidatePath("/projects");
    return { ok: true };
  } catch (error) {
    if (error instanceof PmInputError) return { ok: false, error: error.message };
    throw error; // NEXT_REDIRECT(미인증) · 예상 밖 예외는 삼키지 않는다
  }
}

export async function createTaskAction(input: {
  groupId: string;
  name: string;
  description?: string;
  dueAt?: string | null;
  priority?: PmPriority;
  assigneeIds?: string[];
}): Promise<ActionResult> {
  await getCurrentUser(); // 미인증이면 /login redirect (try 밖 — 전파되어야 함)
  return run(() => {
    const name = input.name.trim();
    if (!name) throw new PmInputError("작업 이름을 입력하세요.");
    if (!input.groupId) throw new PmInputError("그룹을 선택하세요.");
    createTask({ ...input, name });
  });
}

export async function updateTaskAction(
  id: string,
  patch: Partial<{
    name: string;
    description: string;
    dueAt: string | null;
    priority: PmPriority;
    assigneeIds: string[];
    groupId: string;
  }>,
): Promise<ActionResult> {
  await getCurrentUser();
  return run(() => {
    if (!id) throw new PmInputError("대상 작업이 없습니다.");
    if (patch.name !== undefined && !patch.name.trim()) {
      throw new PmInputError("작업 이름은 비울 수 없습니다.");
    }
    const normalized = patch.name !== undefined ? { ...patch, name: patch.name.trim() } : patch;
    const result = updateTask(id, normalized);
    if (!result) throw new PmInputError("작업을 찾을 수 없습니다.");
  });
}

export async function deleteTaskAction(id: string): Promise<ActionResult> {
  await getCurrentUser();
  return run(() => {
    if (!id) throw new PmInputError("대상 작업이 없습니다.");
    if (!deleteTask(id)) throw new PmInputError("작업을 찾을 수 없습니다.");
  });
}

export async function toggleTaskDoneAction(id: string, done: boolean): Promise<ActionResult> {
  await getCurrentUser();
  return run(() => {
    if (!id) throw new PmInputError("대상 작업이 없습니다.");
    if (!setTaskDone(id, done)) throw new PmInputError("작업을 찾을 수 없습니다.");
  });
}

export async function moveTaskAction(
  id: string,
  toGroupId: string,
  toIndex?: number,
): Promise<ActionResult> {
  await getCurrentUser();
  return run(() => {
    if (!id) throw new PmInputError("대상 작업이 없습니다.");
    if (!toGroupId) throw new PmInputError("이동할 그룹을 선택하세요.");
    // 정수가 아닌 toIndex(크래프트 입력)는 '끝에 추가'로 취급
    const index = Number.isInteger(toIndex) ? toIndex : undefined;
    if (!moveTask(id, toGroupId, index)) throw new PmInputError("작업을 찾을 수 없습니다.");
  });
}

export async function createGroupAction(input: {
  projectId: string;
  name: string;
  color?: string;
}): Promise<ActionResult> {
  await getCurrentUser();
  return run(() => {
    const name = input.name.trim();
    if (!name) throw new PmInputError("그룹 이름을 입력하세요.");
    if (!input.projectId) throw new PmInputError("프로젝트가 없습니다.");
    createGroup({ ...input, name });
  });
}
