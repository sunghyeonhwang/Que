import "server-only";

import type { MockQueDb, NotificationIntent, Task } from "@que/core";
import { deadlineThresholdHours, digestRecipientAllowlist } from "./config";

// 개인 DM 데일리 브리핑(personal_digest) 콘텐츠 빌더 — Slack Phase 2, web 계층.
// active 유저별로 4섹션(오늘 작업/막힘/마감/마일스톤 위험)을 조립해 NotificationIntent[]를 만든다.
// 부수효과 없음(발송·적재는 dispatch). 전 섹션 0건인 유저는 intent를 생략한다(빈 브리핑 미발송).
//
// v1 결정(사용자 승인): 체크인 응답대기·도움요청은 제외(4섹션만). 본인 것만(assignee/owner===userId).
// 마일스톤 "담당"은 스키마상 project.ownerId 경유가 유일 경로. riskStatus at_risk/late(=!on_track)만.

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** 열린(진행 가능한) 상태 — 마감·오늘 작업 스캔 대상. done/cancelled/merged 제외. */
const OPEN_STATUSES = new Set(["scheduled", "in_progress", "needs_reschedule", "on_hold", "issue"]);

/** now의 KST 날짜 키(YYYY-MM-DD). personal_digest dedup marker이자 발송 창 스코프. */
export function kstDateKey(now: Date): string {
  return new Date(now.getTime() + KST_OFFSET_MS).toISOString().slice(0, 10);
}

/**
 * active 유저별 개인 브리핑 intent. recipient=userId, kind=personal_digest, marker=KST 날짜.
 * 전 섹션 0건이면 그 유저는 생략한다(빈 브리핑 미발송).
 */
export function buildPersonalDigestIntents(db: MockQueDb, now: Date): NotificationIntent[] {
  const dateKey = kstDateKey(now);
  const thresholdMs = deadlineThresholdHours() * 60 * 60 * 1000;
  const nowMs = now.getTime();

  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(now);
  dayEnd.setHours(23, 59, 59, 999);

  // today-data.ts overlapsToday 패턴(startAt만 보는 getStandupData 말고 구간 겹침).
  const overlapsToday = (t: Task): boolean => {
    if (!t.startAt && !t.endAt) return false;
    const start = t.startAt ? new Date(t.startAt) : new Date(t.endAt!);
    const end = t.endAt ? new Date(t.endAt) : start;
    return start <= dayEnd && end >= dayStart;
  };

  // 마일스톤 담당 = project.ownerId. userId → 위험 마일스톤 수.
  const projectById = new Map(db.projects.map((p) => [p.id, p]));
  const riskByOwner = new Map<string, number>();
  for (const m of db.milestones) {
    if (m.riskStatus === "on_track") continue;
    const owner = projectById.get(m.projectId)?.ownerId;
    if (!owner) continue;
    riskByOwner.set(owner, (riskByOwner.get(owner) ?? 0) + 1);
  }

  const allow = digestRecipientAllowlist(); // null이면 전체, 아니면 그 유저만(테스트/단계적 롤아웃)

  const intents: NotificationIntent[] = [];
  for (const user of db.users) {
    if (user.active === false) continue; // active 유저만
    if (allow && !allow.includes(user.id)) continue; // 허용목록 있으면 그 유저만

    const mine = db.tasks.filter(
      (t) => t.assigneeId === user.id && t.status !== "cancelled" && t.status !== "merged",
    );

    const todayCount = mine.filter((t) => OPEN_STATUSES.has(t.status) && overlapsToday(t)).length;
    const blockedCount = mine.filter((t) => t.status === "issue" || t.status === "on_hold").length;
    const deadlineCount = mine.filter((t) => {
      if (!OPEN_STATUSES.has(t.status) || !t.endAt) return false;
      const due = Date.parse(t.endAt);
      if (Number.isNaN(due)) return false;
      return due >= nowMs && due <= nowMs + thresholdMs; // 지금~임계(overdue 제외)
    }).length;
    const milestoneCount = riskByOwner.get(user.id) ?? 0;

    if (todayCount + blockedCount + deadlineCount + milestoneCount === 0) continue; // 빈 브리핑 생략

    intents.push({
      kind: "personal_digest",
      entityType: "user",
      entityId: user.id,
      marker: dateKey,
      recipient: user.id, // 발송 직전 Slack member ID로 해석
      payload: {
        title: "오늘의 브리핑",
        text: `오늘 작업 ${todayCount} · 막힘 ${blockedCount} · 마감 임박 ${deadlineCount} · 마일스톤 위험 ${milestoneCount}`,
        deeplinkPath: "/today",
        tone: "blue",
      },
    });
  }
  return intents;
}
