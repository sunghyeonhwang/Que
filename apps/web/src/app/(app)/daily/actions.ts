"use server";

import { revalidatePath } from "next/cache";
import { isQueRuleError, latestStatusLog } from "@que/core";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import { getDailyData } from "@/lib/daily-data";
import { getStandupData } from "@/lib/team-data";
import { generateAnalysis } from "@/lib/ai/gemini";
import { generateTeamSummary } from "@/lib/standup-summary";

export type ActionResult = { ok: true } | { ok: false; error: string };

/** getDb()가 반환하는 DB 인스턴스 타입 (mock 또는 supabase 어댑터). */
type Db = Awaited<ReturnType<typeof getDb>>;

// db 인스턴스를 한 번만 획득해 mutation과 persist를 같은 인스턴스에서 수행한다.
// (getDb의 요청 캐시 정체성에 기대면 서버 액션 경계에서 다른 인스턴스가 잡혀 persist가 유실된다 —
//  반드시 콜백에 넘어온 db로만 작업할 것. today/actions.ts와 동일한 계약.)
async function toResult<T>(fn: (db: Db) => Promise<T> | T): Promise<ActionResult> {
  try {
    const db = await getDb();
    await fn(db);
    await db.persist();
    revalidatePath("/daily");
    return { ok: true };
  } catch (error) {
    if (isQueRuleError(error)) return { ok: false, error: error.message };
    throw error;
  }
}

/**
 * 스탠드업 체크인 제출/재제출. 본인만(userId는 서버 세션에서 강제 — 대리 제출 차단).
 * date와 snapshotTaskIds(제출 시점 파생 4분면 동결)는 클라이언트를 신뢰하지 않고 서버에서 계산한다.
 * (date, userId) 유니크 — 이미 있으면 core가 덮어쓴다.
 */
export async function submitStandupEntryAction(input: {
  focus: string;
  note?: string;
  blockerText?: string;
  blockedTaskIds?: string[];
  aiDrafted?: boolean;
  draftEdited?: boolean;
}): Promise<ActionResult> {
  const user = await getCurrentUser();
  const now = new Date();
  // 제출 시점 파생 4분면(어제 완료/미완·오늘 예정)의 Task id만 동결한다(기획 §2). 서버 권위 계산.
  const daily = await getDailyData(user, now);
  const mine = daily.myStandup;
  const snapshotTaskIds = {
    yesterdayDone: (mine?.yesterdayDone ?? []).map((t) => t.id),
    yesterdayUnfinished: (mine?.yesterdayUnfinished ?? []).map((t) => t.id),
    todayPlanned: (mine?.todayPlanned ?? []).map((t) => t.id),
  };
  return toResult((db) =>
    db.submitStandupEntry(
      { actorId: user.id, via: "web" },
      {
        date: daily.date,
        focus: input.focus,
        note: input.note,
        blockerText: input.blockerText,
        blockedTaskIds: input.blockedTaskIds,
        snapshotTaskIds,
        aiDrafted: input.aiDrafted,
        draftEdited: input.draftEdited,
      },
    ),
  );
}

export interface StandupDraftResult {
  ok: boolean;
  /** 오늘의 포커스 초안. */
  focus?: string;
  /** 부연 초안. */
  note?: string;
  /** 막힘 서술 초안. */
  blocker?: string;
}

const DRAFT_SYSTEM = [
  "너는 8명 규모 한국 회사의 데일리 스탠드업 진행 보조다. 로그인한 '본인'의 오늘 작업 데이터만 근거로,",
  "비동기 스탠드업 체크인 초안을 만든다. 감시가 아니라 본인이 빠르게 다듬어 제출할 밑그림이다.",
  "규칙:",
  "- 반드시 한국어 존댓말. 데이터에 없는 사실을 지어내지 않는다.",
  "- 아래 JSON 스키마로만 답한다(코드펜스·설명 없이 JSON 객체 하나만):",
  '  {"focus": "오늘의 포커스 한마디(1문장, 100자 이내)", "note": "부연(선택, 없으면 빈 문자열)", "blocker": "막힌 것 서술(없으면 빈 문자열)"}',
  "- focus는 오늘 예정/이월 작업 중 가장 중요한 것을 한 문장으로. note는 짧게. blocker는 issue/on_hold 작업이 있을 때만.",
].join("\n");

/**
 * AI 개인 초안(flash). 내 파생 4분면 + 막힘 사유를 근거로 focus/note/blocker 초안을 생성해 반환한다.
 * **저장하지 않는다** — 프론트가 폼에 프리필하고, 사람이 확인·편집 후 제출해야 저장된다(AI는 확인을 거쳐 저장).
 * 실패(키 미설정·파싱 실패 등)하면 { ok:false } — 폼은 빈 채로 정상 동작한다.
 */
export async function generateStandupDraftAction(): Promise<StandupDraftResult> {
  const user = await getCurrentUser();
  const now = new Date();
  try {
    const db = await getDb();
    const rows = await getStandupData(now);
    const mine = rows.find((r) => r.user.id === user.id);
    if (!mine) return { ok: false };

    // 막힌 작업의 최신 사유를 곁들여 초안 품질을 높인다(문제/홀드 상세 계약과 연결).
    const blockedDetail = mine.blocked.map((t) => {
      const log = latestStatusLog(db.statusLogs, t.id, t.status);
      return { 제목: t.title, 상태: t.status, 사유: log?.reason ?? "", "다음 액션": log?.nextAction ?? "" };
    });

    const payload = {
      대상: `${user.name}(본인)`,
      "어제 완료": mine.yesterdayDone.map((t) => t.title),
      "어제 미완(이월 후보)": mine.yesterdayUnfinished.map((t) => t.title),
      "오늘 예정": mine.todayPlanned.map((t) => t.title),
      막힘: blockedDetail,
    };

    const text = await generateAnalysis(DRAFT_SYSTEM, JSON.stringify(payload, null, 1), {
      model: "flash",
    });
    const parsed = parseDraftJson(text);
    if (!parsed) return { ok: false };
    return {
      ok: true,
      focus: parsed.focus || undefined,
      note: parsed.note || undefined,
      blocker: parsed.blocker || undefined,
    };
  } catch {
    return { ok: false };
  }
}

/**
 * AI 팀 요약 재생성(pro, flash 폴백) — **admin만**(3중 방어: 메뉴/UI 숨김 + 이 서버 액션 + 시스템 생성 관례).
 * 오늘 날짜의 요약을 새로 만들어 date 유니크로 덮어쓴다(regeneratedBy=본인). 저장·persist는 generateTeamSummary가 한다.
 * 실패(AI 키 미설정·생성 실패)면 { ok:false, error } — 보드는 기존 요약(있으면) 그대로 유지된다.
 */
export async function regenerateTeamSummaryAction(): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (user.role !== "admin") {
    return { ok: false, error: "팀 요약 재생성은 관리자만 할 수 있습니다." };
  }
  try {
    const db = await getDb();
    await generateTeamSummary(db, new Date(), user.id);
    revalidatePath("/daily");
    return { ok: true };
  } catch (error) {
    if (isQueRuleError(error)) return { ok: false, error: error.message };
    const message = error instanceof Error ? error.message : "팀 요약 재생성에 실패했습니다.";
    return { ok: false, error: message };
  }
}

/** AI 응답에서 JSON 객체를 관대하게 추출·파싱한다(코드펜스·잡텍스트 방어). 실패 시 null. */
function parseDraftJson(text: string): { focus: string; note: string; blocker: string } | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    const obj = JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
    const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
    return { focus: str(obj.focus), note: str(obj.note), blocker: str(obj.blocker) };
  } catch {
    return null;
  }
}
