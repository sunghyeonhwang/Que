import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/current-user";
import { getClientOptions } from "@/lib/client-filter";
import { getTodayMilestoneAdjustments, getUnifiedGantt } from "@/lib/projects-data";
import { GanttBoard } from "@/components/gantt/gantt-board";
import { GanttDenied } from "@/components/gantt/gantt-denied";

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
export default async function GanttPage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string; risk?: string; zoom?: string }>;
}) {
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
  const [gantt, adjustments] = await Promise.all([
    getUnifiedGantt(user, now, clientId),
    getTodayMilestoneAdjustments(now),
  ]);

  return (
    <GanttBoard
      gantt={gantt}
      clientOptions={clientOptions}
      selectedClient={clientId ?? "all"}
      adjustments={adjustments}
      initialRisk={params.risk === "1"}
      initialZoom={params.zoom === "quarter" ? "quarter" : "month"}
    />
  );
}
