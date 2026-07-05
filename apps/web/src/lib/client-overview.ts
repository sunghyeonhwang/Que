import { getDb } from "./db";

// 대표 홈 "클라이언트별 현황" 집계 — 조회 전용.
// 거래처(클라이언트) 단위로 소속 활성 프로젝트 수·평균 진행률·막힌 작업 수를 낸다.
// 진행률 정의는 성과(performance-data)의 프로젝트 진행률과 같은 술어(done/전체, merged·cancelled
// 제외)를 써서 화면 간 숫자가 어긋나지 않게 한다. 개인 평가가 아니라 사업 단위 진척·병목 요약이다.

const DONE = new Set(["done"]);
const COUNTED = new Set(["scheduled", "in_progress", "needs_reschedule", "on_hold", "issue", "done"]);

export interface ClientOverviewRow {
  clientId: string;
  clientName: string;
  /** 소속 활성(active) 프로젝트 수 */
  activeProjects: number;
  /** 소속 활성 프로젝트 진행률의 단순 평균(0~100). 프로젝트 없으면 0. */
  avgProgress: number;
  /** 소속 작업 중 문제발생/홀드로 막힌 작업 수 */
  blockedTasks: number;
  /** 소속 작업 중 열려 있는(집계 대상) 작업 수 */
  openTasks: number;
}

export async function getClientOverview(): Promise<ClientOverviewRow[]> {
  const db = await getDb();

  return db.clients
    .filter((c) => c.status === "active")
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((client) => {
      const projects = db.projects.filter(
        (p) => p.status === "active" && p.clientId === client.id,
      );
      const clientTasks = db.tasksForClient(client.id);

      const progresses = projects.map((p) => {
        const tasks = clientTasks.filter(
          (t) => t.projectId === p.id && t.status !== "merged" && t.status !== "cancelled",
        );
        const total = tasks.length;
        const done = tasks.filter((t) => DONE.has(t.status)).length;
        return total === 0 ? 0 : Math.round((done / total) * 100);
      });
      const avgProgress =
        progresses.length === 0
          ? 0
          : Math.round(progresses.reduce((a, b) => a + b, 0) / progresses.length);

      return {
        clientId: client.id,
        clientName: client.name,
        activeProjects: projects.length,
        avgProgress,
        blockedTasks: clientTasks.filter(
          (t) => t.status === "issue" || t.status === "on_hold",
        ).length,
        openTasks: clientTasks.filter((t) => COUNTED.has(t.status) && t.status !== "done").length,
      };
    });
}
