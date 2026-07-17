import { format } from "date-fns";
import { ko } from "date-fns/locale";
import type { StandupEntry, User } from "@que/core";
import { getDb } from "./db";
import { kstDateKey } from "./daily-data";

// 주간 회고 데이터(명세 D) — 조회 전용(쓰기 없음). 한 주(월~금)의 스탠드업을 되돌아보는 화면용.
// 전사 리듬이라 클라이언트 필터와 무관하게 전원을 본다. `?week=YYYY-MM-DD`(그 주 월요일) 계약.
//
// 한계(정직하게 명시):
//  - "완료 작업 수"는 statusLog(toStatus=done)를 그 주 범위·현 담당자 기준으로 집계한다. 그 주에
//    재오픈→재완료가 있으면 2회로 세질 수 있다(드묾). 파생 4분면 snapshot 합산은 어제기준 이월이 섞여
//    더 부정확해 택하지 않았다.
//  - "막힘 해소 여부"는 단정하지 않는다. 마지막 언급일 이후 그 사람이 다시 체크인했는데 재언급이 없으면
//    "이후 언급 없음"으로만 표기한다(해소 추정 — 실제 종결 여부는 알 수 없다).

/** 일자별 제출 현황(월~금). */
export interface WeeklyRetroDay {
  /** YYYY-MM-DD(KST). */
  date: string;
  /** "월"·"화"… 요일 라벨. */
  label: string;
  /** 그날 제출 인원. */
  submitted: number;
  /** 활성 전원 수(분모). */
  total: number;
}

/** 사람별 그 주 요약. */
export interface WeeklyRetroPerson {
  userId: string;
  userName: string;
  avatarColor?: string;
  /** 뷰어 본인 여부(프론트 하이라이트용). */
  isMe: boolean;
  /** 그 주 제출한 포커스 목록(제출일 오름차순). */
  focuses: { date: string; focus: string }[];
  /** 그 주 완료한 작업 수(statusLog 기준 — 한계는 파일 주석 참고). */
  doneCount: number;
  /** 그 주 제출한 날 수(0~5). */
  submittedDays: number;
}

/** 그 주 막힘 1건과 해소 추정. */
export interface WeeklyRetroBlocker {
  userId: string;
  userName: string;
  /** 막힘 표기 — 연결 작업이 있으면 작업 제목, 없으면 자유 서술. */
  text: string;
  /** 그 주 마지막으로 언급된 날짜(YYYY-MM-DD). */
  lastMentionedDate: string;
  /** 마지막 언급 이후 그 주에 재언급 없이 다시 체크인했으면 true("이후 언급 없음"). 단정 아님. */
  unmentionedSince: boolean;
}

/** 그 주 AI 팀 요약 1건(일자별). */
export interface WeeklyRetroSummaryRow {
  date: string;
  content: string;
  model: "flash" | "pro";
}

export interface WeeklyRetroData {
  /** 그 주 월요일(YYYY-MM-DD). */
  weekStart: string;
  /** 그 주 금요일(YYYY-MM-DD). */
  weekEnd: string;
  /** "7월 14일 ~ 18일" 형태 라벨. */
  weekLabel: string;
  /** 월~금 5일 제출 현황. */
  days: WeeklyRetroDay[];
  /** 활성 전원 사람별 요약. */
  people: WeeklyRetroPerson[];
  /** 그 주 막힘 목록(해소 추정 포함). */
  blockers: WeeklyRetroBlocker[];
  /** 그 주 AI 팀 요약(일자 오름차순). */
  summaries: WeeklyRetroSummaryRow[];
}

/** d가 속한 주의 월요일 00:00(KST 로컬). */
function mondayOf(d: Date): Date {
  const m = new Date(d);
  m.setHours(0, 0, 0, 0);
  const dow = m.getDay(); // 0=일..6=토
  const diff = dow === 0 ? -6 : 1 - dow; // 월요일로 보정(일요일은 지난 월요일)
  m.setDate(m.getDate() + diff);
  return m;
}

/** weekAnchor(YYYY-MM-DD) 검증 → 그 주 월요일 Date. 어긋나면 now 기준 주. */
function resolveMonday(weekAnchor: string | undefined, now: Date): Date {
  if (weekAnchor && /^\d{4}-\d{2}-\d{2}$/.test(weekAnchor)) {
    const parsed = new Date(`${weekAnchor}T12:00:00`); // 정오로 파싱해 경계 흔들림 방지
    if (!Number.isNaN(parsed.getTime())) return mondayOf(parsed);
  }
  return mondayOf(now);
}

/** 막힘 신호 판정(daily-data blockerOf와 동일 사상). ids 집합도 반환. */
function blockerOf(entry: StandupEntry): { has: boolean; ids: string[] } {
  const ids = entry.blockedTaskIds ?? [];
  const has = ids.length > 0 || Boolean(entry.blockerText && entry.blockerText.trim());
  return { has, ids };
}

/**
 * 주간 회고 데이터. viewer는 본인 하이라이트(isMe)·시그니처 정합용(마스킹 대상 없음 — 막힘은 본인 서술).
 * @param weekAnchor 그 주 월요일(YYYY-MM-DD). 미지정이면 now가 속한 주.
 */
export async function getWeeklyRetroData(
  viewer: User,
  weekAnchor?: string,
  now: Date = new Date(),
): Promise<WeeklyRetroData> {
  const db = await getDb();
  const monday = resolveMonday(weekAnchor, now);

  // 월~금 5영업일 키.
  const dayDates: Date[] = [];
  for (let i = 0; i < 5; i += 1) {
    const d = new Date(monday);
    d.setDate(d.getDate() + i);
    dayDates.push(d);
  }
  const dayKeys = dayDates.map((d) => kstDateKey(d));
  const weekStart = dayKeys[0];
  const weekEnd = dayKeys[dayKeys.length - 1];
  const inWeek = (key: string) => key >= weekStart && key <= weekEnd;

  const activeUsers = db.users.filter((u) => u.active !== false);
  const total = activeUsers.length;
  const DOW_LABELS = ["월", "화", "수", "목", "금"];

  // ⑴ 일자별 제출 현황.
  const days: WeeklyRetroDay[] = dayKeys.map((date, i) => ({
    date,
    label: DOW_LABELS[i],
    submitted: db.standupEntriesByDate(date).length,
    total,
  }));

  // 그 주 전체 체크인(벌크 필터).
  const weekEntries = db.standupEntries.filter((e) => inWeek(e.date));
  const entriesByUser = new Map<string, StandupEntry[]>();
  for (const e of weekEntries) {
    const list = entriesByUser.get(e.userId) ?? [];
    list.push(e);
    entriesByUser.set(e.userId, list);
  }

  // 완료 작업 수: statusLog(done) 그 주 범위 + 현 담당자 기준(home-grade-data doneThisWeek와 같은 소스).
  const taskById = new Map(db.tasks.map((t) => [t.id, t]));
  const doneByUser = new Map<string, number>();
  for (const log of db.statusLogs) {
    if (log.toStatus !== "done") continue;
    if (!inWeek(kstDateKey(new Date(log.createdAt)))) continue;
    const task = taskById.get(log.taskId);
    if (!task) continue;
    doneByUser.set(task.assigneeId, (doneByUser.get(task.assigneeId) ?? 0) + 1);
  }

  // ⑵ 사람별 요약.
  const people: WeeklyRetroPerson[] = activeUsers.map((u) => {
    const mine = (entriesByUser.get(u.id) ?? []).slice().sort((a, b) => a.date.localeCompare(b.date));
    return {
      userId: u.id,
      userName: u.name,
      avatarColor: u.avatarColor,
      isMe: u.id === viewer.id,
      focuses: mine.map((e) => ({ date: e.date, focus: e.focus })),
      doneCount: doneByUser.get(u.id) ?? 0,
      submittedDays: mine.length,
    };
  });

  // ⑶ 막힘 목록 + 해소 추정. 연결 작업이 있으면 (user,taskId)별, 없으면 자유서술 (user)별로 묶는다.
  const nameOf = (id: string) => db.users.find((u) => u.id === id)?.name ?? id;
  const submittedDatesByUser = new Map<string, string[]>();
  for (const [uid, list] of entriesByUser) {
    submittedDatesByUser.set(uid, list.map((e) => e.date).sort());
  }
  const blockerGroups = new Map<string, { userId: string; text: string; dates: string[] }>();
  for (const e of weekEntries) {
    const blk = blockerOf(e);
    if (!blk.has) continue;
    if (blk.ids.length > 0) {
      for (const taskId of blk.ids) {
        const sig = `t:${e.userId}:${taskId}`;
        const g = blockerGroups.get(sig) ?? {
          userId: e.userId,
          text: taskById.get(taskId)?.title ?? "연결 작업",
          dates: [],
        };
        g.dates.push(e.date);
        blockerGroups.set(sig, g);
      }
    } else {
      const sig = `u:${e.userId}`;
      const g = blockerGroups.get(sig) ?? { userId: e.userId, text: "", dates: [] };
      // 자유 서술은 마지막 언급 텍스트로 갱신(최신이 대표).
      g.text = e.blockerText?.trim() || g.text || "막힘(서술)";
      g.dates.push(e.date);
      blockerGroups.set(sig, g);
    }
  }
  const blockers: WeeklyRetroBlocker[] = [...blockerGroups.values()].map((g) => {
    const sorted = g.dates.slice().sort();
    const lastMentionedDate = sorted[sorted.length - 1];
    // 마지막 언급 이후 그 사람이 다시 체크인했는지(재언급 없이) → "이후 언급 없음".
    const userDates = submittedDatesByUser.get(g.userId) ?? [];
    const unmentionedSince = userDates.some((d) => d > lastMentionedDate);
    return {
      userId: g.userId,
      userName: nameOf(g.userId),
      text: g.text,
      lastMentionedDate,
      unmentionedSince,
    };
  });
  // 오래 끈 막힘(첫 언급이 이른 것) 우선, 그다음 미해소 우선.
  blockers.sort(
    (a, b) =>
      a.lastMentionedDate.localeCompare(b.lastMentionedDate) ||
      Number(a.unmentionedSince) - Number(b.unmentionedSince),
  );

  // ⑷ 그 주 AI 팀 요약(일자 오름차순).
  const summaries: WeeklyRetroSummaryRow[] = db.standupTeamSummaries
    .filter((s) => inWeek(s.date))
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((s) => ({ date: s.date, content: s.content, model: s.model }));

  const weekLabel = `${format(dayDates[0], "M월 d일", { locale: ko })} ~ ${format(dayDates[4], "M월 d일", { locale: ko })}`;

  return { weekStart, weekEnd, weekLabel, days, people, blockers, summaries };
}
