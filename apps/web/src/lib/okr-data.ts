import type { KeyResult, Objective, User } from "@que/core";
import { keyResultProgress } from "@que/core";
import { getDb } from "./db";

// OKR 탭(기획 §4)용 데이터 조합. 회사 레벨 단일 계층이라 클라이언트 필터와 무관하게 전사를 본다.
// 진척은 저장하지 않고 keyResultProgress 단일 계산기로 파생한다(manual=수치, task_auto=연결 Task 완료율).
// 권한 플래그(canManage·canEditProgress)는 서버에서 계산해 UI에 내린다 — UI 숨김은 편의일 뿐,
// 실제 강제는 서버 액션·core mutation의 3중 방어가 담당한다.

/** now(KST) 기준 현재 분기 키(YYYY-Qn). */
export function currentPeriodKey(now: Date = new Date()): string {
  const year = now.getFullYear();
  const quarter = Math.floor(now.getMonth() / 3) + 1;
  return `${year}-Q${quarter}`;
}

/** now(KST) 기준 현재 월 키(YYYY-MM). */
export function currentMonthKey(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export interface OkrKeyResultView {
  keyResult: KeyResult;
  /** 진척률 0~100(하이브리드 단일 계산기). */
  progress: number;
  /** 연결 Task 수(취소·병합 제외). */
  linkedTaskCount: number;
  /** 완료 Task 수(취소·병합 제외 · task_auto 표시용). */
  doneTaskCount: number;
  ownerName: string;
  /** 진척 입력 가능(KR 소유자 본인 또는 admin) — manual KR에서만 의미. */
  canEditProgress: boolean;
  /** 상태 체크 토글 가능(KR 소유자 본인 또는 admin) — state KR에서만 의미.
   *  단 requiresAdminConfirm 항목은 admin만(core가 최종 강제, UI는 잠금 표시용으로 isAdmin도 내림). */
  canToggleChecks: boolean;
  /** 뷰어가 admin인지 — requiresAdminConfirm 항목의 잠금 UI 판정용(실제 강제는 core). */
  isAdmin: boolean;
}

export interface OkrObjectiveView {
  objective: Objective;
  ownerName: string;
  keyResults: OkrKeyResultView[];
  /** KR 생성/수정 가능(admin 또는 Objective 소유자). */
  canManage: boolean;
}

export interface OkrData {
  /** 선택된 분기(YYYY-Qn). */
  period: string;
  /** 선택된 월(YYYY-MM) — KR 필터/기본 신규 월. */
  month: string;
  /** 데이터가 존재하는 모든 분기(내림차순). 분기 선택기 소스. */
  periods: string[];
  /** 선택 분기의 Objective 트리(order 오름차순). */
  objectives: OkrObjectiveView[];
  /** Objective 생성 가능(admin). */
  canManageObjectives: boolean;
}

const EXCLUDED = new Set(["cancelled", "merged"]);

/** OKR 탭 데이터. 전사 대상(클라이언트 필터 무관). period 미지정이면 현재 분기. */
export async function getOkrData(
  user: User,
  opts: { period?: string; month?: string } = {},
): Promise<OkrData> {
  const db = await getDb();
  const now = new Date();
  const isAdmin = user.role === "admin";

  // 데이터가 존재하는 분기 목록(내림차순). 없으면 현재 분기를 최소 1개 보장한다.
  const periodsSet = new Set(db.objectives.map((o) => o.period));
  periodsSet.add(currentPeriodKey(now));
  const periods = [...periodsSet].sort((a, b) => b.localeCompare(a));

  const period = opts.period && periods.includes(opts.period) ? opts.period : periods[0];
  const month = opts.month ?? currentMonthKey(now);

  const nameById = new Map(db.users.map((u) => [u.id, u.name] as const));
  const nameOf = (id: string): string => nameById.get(id) ?? id;

  const objectives: OkrObjectiveView[] = db
    .objectivesByPeriod(period)
    .map((objective) => {
      const canManage = isAdmin || objective.ownerId === user.id;
      const keyResults: OkrKeyResultView[] = db
        .keyResultsByObjective(objective.id)
        .map((kr) => {
          const linked = db.tasks.filter(
            (t) => t.keyResultId === kr.id && !EXCLUDED.has(t.status),
          );
          const doneTaskCount = linked.filter((t) => t.status === "done").length;
          return {
            keyResult: kr,
            progress: keyResultProgress(kr, db.tasks),
            linkedTaskCount: linked.length,
            doneTaskCount,
            ownerName: nameOf(kr.ownerId),
            canEditProgress: kr.metricType === "manual" && (isAdmin || kr.ownerId === user.id),
            canToggleChecks: kr.metricType === "state" && (isAdmin || kr.ownerId === user.id),
            isAdmin,
          };
        });
      return { objective, ownerName: nameOf(objective.ownerId), keyResults, canManage };
    });

  return {
    period,
    month,
    periods,
    objectives,
    canManageObjectives: isAdmin,
  };
}
