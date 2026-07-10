import { canViewMeetingNote, type User } from "@que/core";
import { getDb } from "./db";

// 알림(상단바 벨) 데이터 계층 — 운영 병목 신호를 모아 보여준다.
// 감시가 아니라 "어디가 막혔나"를 빨리 드러내는 용도(기획/CLAUDE.md 원칙).
// 조회 전용. 열람 권한 없는 회의록의 Action은 제외.

export type AlertKind = "needs_review" | "issue" | "overdue" | "payment";
export type AlertTone = "violet" | "red" | "amber";

export interface AlertItem {
  id: string;
  kind: AlertKind;
  tone: AlertTone;
  title: string;
  description: string;
  href: string;
  /** 사용자가 읽음 처리했는지(alert_reads). 표시는 유지되고 뱃지·강조에서만 빠진다(C-3a). */
  read: boolean;
}

export interface AlertsData {
  items: AlertItem[];
  /** 뱃지용 총 개수(표시 캡과 무관한 실제 수) */
  count: number;
  /** 안읽음 수 — 상단바 종 뱃지는 이 값을 쓴다(C-3a). */
  unreadCount: number;
}

const OPEN = new Set(["scheduled", "in_progress", "needs_reschedule", "on_hold", "issue"]);
const DISPLAY_CAP = 8;

export async function getAlerts(
  user: User,
  now: Date = new Date(),
  opts?: { all?: boolean },
): Promise<AlertsData> {
  const db = await getDb();
  // 읽음 오버레이(C-3a) — 파생 알림의 안정 id 기준. 항목이 해결되면 알림은 자연 소멸하고
  // 읽음 행만 잔존(무해). 재발(동일 id 재등장)은 읽음이 유지된다 — 뱃지는 "새로운 것" 신호.
  const readIds = new Set(db.alertReads.filter((r) => r.userId === user.id).map((r) => r.alertId));
  const nowMs = now.getTime();
  const userById = new Map(db.users.map((u) => [u.id, u]));
  const nameOf = (id: string) => userById.get(id)?.name ?? id;

  const viewableNoteIds = new Set(
    db.meetingNotes.filter((n) => canViewMeetingNote(user, n)).map((n) => n.id),
  );

  // 심각도·다양성 순으로 쌓는다: 문제발생 → 확인필요 → 결제마감 → 기한초과.
  // (기한초과가 보통 가장 많아, 뒤에 둬야 캡에 밀려도 고신호 항목이 먼저 보인다.)
  const items: AlertItem[] = [];

  // 1) 문제발생 작업 (가장 급함)
  const issueTaskIds = new Set<string>();
  for (const t of db.tasks.filter((t) => t.status === "issue")) {
    issueTaskIds.add(t.id);
    items.push({
      id: `issue-${t.id}`,
      read: readIds.has(`issue-${t.id}`),
      kind: "issue",
      tone: "red",
      title: "문제 발생",
      description: `${t.title} · 담당 ${nameOf(t.assigneeId)}`,
      href: "/now",
    });
  }

  // 2) 확인 필요 Action (담당자/마감 누락으로 Task 자동생성 안 된 것)
  for (const a of db.actionItems.filter(
    (a) => a.status === "needs_review" && viewableNoteIds.has(a.meetingNoteId),
  )) {
    items.push({
      id: `review-${a.id}`,
      read: readIds.has(`review-${a.id}`),
      kind: "needs_review",
      tone: "violet",
      title: "확인 필요",
      description: a.title,
      href: "/action",
    });
  }

  // 3) 결제 마감 초과 대기 건
  for (const p of db.paymentRequests.filter(
    (p) => p.status === "waiting" && p.dueAt && new Date(p.dueAt).getTime() < nowMs,
  )) {
    items.push({
      id: `pay-${p.id}`,
      read: readIds.has(`pay-${p.id}`),
      kind: "payment",
      tone: "amber",
      title: "결제 마감 초과",
      description: `${p.title} · ${p.category}`,
      href: "/payments",
    });
  }

  // 4) 기한 초과 작업 (마감 지났는데 아직 열려 있음).
  //    문제발생으로 이미 잡힌 작업은 중복 등재하지 않는다.
  for (const t of db.tasks.filter(
    (t) =>
      !issueTaskIds.has(t.id) &&
      t.endAt &&
      new Date(t.endAt).getTime() < nowMs &&
      OPEN.has(t.status),
  )) {
    items.push({
      id: `overdue-${t.id}`,
      read: readIds.has(`overdue-${t.id}`),
      kind: "overdue",
      tone: "amber",
      title: "기한 초과",
      description: `${t.title} · 담당 ${nameOf(t.assigneeId)}`,
      href: "/now",
    });
  }

  const unreadCount = items.filter((i) => !i.read).length;
  // 드롭다운은 안읽음을 앞으로(캡에 밀리지 않게), 알림 센터(all)는 원래 심각도 순서 유지.
  const ordered = opts?.all ? items : [...items].sort((a, b) => Number(a.read) - Number(b.read));
  return {
    items: opts?.all ? ordered : ordered.slice(0, DISPLAY_CAP),
    count: items.length,
    unreadCount,
  };
}
