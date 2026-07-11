import "server-only";

import type { ChangeLog, MeetingNote, MockQueDb } from "@que/core";
import { kstDateKey } from "@/lib/daily-data";

// 행동 기반 회의록 초안(기획 §1-f "회의 후" · 캡처 방식 ⑴ 행동 기반 회의록 = 정본).
// 회의 중 시스템 행동(마일스톤 조정·담당 변경·상태 변경·결제 승인·도움 요청·신규 마일스톤/Task)이
// 회의록의 기준이다. AI 불요 — 결정적 템플릿으로 본문을 만든다(저장은 액션에서). server-only.

const ENTITY_LABEL: Record<string, string> = {
  task: "작업",
  milestone: "마일스톤",
  payment_request: "결제",
  action_item: "Action",
  project: "프로젝트",
  client: "클라이언트",
  meeting_note: "회의록",
};

const CHANGE_LABEL: Record<ChangeLog["changeType"], string> = {
  create: "신규",
  update: "변경",
  move: "일정 이동",
  status_change: "상태 변경",
  delete: "삭제",
};

/** 회의 중 수집된 행동 한 줄(시간순 타임라인 항목). */
export interface CollectedAction {
  /** 발생 시각 ISO. */
  at: string;
  category: "milestone" | "task" | "payment" | "help" | "action_item" | "other";
  /** 사람이 읽는 한 줄. */
  text: string;
  /** 행위자 이름(도움 요청은 작성자). */
  actorName: string;
}

/** ISO의 KST 날짜 키(TZ 고정 하 로컬 기준). */
function dateKeyOfIso(iso: string): string {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return "";
  return kstDateKey(new Date(ms));
}

/** ISO → "HH:mm"(KST 로컬). */
function hhmm(iso: string): string {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return "--:--";
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
}

/**
 * 오늘(KST) 회의 중 발생한 행동을 시간순으로 수집한다(조회형, 저장 안 함).
 * ⑴ ChangeLog(마일스톤 조정·담당 변경·상태 변경·결제 승인·신규 마일스톤/Task 등)
 * ⑵ 오늘 작성된 도움 요청 댓글(helpUserIds)
 * 을 하나의 타임라인으로 병합해 오름차순 반환한다.
 */
export function collectTodayActions(db: MockQueDb, now: Date = new Date()): CollectedAction[] {
  const today = kstDateKey(now);
  const nameById = new Map(db.users.map((u) => [u.id, u.name]));
  const items: CollectedAction[] = [];

  // 엔티티 제목 해석기 — ChangeLog afterValue가 비어도 현재 엔티티에서 제목을 찾는다.
  const titleOf = (entityType: string, entityId: string): string | undefined => {
    switch (entityType) {
      case "task":
        return db.tasks.find((t) => t.id === entityId)?.title;
      case "milestone":
        return db.milestones.find((m) => m.id === entityId)?.title;
      case "payment_request":
        return db.paymentRequests.find((p) => p.id === entityId)?.title;
      case "action_item":
        return db.actionItems.find((a) => a.id === entityId)?.title;
      case "project":
        return db.projects.find((p) => p.id === entityId)?.name;
      default:
        return undefined;
    }
  };

  for (const log of db.changeLogs) {
    if (dateKeyOfIso(log.createdAt) !== today) continue;
    // 업무 결정과 무관한 잡 로그(선행 링크 자동 해제 등)는 초안 소음이 되니 제외하지 않되,
    // 핵심 4종(마일스톤·작업 상태/담당·결제·Action·신규)만 카테고리를 부여한다.
    const entLabel = ENTITY_LABEL[log.entityType] ?? log.entityType;
    const chgLabel = CHANGE_LABEL[log.changeType];
    const title = titleOf(log.entityType, log.entityId) ?? log.afterValue ?? log.entityId;
    const beforeAfter =
      log.beforeValue && log.afterValue
        ? ` (${log.beforeValue} → ${log.afterValue})`
        : log.afterValue && log.changeType !== "create"
          ? ` (${log.afterValue})`
          : "";
    let category: CollectedAction["category"] = "other";
    if (log.entityType === "milestone") category = "milestone";
    else if (log.entityType === "task") category = "task";
    else if (log.entityType === "payment_request") category = "payment";
    else if (log.entityType === "action_item") category = "action_item";

    items.push({
      at: log.createdAt,
      category,
      text: `${entLabel} ${chgLabel} — ${title}${beforeAfter}`,
      actorName: nameById.get(log.actorId) ?? log.actorId,
    });
  }

  // 오늘 작성된 도움 요청(helpUserIds 달린 댓글).
  for (const c of db.taskComments) {
    if (dateKeyOfIso(c.createdAt) !== today) continue;
    const helpIds = c.helpUserIds?.length ? c.helpUserIds : c.helpUserId ? [c.helpUserId] : [];
    if (helpIds.length === 0) continue;
    const task = db.tasks.find((t) => t.id === c.taskId);
    items.push({
      at: c.createdAt,
      category: "help",
      text: `도움 요청 — ${task?.title ?? c.taskId} → ${helpIds
        .map((id) => nameById.get(id) ?? id)
        .join(", ")}`,
      actorName: nameById.get(c.authorId) ?? c.authorId,
    });
  }

  return items.sort((a, b) => a.at.localeCompare(b.at));
}

/** 회의록 초안(본문 텍스트 + 메타). 저장은 액션에서 createMeetingNote로 한다. */
export interface MeetingMinutesDraft {
  kind: MeetingNote["kind"];
  title: string;
  fileName: string;
  markdownBody: string;
  /** 수집된 행동 수(빈 회의록 방지 판단용). */
  actionCount: number;
}

/**
 * 행동 기반 회의록 본문 초안을 결정적 템플릿으로 구성한다(AI 불요).
 * kind=weekly면 당일 standup_entries(팀 라운드)를 함께 담는다. milestone이면 마일스톤 조정만 강조.
 */
export function draftMeetingMinutes(
  db: MockQueDb,
  now: Date = new Date(),
  kind: "weekly" | "milestone" = "weekly",
): MeetingMinutesDraft {
  const today = kstDateKey(now);
  const actions = collectTodayActions(db, now);
  const nameById = new Map(db.users.map((u) => [u.id, u.name]));

  const kindLabel = kind === "weekly" ? "주간 통합 회의" : "마일스톤 회의";
  const lines: string[] = [];
  lines.push(`# ${today} ${kindLabel} 회의록 (초안)`);
  lines.push("");
  lines.push("> 행동 기반 자동 초안입니다. 회의 중 시스템에 남은 결정을 시간순으로 정리했습니다.");
  lines.push("");

  // 마일스톤 결정(마일스톤 회의는 이 섹션이 핵심).
  const milestoneActions = actions.filter((a) => a.category === "milestone");
  lines.push("## 마일스톤 결정");
  if (milestoneActions.length > 0) {
    for (const a of milestoneActions) lines.push(`- ${hhmm(a.at)} ${a.text} · ${a.actorName}`);
  } else {
    lines.push("- 조정된 마일스톤이 없습니다.");
  }
  lines.push("");

  // 나머지 결정·변경(작업 상태/담당·결제 승인·Action·도움 요청).
  const otherActions = actions.filter((a) => a.category !== "milestone");
  lines.push("## 결정·변경 사항");
  if (otherActions.length > 0) {
    for (const a of otherActions) lines.push(`- ${hhmm(a.at)} ${a.text} · ${a.actorName}`);
  } else {
    lines.push("- 기록된 변경이 없습니다.");
  }
  lines.push("");

  // 주간 회의는 팀 라운드(당일 스탠드업)를 함께 담는다.
  if (kind === "weekly") {
    const entries = db.standupEntriesByDate(today);
    lines.push("## 팀 라운드 (오늘 스탠드업)");
    if (entries.length > 0) {
      for (const e of entries) {
        const name = nameById.get(e.userId) ?? e.userId;
        const blocker = e.blockerText ? ` · 막힘: ${e.blockerText}` : "";
        lines.push(`- ${name}: ${e.focus}${blocker}`);
      }
    } else {
      lines.push("- 제출된 체크인이 없습니다.");
    }
    lines.push("");
  }

  lines.push("---");
  lines.push("Action 후보는 회의록 저장 후 'Action 추출'로 확인하세요.");

  return {
    kind,
    title: `${today} ${kindLabel}`,
    fileName: `${today}-${kind}-minutes.md`,
    markdownBody: lines.join("\n"),
    actionCount: actions.length,
  };
}
