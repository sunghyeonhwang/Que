import type { User } from "@que/core";
import { kstDateKey } from "./daily-data";
import { getDb } from "./db";

// 홈 온보딩 카드("이번 주는 이것만") 전용 조회 계층. 순수 조회 — mutation에 손대지 않는다.
// 기획 근거: que+/onboarding-plan.md §4-1 (베타 첫 1~2주 홈 상단 안내).

// 노출 종료일(KST, YYYY-MM-DD). 이 날까지 노출하고, 이후로는 서버에서 아예 렌더하지 않는다.
// 베타 시작 전(지금~7/19)에도 팀이 미리 보도록 시작일은 두지 않고 종료일만 상수화한다.
export const ONBOARDING_UNTIL = "2026-08-02";

/** now(KST)가 노출 기간 안인지(오늘 <= 종료일). 문자열 날짜키 사전식 비교라 안전하다. */
export function isOnboardingActive(now: Date = new Date()): boolean {
  return kstDateKey(now) <= ONBOARDING_UNTIL;
}

export interface OnboardingData {
  /** ① 오늘(KST) 내 스탠드업 체크인이 제출됨. */
  checkedIn: boolean;
  /** ② 최근 7일 안에 내가 내 작업을 done으로 바꾼 기록이 있음. */
  markedDone: boolean;
  /** ③ 최근 7일 안에 내 스탠드업에 막힘 서술을 남긴 적 있음(강제 아님 — 긍정 표시용). */
  sharedBlocker: boolean;
}

export async function getOnboardingData(
  user: User,
  now: Date = new Date(),
): Promise<OnboardingData> {
  const db = await getDb();
  const today = kstDateKey(now);
  const weekAgoKey = kstDateKey(new Date(now.getTime() - 7 * 864e5));
  const weekAgoMs = now.getTime() - 7 * 864e5;

  // ① 오늘 체크인: alerts-data의 미체크인 판정과 같은 소스(standupEntriesByDate).
  const checkedIn = db
    .standupEntriesByDate(today)
    .some((e) => e.userId === user.id);

  // ② 완료 체크: 상태 로그에서 actor=나 & to=done & 최근 7일.
  // actor=나인 done 전환이면 인정 — 관리자가 타인 작업을 처리한 경우도 '완료 체크 습관' 신호로 유효.
  const markedDone = db.statusLogs.some(
    (l) =>
      l.actorId === user.id &&
      l.toStatus === "done" &&
      new Date(l.createdAt).getTime() >= weekAgoMs,
  );

  // ③ 막힘 공유: 최근 7일 내 스탠드업 중 막힘 서술이 비어있지 않은 것(강제 아님).
  const sharedBlocker = db.standupEntries.some(
    (e) =>
      e.userId === user.id &&
      e.date >= weekAgoKey &&
      !!e.blockerText &&
      e.blockerText.trim().length > 0,
  );

  return { checkedIn, markedDone, sharedBlocker };
}
