import type { StandupEntry, StandupTeamSummary, User } from "@que/core";
import { keyResultProgress } from "@que/core";
import { getDb } from "./db";
import { computeAbsenceByUser } from "./away";
import { currentMonthKey } from "./okr-data";
import { getStandupData, type StandupRow } from "./team-data";

// 데일리 스탠드업 "오늘 보드"용 데이터 조합(기획 §4). 전사 리듬이라 클라이언트 필터와 무관하게
// 전원을 대상으로 한다. 저장된 것은 "사람이 쓴 말"(standup_entries)뿐이고, 어제/오늘/막힘 4분면은
// 기존 getStandupData 파생을 계속 쓴다(기획 §2 — 파생은 저장하지 않는다).

/** KST(Asia/Seoul, instrumentation.ts에서 TZ 고정) 로컬 날짜 키(YYYY-MM-DD). UTC 변환 금지. */
export function kstDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** ISO datetime의 KST 날짜 키('yyyy-MM-dd', TZ 고정 하 로컬 기준). 파싱 실패 시 "".
 *  crisis·meeting-agenda·meeting-minutes·milestone-agenda가 공유한다(4중 복제 통합 — 글래도스 이월). */
export function dateKeyOfIso(iso: string): string {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return "";
  return kstDateKey(new Date(ms));
}

/** 스탠드업 카드 하단 KR 진척 칩(기획 §7 Phase 4). */
export interface DailyKrChip {
  title: string;
  /** 진척률 0~100(keyResultProgress 하이브리드 계산기). */
  progress: number;
}

export interface DailyMemberEntry {
  user: User;
  /** 오늘 제출한 체크인(없으면 미제출). */
  entry?: StandupEntry;
  submitted: boolean;
  /** 이 사람의 이번 달 활성 KR 진척 칩(최대 2개). KR 없으면 빈 배열. */
  krChips: DailyKrChip[];
  /** 미제출자 카드용 오늘 부재 표기(명세 A). 부재 없으면 undefined. 비공개는 "자리비움"으로 마스킹. */
  absence?: { label: string };
  /** 제출자 카드용 연속 막힘 일수(명세 B, 영업일 기준·오늘=1). 오늘 막힘 없으면 undefined. */
  blockerStreak?: number;
}

export interface DailyData {
  /** 오늘 날짜 키(KST YYYY-MM-DD). */
  date: string;
  /** 전원(8인) 카드 — 제출/미제출. */
  members: DailyMemberEntry[];
  submittedCount: number;
  totalCount: number;
  /** 내 파생 4분면(어제 완료/미완·오늘 예정·막힘). 폼 프리필·표시용. */
  myStandup?: StandupRow;
  /** 내 오늘 체크인(제출 전이면 undefined). */
  myEntry?: StandupEntry;
  /** 오늘 AI 팀 요약(생성 전이면 undefined). 생성 즉시 저장 예외 엔티티(기획 §2). */
  teamSummary?: StandupTeamSummary;
}

/** 체크인의 막힘 신호: blockerText(비공백) 또는 blockedTaskIds(비어있지 않음). ids 집합도 함께 반환. */
function blockerOf(entry: StandupEntry): { has: boolean; ids: Set<string> } {
  const ids = new Set(entry.blockedTaskIds ?? []);
  const has = ids.size > 0 || Boolean(entry.blockerText && entry.blockerText.trim());
  return { has, ids };
}

/** now(오늘 제외)에서 역방향으로 영업일(주말 스킵) 날짜 키를 count개 만든다. 금→목→…(가까운 순). */
function previousBusinessDayKeys(now: Date, count: number): string[] {
  const keys: string[] = [];
  const d = new Date(now);
  d.setHours(12, 0, 0, 0); // 자정 경계·시각 흔들림 방지(KST 고정, DST 없음)
  // 상한 count*3: 주말이 많아도 유한 종료(무한 역추적 방지).
  for (let guard = 0; keys.length < count && guard < count * 3; guard += 1) {
    d.setDate(d.getDate() - 1);
    const dow = d.getDay(); // 0=일, 6=토 — 주말 스킵(금→월 연속 정합)
    if (dow === 0 || dow === 6) continue;
    keys.push(kstDateKey(d));
  }
  return keys;
}

/**
 * fromIso(생성 시각) 이후 now까지 **경과 영업일**(KST, 주말 스킵). 생성 다음 영업일부터 오늘까지를 센다.
 * 오늘 생성(또는 미래)=0, 어제(영업일) 생성=1, 금요일 생성·오늘 월요일=1(주말 스킵). 파싱 실패=0.
 * 명세 A-1(미처리 Action 에이징)·B-6(팔로업) 공유. computeBlockerStreaks의 영업일 산술과 같은 술어(주말=0/6 스킵).
 */
export function businessDaysElapsed(fromIso: string, now: Date): number {
  const ms = Date.parse(fromIso);
  if (Number.isNaN(ms)) return 0;
  const from = new Date(ms);
  from.setHours(12, 0, 0, 0); // 자정 경계·시각 흔들림 방지(KST 고정, DST 없음)
  const today = new Date(now);
  today.setHours(12, 0, 0, 0);
  const todayKey = kstDateKey(today);
  if (kstDateKey(from) >= todayKey) return 0; // 오늘/미래 생성
  let count = 0;
  const d = new Date(from);
  // 상한: 무한 방지(약 10년). 생성 다음날부터 오늘까지 평일만 카운트.
  for (let guard = 0; guard < 3660; guard += 1) {
    d.setDate(d.getDate() + 1);
    const dow = d.getDay(); // 0=일, 6=토 — 주말 스킵
    if (dow !== 0 && dow !== 6) count += 1;
    if (kstDateKey(d) >= todayKey) break;
  }
  return count;
}

/** 역추적 상한(영업일). 무한 역추적 방지 — 14영업일(약 3주)이면 "장기 막힘"으로 충분. */
const BLOCKER_STREAK_LOOKBACK_BUSINESS_DAYS = 14;

/**
 * 연속 막힘 일수(명세 B) — 오늘 막힘이 있는 사용자별. 오늘=1, 과거 체크인을 영업일 역순으로 훑어
 * 연속 막힘 일수를 센다. 연속 판정:
 *  - 오늘·과거 둘 다 blockedTaskIds가 있으면 **교집합**이 있어야 같은 막힘으로 이어짐.
 *  - 둘 중 하나라도 ids가 없으면(자유 서술 포함) **막힘 존재 여부**로 판정(단순 우선).
 * 과거 영업일에 제출이 없으면(체크인 부재) 연속이 끊긴 것으로 본다(재현 불가 → 보수적).
 * @param allEntries 전체 체크인(db.standupEntries) — 범위 일괄 필터로 날짜 단건 반복 조회를 피한다.
 * @returns userId → 연속 일수(오늘 막힘이 없는 사용자는 맵에 없음).
 */
export function computeBlockerStreaks(allEntries: StandupEntry[], now: Date): Map<string, number> {
  const todayKey = kstDateKey(now);
  const prevKeys = previousBusinessDayKeys(now, BLOCKER_STREAK_LOOKBACK_BUSINESS_DAYS);
  const wanted = new Set<string>([todayKey, ...prevKeys]);

  // 관심 날짜 범위만 사용자별로 모은다(단일 패스, 벌크).
  const byUser = new Map<string, Map<string, StandupEntry>>();
  for (const e of allEntries) {
    if (!wanted.has(e.date)) continue;
    let m = byUser.get(e.userId);
    if (!m) {
      m = new Map();
      byUser.set(e.userId, m);
    }
    m.set(e.date, e);
  }

  const out = new Map<string, number>();
  for (const [userId, m] of byUser) {
    const todayEntry = m.get(todayKey);
    if (!todayEntry) continue;
    const today = blockerOf(todayEntry);
    if (!today.has) continue; // 오늘 막힘 없음 → streak 없음
    let streak = 1;
    for (const key of prevKeys) {
      const e = m.get(key);
      if (!e) break; // 제출 없음 → 연속 끊김
      const b = blockerOf(e);
      if (!b.has) break; // 그날 막힘 없음 → 연속 종료
      const sameBlocker =
        today.ids.size > 0 && b.ids.size > 0
          ? [...today.ids].some((id) => b.ids.has(id)) // 둘 다 ids → 교집합
          : true; // 한쪽이라도 ids 없음 → 막힘 존재로 이어짐
      if (!sameBlocker) break;
      streak += 1;
    }
    out.set(userId, streak);
  }
  return out;
}

/** 오늘 스탠드업 보드 데이터. 전사 대상(클라이언트 필터 무관). */
export async function getDailyData(user: User, now: Date = new Date()): Promise<DailyData> {
  const db = await getDb();
  const date = kstDateKey(now);
  const entries = db.standupEntriesByDate(date);
  const entryByUser = new Map(entries.map((e) => [e.userId, e]));

  // 파생 4분면은 전사 스코프(clientId 미지정)로 계산한다 — 전 인원 카드가 자기 데이터를 갖도록.
  const standupRows = await getStandupData(now);
  const rowByUser = new Map(standupRows.map((r) => [r.user.id, r]));

  // 이번 달 활성 KR을 owner별로 묶어(최대 2개) 카드 하단 진척 칩으로 내려보낸다(기획 §7 Phase 4).
  // 진척은 저장하지 않고 keyResultProgress 단일 계산기로 파생한다(OKR 탭과 동일).
  const month = currentMonthKey(now);
  const krByOwner = new Map<string, DailyKrChip[]>();
  for (const kr of db.keyResults) {
    if (kr.month !== month || kr.status !== "active") continue;
    const list = krByOwner.get(kr.ownerId) ?? [];
    list.push({ title: kr.title, progress: keyResultProgress(kr, db.tasks) });
    krByOwner.set(kr.ownerId, list);
  }

  // 부재(미제출 카드용)·연속 막힘(제출 카드용)은 전체 데이터에서 벌크로 한 번씩 계산한다.
  // 부재는 전사 공유 보드라 뷰어 무관 마스킹(비공개→"자리비움" 항상).
  const absenceByUser = computeAbsenceByUser(db, now);
  const streakByUser = computeBlockerStreaks(db.standupEntries, now);

  const members: DailyMemberEntry[] = db.users
    .filter((u) => u.active !== false)
    .map((u) => {
      const entry = entryByUser.get(u.id);
      const submitted = Boolean(entry);
      return {
        user: u,
        entry,
        submitted,
        krChips: (krByOwner.get(u.id) ?? []).slice(0, 2),
        // 부재는 미제출자 카드에만(제출자는 부재로 표기하지 않는다 — 명세 A).
        absence: !submitted ? absenceByUser.get(u.id) : undefined,
        // 연속 막힘은 제출자 카드에만(오늘 막힘이 있는 사람만 맵에 존재).
        blockerStreak: submitted ? streakByUser.get(u.id) : undefined,
      };
    });

  return {
    date,
    members,
    submittedCount: members.filter((m) => m.submitted).length,
    totalCount: members.length,
    myStandup: rowByUser.get(user.id),
    myEntry: entryByUser.get(user.id),
    teamSummary: db.standupTeamSummaryByDate(date),
  };
}
