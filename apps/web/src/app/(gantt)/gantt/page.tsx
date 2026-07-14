import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentUser } from "@/lib/current-user";
import { getClientOptions } from "@/lib/client-filter";
import {
  getProjectMeta,
  getTaskDetail,
  getTodayMilestoneAdjustments,
  getUnifiedGantt,
} from "@/lib/projects-data";
import { GanttBoard } from "@/components/gantt/gantt-board";
import { GanttDenied } from "@/components/gantt/gantt-denied";
import { TaskDetailDrawer } from "@/components/projects/task-detail-drawer";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  title: "통합 간트",
};

// 회의용 전 프로젝트 통합 간트(gant.griff.co.kr → 여기로 proxy rewrite).
// 인증: getCurrentUser가 미로그인 시 /login으로 보낸다. 로그인했지만 관리자·대표(role=admin)가
// 아니면 안내 화면(GanttDenied)을 렌더한다 — 회의실 화면 용도라 접근을 관리자·대표로 제한한다.
// searchParams:
// - client=<clientId>|all — 클라이언트 스코프(기본 전체). 서버 재조회가 필요해 URL로 구동.
// - risk=1 — 위험만 보기(클라이언트 필터라 초기값만 서버가 읽고 토글은 클라에서).
// - zoom=quarter|month — 컬럼 폭(초기값만).
// - task=<id> — 작업 상세/편집 드로어(projects와 동일 컴포넌트·데이터 재사용). 회의 화면 이탈 없이
//   화면 내에서 편집한다. 쓰기는 core mutation(canEditTask 등)이 강제 — 우회 없음.
export default async function GanttPage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string; risk?: string; zoom?: string; task?: string }>;
}) {
  // 미로그인이면 로그인 후 이 화면으로 복귀(callbackUrl) — 기본 게이트는 /home으로 보내 회의실
  // 화면에서 로그인하면 간트로 못 돌아오던 문제(글래도스 이월)의 해소.
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/gantt");
  const user = await getCurrentUser();
  if (user.role !== "admin") return <GanttDenied name={user.name} />;

  const params = await searchParams;
  const clientOptions = await getClientOptions();
  const requested = params.client;
  const clientId =
    requested && requested !== "all" && clientOptions.some((c) => c.id === requested)
      ? requested
      : undefined;

  const now = new Date();
  const [gantt, adjustments, taskDetail] = await Promise.all([
    getUnifiedGantt(user, now, clientId),
    getTodayMilestoneAdjustments(now),
    // task 파라미터가 없으면 즉시 null — 부가 로드는 드로어가 열릴 때만.
    getTaskDetail(user, params.task),
  ]);
  // 드로어 담당자 재지정 목록 등에 쓰는 프로젝트 메타는 열린 태스크가 있을 때만 로드한다.
  const meta = taskDetail?.projectId ? await getProjectMeta(taskDetail.projectId) : null;

  return (
    <>
      <GanttBoard
        gantt={gantt}
        clientOptions={clientOptions}
        selectedClient={clientId ?? "all"}
        adjustments={adjustments}
        initialRisk={params.risk === "1"}
        initialZoom={params.zoom === "quarter" ? "quarter" : "month"}
      />
      <TaskDetailDrawer detail={taskDetail} meta={meta} />
    </>
  );
}
