import type { StandupEntry, User } from "@que/core";
import { getDb } from "./db";
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

export interface DailyMemberEntry {
  user: User;
  /** 오늘 제출한 체크인(없으면 미제출). */
  entry?: StandupEntry;
  submitted: boolean;
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

  const members: DailyMemberEntry[] = db.users
    .filter((u) => u.active !== false)
    .map((u) => {
      const entry = entryByUser.get(u.id);
      return { user: u, entry, submitted: Boolean(entry) };
    });

  return {
    date,
    members,
    submittedCount: members.filter((m) => m.submitted).length,
    totalCount: members.length,
    myStandup: rowByUser.get(user.id),
    myEntry: entryByUser.get(user.id),
  };
}
