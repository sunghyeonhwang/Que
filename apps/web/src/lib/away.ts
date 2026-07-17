import { format } from "date-fns";
import { canViewPrivateEventDetail, type CalendarEvent, type User } from "@que/core";
import type { getDb } from "./db";

// 오늘 팀 부재(자리비움·외부 일정) 조립의 단일 소스. 홈 오늘 일정 카드(computeAwayChip)와
// 데일리 미제출 카드(computeAbsenceByUser)가 이 한 곳을 공유한다(중복 구현 금지).
//
// 마스킹 규칙(기존 홈 규칙 그대로): 비공개 자리비움은 뷰어가 상세를 볼 수 없으면 원제목을 노출하지
// 않고 "자리비움"으로만. 외부 회사 일정(source=company)은 제목을 그대로 보여준다(예: "외근 — 웨스틴").
// "부재성"은 홈 away-chip과 동일하게 ⑴비공개(뷰어 비열람) ⑵source=company 두 신호로만 판정한다 —
// 팀 공개 Que 일정(내부 회의 등)은 부재로 치지 않는다(classifyAway가 null 반환).

type Db = Awaited<ReturnType<typeof getDb>>;

export interface HomeAwayEntry {
  name: string;
  /** "오전"·"오후"·"종일"(자리비움) 또는 "HH:mm"(외부 일정). */
  when: string;
}

/** 오늘 일정 카드 하단 부재 칩(전 역할 공통). 비공개는 사유 없이 이름만. */
export interface HomeAwayChip {
  /** 오늘 자리비움(비공개 포함 — 사유 없이 이름·시간대만). */
  away: HomeAwayEntry[];
  /** 오늘 외부 회사 일정(source=company). */
  external: HomeAwayEntry[];
}

/** 이벤트가 now의 로컬(KST 고정) 하루와 겹치는지. */
function overlapsToday(e: CalendarEvent, dayStart: Date, dayEnd: Date): boolean {
  return new Date(e.startAt) <= dayEnd && new Date(e.endAt) >= dayStart;
}

/** 자리비움 시간대 표기(종일/오전/오후). */
function awayWhen(e: CalendarEvent): string {
  const s = new Date(e.startAt);
  const spanH = (new Date(e.endAt).getTime() - s.getTime()) / 3.6e6;
  if (spanH >= 8) return "종일";
  return s.getHours() < 12 ? "오전" : "오후";
}

/**
 * 이벤트를 부재성으로 분류(뷰어 마스킹 반영). 부재성이 아니면 null.
 * - 비공개(뷰어 비열람): kind="away", label="자리비움"(원제목 노출 금지).
 * - source=company: kind="external", label=이벤트 제목 그대로.
 */
export function classifyAway(
  e: CalendarEvent,
  viewer: User,
): { kind: "away" | "external"; label: string } | null {
  if (e.visibility === "private" && !canViewPrivateEventDetail(e, viewer)) {
    return { kind: "away", label: "자리비움" };
  }
  if (e.source === "company") {
    return { kind: "external", label: e.title };
  }
  return null;
}

function dayBounds(now: Date): { dayStart: Date; dayEnd: Date } {
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(now);
  dayEnd.setHours(23, 59, 59, 999);
  return { dayStart, dayEnd };
}

/**
 * 오늘 팀 부재 칩(홈 오늘 일정 카드). 소유자(ownerId) 기준으로 자리비움·외부 일정을 한 줄로 모은다.
 * 비공개는 사유 없이 이름·시간대만(마스킹). 사람당 중복 제거.
 */
export function computeAwayChip(db: Db, viewer: User, now: Date): HomeAwayChip {
  const { dayStart, dayEnd } = dayBounds(now);
  const userById = new Map(db.users.map((u) => [u.id, u]));
  const away: HomeAwayEntry[] = [];
  const external: HomeAwayEntry[] = [];
  const seenAway = new Set<string>();
  const seenExt = new Set<string>();
  for (const e of db.calendarEvents) {
    if (!overlapsToday(e, dayStart, dayEnd)) continue;
    const cls = classifyAway(e, viewer);
    if (!cls) continue;
    const name = userById.get(e.ownerId)?.name ?? e.ownerId;
    if (cls.kind === "away") {
      if (seenAway.has(name)) continue;
      seenAway.add(name);
      away.push({ name, when: awayWhen(e) });
    } else {
      if (seenExt.has(name)) continue;
      seenExt.add(name);
      external.push({ name, when: format(new Date(e.startAt), "HH:mm") });
    }
  }
  return { away, external };
}

/**
 * 오늘 사용자별 부재 라벨(데일리 미제출 카드용). owner **또는** attendee인 부재성 이벤트를 모은다
 * (홈 칩은 owner만 보지만, 데일리는 참석자 부재도 표기 — 명세 A).
 *
 * 마스킹은 **뷰어 무관**하게 적용한다(전사 공유 보드): 비공개는 항상 "자리비움"으로(원제목 노출 금지),
 * 공개(source=company)는 제목 그대로(예: "외근 — 웨스틴"). classifyAway(뷰어 의존)를 쓰지 않는 이유는,
 * canViewPrivateEventDetail=owner|admin이라 관리자 뷰에서 비공개 부재가 통째로 사라지거나(부재 사유가
 * 필요한 화면인데) 원제목이 노출될 수 있기 때문 — 명세 A의 "비공개면 자리비움"을 결정적으로 지킨다.
 * 한 사람이 여러 부재 이벤트를 가지면 라벨을 중복 제거해 " · "로 잇는다. 부재 없으면 맵에 없음.
 */
export function computeAbsenceByUser(db: Db, now: Date): Map<string, { label: string }> {
  const { dayStart, dayEnd } = dayBounds(now);
  const labels = new Map<string, string[]>();
  const push = (userId: string, label: string) => {
    const list = labels.get(userId) ?? [];
    if (!list.includes(label)) list.push(label);
    labels.set(userId, list);
  };
  for (const e of db.calendarEvents) {
    if (!overlapsToday(e, dayStart, dayEnd)) continue;
    let label: string;
    if (e.visibility === "private") label = "자리비움"; // 원제목 노출 금지(뷰어 무관 마스킹)
    else if (e.source === "company") label = e.title; // 공개 외부 일정 — 제목 그대로
    else continue; // 팀 공개 Que 일정(내부 회의 등)은 부재로 치지 않는다
    // owner + attendee 전원(부재 대상). attendee가 비활성/미상이어도 그대로 키로 둔다(호출부가 매칭).
    for (const uid of new Set<string>([e.ownerId, ...e.attendeeIds])) push(uid, label);
  }
  const out = new Map<string, { label: string }>();
  for (const [uid, list] of labels) out.set(uid, { label: list.join(" · ") });
  return out;
}

/**
 * 오늘 부재(자리비움·외부 일정)인 사용자 id 집합 — **시스템용**(뷰어 없음·마스킹 무관, 존재 여부만).
 * owner + attendee 모두 포함. 부재성 판정은 동일(비공개 OR source=company). 재촉 DM 스킵 판정에 쓴다.
 * classifyAway는 뷰어가 비공개 상세를 볼 수 있으면 부재로 치지 않으므로, 시스템 판정엔 부적합 —
 * 그래서 뷰어 무관하게 비공개를 곧 부재로 보는 이 전용 함수를 둔다.
 */
export function absentUserIdsToday(db: Db, now: Date): Set<string> {
  const { dayStart, dayEnd } = dayBounds(now);
  const ids = new Set<string>();
  for (const e of db.calendarEvents) {
    if (!overlapsToday(e, dayStart, dayEnd)) continue;
    if (e.visibility !== "private" && e.source !== "company") continue; // 부재성만
    ids.add(e.ownerId);
    for (const a of e.attendeeIds) ids.add(a);
  }
  return ids;
}
