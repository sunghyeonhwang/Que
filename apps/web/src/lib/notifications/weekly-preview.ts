import "server-only";

import type { MockQueDb, NotificationIntent } from "@que/core";
import { computeHomeLoad } from "@/lib/home-load";
import { computeGanttRisk } from "@/lib/projects-data";
import { generateAnalysis } from "@/lib/ai/gemini";
import { dedupKeyFor } from "@que/core";
import { webhookEnabled } from "./config";
import { enqueueAndSend } from "./dispatch";

// 주간 프리뷰(기획 §1-d) — 금요일 16:00 KST, pro. 다음 주 예보를 팀채널에 게시해 월요일 통합 회의를
// "검토+결정"만 하게 만든다. server-only. dedup `weekly_preview:team:<ISO주차>`(주당 1회).
//
// 3블록: ⑴다음 주 마감 마일스톤(위험·관련 작업 진행률) ⑵부하 쏠림(computeHomeLoad 재사용)
//         ⑶선행 지연 위험(computeGanttRisk 재사용). 주말 게이트와 무관(금요일 발송).

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const PREVIEW_DAY_KST = 5; // 금요일(0=일)
const PREVIEW_HOUR_KST = 16; // 16:00 KST

const RISK_LABELS: Record<string, string> = { at_risk: "주의", late: "지연", on_track: "정상" };

/** now의 KST 벽시계 시(hour). */
function kstHour(now: Date): number {
  return new Date(now.getTime() + KST_OFFSET_MS).getUTCHours();
}

/** now의 KST 요일(0=일..6=토). */
function kstDay(now: Date): number {
  return new Date(now.getTime() + KST_OFFSET_MS).getUTCDay();
}

/** now(KST) 기준 ISO 주차 문자열("YYYY-Www") — dedup 마커(주당 1회). */
function kstIsoWeek(now: Date): string {
  const d = new Date(now.getTime() + KST_OFFSET_MS);
  // ISO 8601: 목요일이 속한 해·주. UTC 필드로 KST 벽시계를 다룬다.
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNr = (target.getUTCDay() + 6) % 7; // 월=0..일=6
  target.setUTCDate(target.getUTCDate() - dayNr + 3); // 그 주 목요일
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const firstDayNr = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNr + 3);
  const week = 1 + Math.round((target.getTime() - firstThursday.getTime()) / (7 * 864e5));
  return `${target.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/** ISO(마일스톤 dueAt)의 KST 날짜 키(YYYY-MM-DD). 파싱 실패 시 빈 문자열. */
function kstDateKeyOfIso(iso: string): string {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return "";
  return new Date(ms + KST_OFFSET_MS).toISOString().slice(0, 10);
}

/** now(KST) 다음 주 [월요일, 일요일] 날짜 키 범위. */
function nextWeekRange(now: Date): { start: string; end: string } {
  const base = new Date(now.getTime() + KST_OFFSET_MS);
  const day = base.getUTCDay(); // 0=일..6=토
  const toNextMonday = ((1 - day + 7) % 7) || 7; // 오늘이 월이면 +7
  const start = new Date(base);
  start.setUTCDate(start.getUTCDate() + toNextMonday);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

/**
 * 주간 프리뷰 생성·게시 — 금요일 16:00 KST. Webhook 게이트. 이미 이번 주 게시했으면 스킵(dedup).
 * pro 요약 실패 시 예외를 삼키고 게시하지 않는다(다음 크론 실행에서 재시도, dedup은 게시 성공분만 남김).
 */
export async function postWeeklyPreview(db: MockQueDb, now: Date): Promise<boolean> {
  if (!webhookEnabled()) return false; // 팀채널 게시 — Webhook 게이트
  if (kstDay(now) !== PREVIEW_DAY_KST || kstHour(now) !== PREVIEW_HOUR_KST) return false;

  const week = kstIsoWeek(now);
  const probe: NotificationIntent = {
    kind: "weekly_preview",
    entityType: "team",
    entityId: "team",
    marker: week,
    payload: { title: "", text: "", deeplinkPath: "/planning?tab=milestones", tone: "violet" },
  };
  const key = dedupKeyFor(probe);
  if (db.notificationOutbox.some((e) => e.dedupKey === key)) return false;

  try {
    const content = await buildPreviewContent(db, now);
    if (!content) return false; // 예보할 게 전무하면 게시하지 않는다

    const intent: NotificationIntent = {
      ...probe,
      payload: {
        title: "다음 주 프리뷰",
        text: "월요일 통합 회의 사전 예보입니다.",
        deeplinkPath: "/planning?tab=milestones",
        tone: "violet",
        detail: content,
      },
    };
    const result = await enqueueAndSend(db, [intent], now);
    return result.sent > 0;
  } catch (error) {
    console.error("[que-notify] postWeeklyPreview 실패(무시)", error);
    return false;
  }
}

const PREVIEW_SYSTEM = [
  "너는 8명 규모 한국 회사의 주간 운영 참모다. 다음 주 예보 데이터를 근거로 월요일 회의 사전 브리핑을 쓴다.",
  "규칙:",
  "- 반드시 한국어 존댓말. 데이터에 없는 사실을 지어내지 않는다. 사람 평가·질책 금지.",
  "- 아래 세 섹션 구조를 그대로 지킨다(각 섹션 머리글 포함, plain text, 마크다운 굵게 없이):",
  "  [다음 주 마감 마일스톤] 위험 상태와 관련 작업 진행률을 함께. 없으면 '없음'.",
  "  [부하 쏠림] 과부하·주의 인원과 남은 가용을 짚는다. 재배분 제안 1개.",
  "  [선행 지연 위험] 선행이 안 끝나 밀릴 위험이 있는 작업을 묶는다. 없으면 '없음'.",
  "- 전체 12줄 이내. 실행 가능한 문장으로.",
].join("\n");

/** pro로 3블록 예보 본문을 만든다. 데이터가 전무(마일스톤·부하·위험 모두 0)면 null. */
async function buildPreviewContent(db: MockQueDb, now: Date): Promise<string | null> {
  const { start, end } = nextWeekRange(now);
  const projectById = new Map(db.projects.map((p) => [p.id, p]));
  const taskById = new Map(db.tasks.map((t) => [t.id, t]));

  // ⑴ 다음 주 마감 마일스톤 + 관련 작업 진행률(프로젝트 공유 — done/전체).
  const dueMilestones = db.milestones
    .filter((m) => {
      const key = kstDateKeyOfIso(m.dueAt);
      return key >= start && key <= end;
    })
    .map((m) => {
      const project = projectById.get(m.projectId);
      const projTasks = db.tasks.filter(
        (t) => t.projectId === m.projectId && t.status !== "cancelled" && t.status !== "merged",
      );
      const doneCount = projTasks.filter((t) => t.status === "done").length;
      const progress = projTasks.length > 0 ? Math.round((doneCount / projTasks.length) * 100) : 0;
      return {
        마일스톤: m.title,
        프로젝트: project?.name ?? "-",
        위험: RISK_LABELS[m.riskStatus] ?? m.riskStatus,
        마감: kstDateKeyOfIso(m.dueAt),
        "관련 작업 진행률": `${progress}% (${doneCount}/${projTasks.length})`,
      };
    })
    .sort((a, b) => a.마감.localeCompare(b.마감));

  // ⑵ 부하 쏠림 — 전 활성 인원 대상 computeHomeLoad 재사용(배분 조정용, 평가 아님).
  const activeIds = db.users.filter((u) => u.active !== false).map((u) => u.id);
  const load = computeHomeLoad(db, activeIds, now);
  const loadRows = load.rows
    .filter((r) => r.ratio != null)
    .sort((a, b) => (b.ratio ?? 0) - (a.ratio ?? 0))
    .slice(0, 5)
    .map((r) => ({ 담당: r.name, "예상/가용": `${r.ratio}%`, "열린 작업": r.openTasks }));

  // ⑶ 선행 지연 위험 — computeGanttRisk 재사용(선행 미완으로 밀릴 위험 문장).
  const risks = computeGanttRisk(db.tasks, taskById, now.toISOString());
  const riskLines = [...risks.entries()]
    .map(([taskId, reason]) => {
      const t = taskById.get(taskId);
      return t ? { 작업: t.title, 위험: reason } : null;
    })
    .filter((x): x is { 작업: string; 위험: string } => x !== null)
    .slice(0, 8);

  if (dueMilestones.length === 0 && loadRows.length === 0 && riskLines.length === 0) return null;

  const payload = {
    "다음 주": `${start} ~ ${end}`,
    "다음 주 마감 마일스톤": dueMilestones,
    부하: {
      과부하: load.summary.overloadCount,
      주의: load.summary.cautionCount,
      "남은 가용시간": load.summary.remainingCapacityHours,
      상위: loadRows,
    },
    "선행 지연 위험": riskLines,
  };

  return await generateAnalysis(PREVIEW_SYSTEM, JSON.stringify(payload, null, 1), {
    model: "pro",
    maxOutputTokens: 2048,
  });
}
