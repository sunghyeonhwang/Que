"use server";

import { revalidatePath } from "next/cache";
import { formatProjectLabel, isQueRuleError, latestStatusLog, parseTaskInput } from "@que/core";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import { getDailyData } from "@/lib/daily-data";
import { getStandupData } from "@/lib/team-data";
import { generateAnalysis } from "@/lib/ai/gemini";
import { generateTeamSummary } from "@/lib/standup-summary";
import { getYesterdaySeeSummary } from "@/lib/dayblocks";

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

    const payload: Record<string, unknown> = {
      대상: `${user.name}(본인)`,
      "어제 완료": mine.yesterdayDone.map((t) => t.title),
      "어제 미완(이월 후보)": mine.yesterdayUnfinished.map((t) => t.title),
      "오늘 예정": mine.todayPlanned.map((t) => t.title),
      막힘: blockedDetail,
    };

    // DayBlocks 어제 See 회고가 있으면 초안 재료로 곁들인다(있을 때만 — 프롬프트 비대 금지, 실패는 무시).
    const seeReview = await getYesterdaySeeSummary(user.id, now);
    if (seeReview) payload["어제 개인 시간 회고"] = seeReview;

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

/** 회의 LLM 채팅 입력 파서(기획 §1-f) 확인 카드용 draft. 저장하지 않는다. */
export type MeetingCommandDraft =
  | {
      ok: true;
      intent: "create_milestone";
      title: string;
      dueAt?: string;
      projectId?: string;
      projectName?: string;
      /** 프로젝트 해석 실패·모호 시 후보 목록(선택). */
      projectCandidates?: { id: string; name: string }[];
      questions: string[];
    }
  | {
      ok: true;
      intent: "create_task";
      title: string;
      assigneeId?: string;
      assigneeName?: string;
      dueAt?: string;
      /** 담당자 해석 실패·모호 시 후보 목록(선택). */
      assigneeCandidates?: { id: string; name: string }[];
      questions: string[];
    }
  | { ok: false; error: string };

const MEETING_CMD_SYSTEM = [
  "너는 8명 규모 한국 회사의 회의 진행 액션 콘솔이다. 회의 중 진행자가 자연어로 말한 '신규 등록'을",
  "구조화한다. 지원 인텐트는 딱 둘: create_milestone(마일스톤 신규) · create_task(작업 신규).",
  "규칙:",
  "- 반드시 아래 JSON 스키마로만 답한다(코드펜스·설명 없이 JSON 객체 하나만):",
  '  {"intent": "create_milestone" | "create_task", "title": "제목", "projectName": "프로젝트명(마일스톤일 때)", "assigneeName": "담당자명(작업일 때, 없으면 빈 문자열)", "dueAt": "YYYY-MM-DDTHH:mm 또는 빈 문자열"}',
  "- 마일스톤이면 projectName을, 작업이면 assigneeName을 최대한 뽑는다. 불확실하면 빈 문자열.",
  "- dueAt은 날짜·시간이 분명할 때만 채운다(예: '8월 7일'→해당 연도 YYYY-08-07T10:00). 애매하면 빈 문자열.",
  "- 데이터에 없는 사실을 지어내지 않는다.",
].join("\n");

/** 이름/공백/대소문자를 무시한 느슨한 포함 매칭 키. */
function normKey(s: string): string {
  return s.replace(/\s+/g, "").toLowerCase();
}

/**
 * 회의 LLM 채팅 입력을 구조화한다(flash). 확인 카드용 draft를 반환하며 **저장하지 않는다**.
 * create_milestone(프로젝트 해석) · create_task(담당자 해석) 2종만 지원한다(과설계 금지).
 * 프로젝트/담당자 해석 실패 시 후보 목록을 함께 돌려준다. AI 실패 시 규칙 기반 parseTaskInput 폴백(작업).
 * 확정 실행은 기존 core mutation(createMilestoneAction·createTaskAction)이 담당한다 — 신규 실행 경로 없음.
 */
export async function parseMeetingCommandAction(text: string): Promise<MeetingCommandDraft> {
  const trimmed = text?.trim();
  if (!trimmed) return { ok: false, error: "입력이 비어 있습니다." };
  const user = await getCurrentUser();
  const now = new Date();
  const db = await getDb();

  const activeUsers = db.users.filter((u) => u.active !== false);
  const clientById = new Map(db.clients.map((c) => [c.id, c]));
  const activeProjects = db.projects.filter((p) => p.status === "active");
  const projectOptions = activeProjects.map((p) => ({
    id: p.id,
    name: formatProjectLabel(p, p.clientId ? clientById.get(p.clientId) : undefined),
    rawName: p.name,
    clientName: p.clientId ? clientById.get(p.clientId)?.name ?? "" : "",
  }));

  // 규칙 기반 작업 폴백(AI 실패 시 create_task로 강등).
  const taskFallback = (): MeetingCommandDraft => {
    const draft = parseTaskInput({ text: trimmed, users: activeUsers, now });
    return {
      ok: true,
      intent: "create_task",
      title: draft.title,
      assigneeId: draft.assigneeId ?? user.id,
      assigneeName: draft.assigneeName ?? user.name,
      dueAt: draft.startAt,
      questions: draft.questions,
    };
  };

  type ParsedCommand = {
    intent?: string;
    title?: string;
    projectName?: string;
    assigneeName?: string;
    dueAt?: string;
  };
  let parsed: ParsedCommand | null = null;
  try {
    const aiText = await generateAnalysis(
      MEETING_CMD_SYSTEM,
      JSON.stringify(
        {
          입력: trimmed,
          기준시각: now.toISOString(),
          "프로젝트 목록": projectOptions.map((p) => p.name),
          "담당자 목록": activeUsers.map((u) => u.name),
        },
        null,
        1,
      ),
      { model: "flash" },
    );
    const start = aiText.indexOf("{");
    const end = aiText.lastIndexOf("}");
    if (start !== -1 && end > start) {
      parsed = JSON.parse(aiText.slice(start, end + 1)) as ParsedCommand;
    }
  } catch {
    return taskFallback();
  }
  if (!parsed || !parsed.title?.trim()) return taskFallback();

  const title = parsed.title.trim().slice(0, 200);
  const dueAt = parsed.dueAt?.trim() || undefined;
  const questions: string[] = [];

  if (parsed.intent === "create_milestone") {
    // 프로젝트 해석 — 느슨한 포함 매칭(라벨·원제·클라이언트명).
    const wanted = normKey(parsed.projectName ?? "");
    let match = wanted
      ? projectOptions.find(
          (p) =>
            normKey(p.name).includes(wanted) ||
            normKey(p.rawName).includes(wanted) ||
            (p.clientName && normKey(p.clientName).includes(wanted)),
        )
      : undefined;
    // 역방향(입력이 프로젝트명을 포함) 백업 매칭.
    if (!match && wanted) {
      match = projectOptions.find((p) => wanted.includes(normKey(p.rawName)));
    }
    if (!dueAt) questions.push("마감일이 분명하지 않습니다 — 날짜를 확인해 주세요.");
    if (!match) {
      questions.push("프로젝트를 확정할 수 없습니다 — 후보에서 선택해 주세요.");
      return {
        ok: true,
        intent: "create_milestone",
        title,
        dueAt,
        projectName: parsed.projectName?.trim() || undefined,
        projectCandidates: projectOptions.map((p) => ({ id: p.id, name: p.name })),
        questions,
      };
    }
    return {
      ok: true,
      intent: "create_milestone",
      title,
      dueAt,
      projectId: match.id,
      projectName: match.name,
      questions,
    };
  }

  // create_task(기본).
  const wantedName = normKey(parsed.assigneeName ?? "");
  const assignee = wantedName
    ? activeUsers.find((u) => normKey(u.name).includes(wantedName) || wantedName.includes(normKey(u.name)))
    : undefined;
  if (!assignee && parsed.assigneeName?.trim()) {
    questions.push("담당자를 확정할 수 없습니다 — 후보에서 선택해 주세요.");
    return {
      ok: true,
      intent: "create_task",
      title,
      dueAt,
      assigneeName: parsed.assigneeName.trim(),
      assigneeCandidates: activeUsers.map((u) => ({ id: u.id, name: u.name })),
      questions,
    };
  }
  return {
    ok: true,
    intent: "create_task",
    title,
    dueAt,
    // 담당자 미지정이면 본인 작업(parseTaskInput 관례 정합).
    assigneeId: assignee?.id ?? user.id,
    assigneeName: assignee?.name ?? user.name,
    questions,
  };
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
