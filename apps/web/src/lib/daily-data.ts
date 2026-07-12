import type { StandupEntry, StandupTeamSummary, User } from "@que/core";
import { keyResultProgress } from "@que/core";
import { getDb } from "./db";
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

  const members: DailyMemberEntry[] = db.users
    .filter((u) => u.active !== false)
    .map((u) => {
      const entry = entryByUser.get(u.id);
      return {
        user: u,
        entry,
        submitted: Boolean(entry),
        krChips: (krByOwner.get(u.id) ?? []).slice(0, 2),
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
