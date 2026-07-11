import "server-only";

import type { MockQueDb, RetroWeekSummary } from "@que/core";
import { computeHomeLoad } from "@/lib/home-load";
import { retroWeekSummary } from "@/lib/retro-data";
import { getAdminReportData } from "@/lib/report-data";
import { generateAnalysis } from "@/lib/ai/gemini";
import { kstDateKey } from "@/lib/daily-data";

// AI 주간 아젠다(기획 §1-f "회의 전") — 월요일 주간 통합 회의의 5섹션 데이터를 수집한다. server-only.
// 조회형(저장하지 않음). 회의 화면(다음 에이전트)·팀채널 게시(dispatch.postWeeklyAgenda)가 재사용한다.
//
// 5섹션(기획 §1):
//  ⑴ 지난주 요약 — 완료·완료율(기한 준수)·해소 병목 (관리자 리포트 데이터 재사용)
//  ⑵ 이번 주 조망 — 이번 주 마감 마일스톤 + 부하(computeHomeLoad)
//  ⑶ 마일스톤 안건 — 위험(주의/지연) + 마감 임박
//  ⑷ 결정 필요 — 미배정 Action · 결제 대기 · 응답 없는 도움 요청
//  ⑸ 팀 라운드 — 인원별 최근 스탠드업 focus 후보
//
// pro 요약문 생성은 선택 — 실패해도 데이터 섹션은 그대로 동작한다(요약은 게시 헤더용).

const RISK_LABELS: Record<string, string> = { at_risk: "주의", late: "지연", on_track: "정상" };

/** ⑵⑶ 마일스톤 안건 한 줄. */
export interface AgendaMilestone {
  id: string;
  title: string;
  projectName: string;
  dueAt: string;
  dueDateKey: string;
  risk: string;
  /** 관련 작업 진행률(프로젝트 공유 — done/전체, %). */
  progress: number;
  doneCount: number;
  totalCount: number;
}

/** ⑷ 결정 필요 안건 한 줄. */
export interface AgendaDecision {
  kind: "action" | "payment" | "help";
  label: string;
  detail: string;
}

/** ⑸ 팀 라운드 한 줄(인원별 최근 focus 후보). */
export interface AgendaTeamRound {
  userId: string;
  name: string;
  /** 가장 최근 제출된 스탠드업의 focus(없으면 undefined). */
  recentFocus?: string;
  /** 오늘 미제출 여부(회의 라운드에서 먼저 호명할 후보). */
  submittedToday: boolean;
  /** 막힘 작업 수(있으면 라운드에서 우선). */
  blockedCount: number;
}

/** 주간 아젠다 구조화 데이터(조회형). */
export interface WeeklyAgendaData {
  /** 회의 날짜 키(KST YYYY-MM-DD). */
  date: string;
  /** ⑴ 지난주 요약. 관리자 리포트가 없으면(비관리자 뷰어) null. */
  lastWeek: {
    completed: number;
    cancelled: number;
    /** 기한 준수율 라벨(완료율 근사, 리포트 adherence 재사용). */
    adherenceLabel: string;
    /** 병목 해소 시간 라벨(리포트 resolution 재사용). */
    resolutionLabel: string;
    /** 현재 막혀 있는 작업 수. */
    blockedNow: number;
  } | null;
  /** ⑴ 지난주 실패 분류(OS-2a) — 내부 N · 외부 N(관리됨 M). 비관리자 뷰어와 무관하게 항상 채운다. */
  failureClassification: RetroWeekSummary;
  /** ⑵ 이번 주 조망. */
  thisWeek: {
    range: { start: string; end: string };
    dueMilestones: AgendaMilestone[];
    overloadCount: number;
    cautionCount: number;
    loadTop: { name: string; ratio: number | null; openTasks: number }[];
  };
  /** ⑶ 마일스톤 안건 — 위험 + 마감 임박(2주 내). */
  milestoneAgenda: {
    risky: AgendaMilestone[];
    dueSoon: AgendaMilestone[];
  };
  /** ⑷ 결정 필요. */
  decisions: AgendaDecision[];
  /** ⑸ 팀 라운드. */
  teamRound: AgendaTeamRound[];
  /** (선택) pro 요약문. 생성 실패 시 undefined — 데이터 섹션은 그대로다. */
  summary?: string;
}

/** now(KST) 이번 주 [월요일, 일요일] 날짜 키 범위. */
function thisWeekRange(now: Date): { start: string; end: string } {
  const base = new Date(now);
  base.setHours(0, 0, 0, 0);
  const day = base.getDay(); // 0=일..6=토
  const toMonday = (day + 6) % 7; // 월=0
  const start = new Date(base);
  start.setDate(start.getDate() - toMonday);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return { start: kstDateKey(start), end: kstDateKey(end) };
}

/** ISO(마일스톤 dueAt)의 KST 날짜 키(YYYY-MM-DD). TZ 고정(instrumentation) 하 로컬 기준. */
function dateKeyOfIso(iso: string): string {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return "";
  return kstDateKey(new Date(ms));
}

/** 프로젝트 공유 진행률(취소/병합 제외 done/전체). weekly-preview와 같은 술어. */
function milestoneRow(db: MockQueDb, m: MockQueDb["milestones"][number]): AgendaMilestone {
  const project = db.projects.find((p) => p.id === m.projectId);
  const projTasks = db.tasks.filter(
    (t) => t.projectId === m.projectId && t.status !== "cancelled" && t.status !== "merged",
  );
  const doneCount = projTasks.filter((t) => t.status === "done").length;
  const progress = projTasks.length > 0 ? Math.round((doneCount / projTasks.length) * 100) : 0;
  return {
    id: m.id,
    title: m.title,
    projectName: project?.name ?? "-",
    dueAt: m.dueAt,
    dueDateKey: dateKeyOfIso(m.dueAt),
    risk: RISK_LABELS[m.riskStatus] ?? m.riskStatus,
    progress,
    doneCount,
    totalCount: projTasks.length,
  };
}

/**
 * 주간 통합 회의 아젠다 데이터 수집(조회형, 저장 안 함). 5섹션.
 * @param options.withSummary true면 pro로 요약문을 생성(실패해도 데이터는 반환). 기본 false.
 */
export async function buildWeeklyAgenda(
  db: MockQueDb,
  now: Date = new Date(),
  options: { withSummary?: boolean } = {},
): Promise<WeeklyAgendaData> {
  const date = kstDateKey(now);
  const week = thisWeekRange(now);

  // ⑴ 지난주 요약 — 관리자 리포트 재사용(week 기간). 뷰어를 admin으로 채워 실데이터를 받는다.
  let lastWeek: WeeklyAgendaData["lastWeek"] = null;
  try {
    const admin = db.users.find((u) => u.role === "admin" && u.active !== false);
    if (admin) {
      const report = await getAdminReportData(admin, "week", now);
      if (report.isAdmin) {
        lastWeek = {
          completed: report.completedInPeriod,
          cancelled: report.cancelledInPeriod,
          adherenceLabel: report.opsHealth.adherence.value,
          resolutionLabel: report.opsHealth.resolution.value,
          blockedNow: report.overall.blockedNow,
        };
      }
    }
  } catch (error) {
    console.error("[que-agenda] 지난주 요약(리포트) 수집 실패(무시)", error);
  }

  // ⑵ 이번 주 마감 마일스톤 + 부하.
  const dueMilestones = db.milestones
    .filter((m) => {
      const key = dateKeyOfIso(m.dueAt);
      return key >= week.start && key <= week.end;
    })
    .map((m) => milestoneRow(db, m))
    .sort((a, b) => a.dueDateKey.localeCompare(b.dueDateKey));

  const activeIds = db.users.filter((u) => u.active !== false).map((u) => u.id);
  const load = computeHomeLoad(db, activeIds, now);
  const loadTop = load.rows
    .filter((r) => r.ratio != null)
    .sort((a, b) => (b.ratio ?? 0) - (a.ratio ?? 0))
    .slice(0, 5)
    .map((r) => ({ name: r.name, ratio: r.ratio, openTasks: r.openTasks }));

  // ⑶ 마일스톤 안건 — 위험(주의/지연) + 마감 임박(오늘~14일).
  const soonEnd = kstDateKey(new Date(now.getTime() + 14 * 864e5));
  const risky = db.milestones
    .filter((m) => m.riskStatus === "at_risk" || m.riskStatus === "late")
    .map((m) => milestoneRow(db, m))
    .sort((a, b) => a.dueDateKey.localeCompare(b.dueDateKey));
  const riskyIds = new Set(risky.map((m) => m.id));
  const dueSoon = db.milestones
    .filter((m) => {
      if (riskyIds.has(m.id)) return false; // 위험 섹션과 중복 제거
      const key = dateKeyOfIso(m.dueAt);
      return key >= date && key <= soonEnd;
    })
    .map((m) => milestoneRow(db, m))
    .sort((a, b) => a.dueDateKey.localeCompare(b.dueDateKey));

  // ⑷ 결정 필요 — 미배정 Action(needs_review) · 결제 대기(waiting) · 응답 없는 도움 요청.
  const decisions: AgendaDecision[] = [];
  const nameById = new Map(db.users.map((u) => [u.id, u.name]));
  for (const item of db.actionItems.filter((a) => a.status === "needs_review")) {
    decisions.push({
      kind: "action",
      label: "미배정 Action",
      detail: `${item.title} (담당·마감 확인 필요)`,
    });
  }
  for (const pay of db.paymentRequests.filter((p) => p.status === "waiting")) {
    decisions.push({
      kind: "payment",
      label: "결제 대기",
      detail: `${pay.title} · 요청 ${nameById.get(pay.requesterId) ?? pay.requesterId}`,
    });
  }
  // 응답 없는 도움 요청: helpUserIds가 달린 댓글 중 대상 작업이 아직 막힌(issue/on_hold) 것.
  const blockedTaskIds = new Set(
    db.tasks.filter((t) => t.status === "issue" || t.status === "on_hold").map((t) => t.id),
  );
  for (const c of db.taskComments) {
    const helpIds = c.helpUserIds?.length ? c.helpUserIds : c.helpUserId ? [c.helpUserId] : [];
    if (helpIds.length === 0) continue;
    if (!blockedTaskIds.has(c.taskId)) continue;
    const task = db.tasks.find((t) => t.id === c.taskId);
    decisions.push({
      kind: "help",
      label: "응답 없는 도움 요청",
      detail: `${task?.title ?? c.taskId} → ${helpIds.map((id) => nameById.get(id) ?? id).join(", ")}`,
    });
  }

  // ⑸ 팀 라운드 — 인원별 최근 focus 후보 + 오늘 제출 여부·막힘 수.
  const submittedToday = new Set(db.standupEntriesByDate(date).map((e) => e.userId));
  const teamRound: AgendaTeamRound[] = db.users
    .filter((u) => u.active !== false)
    .map((u) => {
      // 가장 최근 제출된 스탠드업 focus(제출일 내림차순).
      const mine = db.standupEntries
        .filter((e) => e.userId === u.id)
        .sort((a, b) => (b.date > a.date ? 1 : b.date < a.date ? -1 : 0));
      const blockedCount = db.tasks.filter(
        (t) => t.assigneeId === u.id && (t.status === "issue" || t.status === "on_hold"),
      ).length;
      return {
        userId: u.id,
        name: u.name,
        recentFocus: mine[0]?.focus,
        submittedToday: submittedToday.has(u.id),
        blockedCount,
      };
    })
    // 막힘 있는 사람 먼저(병목 우선 호명, 기획 §3-b) → 미제출 → 나머지.
    .sort((a, b) => b.blockedCount - a.blockedCount || Number(a.submittedToday) - Number(b.submittedToday));

  const data: WeeklyAgendaData = {
    date,
    lastWeek,
    // ⑴ 지난주 실패 분류(OS-2a) — 지난 7일 회고 집계(내부/외부/관리됨).
    failureClassification: retroWeekSummary(db, now),
    thisWeek: {
      range: week,
      dueMilestones,
      overloadCount: load.summary.overloadCount,
      cautionCount: load.summary.cautionCount,
      loadTop,
    },
    milestoneAgenda: { risky, dueSoon },
    decisions,
    teamRound,
  };

  if (options.withSummary) {
    data.summary = (await buildAgendaSummary(data)) ?? undefined;
  }
  return data;
}

const AGENDA_SYSTEM = [
  "너는 8명 규모 한국 회사의 주간 통합 회의 진행 참모다. 아래 아젠다 데이터로 회의 시작 브리핑을 쓴다.",
  "규칙:",
  "- 반드시 한국어 존댓말. 데이터에 없는 사실을 지어내지 않는다. 사람 평가·질책 금지.",
  "- 아래 다섯 섹션 머리글을 그대로 지킨다(plain text, 마크다운 굵게 없이):",
  "  [지난주 요약] 완료·완료율·병목 해소를 한 문장. 데이터 없으면 '집계 없음'.",
  "  [이번 주 조망] 이번 주 마감 마일스톤과 부하 쏠림을 짚는다.",
  "  [마일스톤 안건] 위험(주의/지연)·마감 임박 마일스톤을 묶는다. 없으면 '없음'.",
  "  [결정 필요] 미배정 Action·결제 대기·응답 없는 도움 요청을 정리한다. 없으면 '없음'.",
  "  [팀 라운드] 막힘 있는 사람을 먼저 호명하도록 순서를 제안한다.",
  "- 전체 14줄 이내. 실행 가능한 문장으로.",
].join("\n");

/** pro로 아젠다 요약문 생성(선택). 실패 시 null — 데이터 섹션은 그대로 동작한다. */
async function buildAgendaSummary(data: WeeklyAgendaData): Promise<string | null> {
  try {
    const payload = {
      지난주: data.lastWeek,
      이번주: {
        기간: data.thisWeek.range,
        "마감 마일스톤": data.thisWeek.dueMilestones.map((m) => ({
          마일스톤: m.title,
          위험: m.risk,
          진행률: `${m.progress}%`,
        })),
        과부하: data.thisWeek.overloadCount,
        주의: data.thisWeek.cautionCount,
        부하상위: data.thisWeek.loadTop,
      },
      "마일스톤 안건": {
        위험: data.milestoneAgenda.risky.map((m) => `${m.title}(${m.risk}, ${m.progress}%)`),
        "마감 임박": data.milestoneAgenda.dueSoon.map((m) => `${m.title}(${m.dueDateKey})`),
      },
      "결정 필요": data.decisions.map((d) => `${d.label}: ${d.detail}`),
      "팀 라운드": data.teamRound.map((t) => ({
        이름: t.name,
        막힘: t.blockedCount,
        "오늘 제출": t.submittedToday,
      })),
    };
    return await generateAnalysis(AGENDA_SYSTEM, JSON.stringify(payload, null, 1), {
      model: "pro",
      maxOutputTokens: 2048,
    });
  } catch (error) {
    console.error("[que-agenda] pro 아젠다 요약 실패(무시)", error);
    return null;
  }
}
