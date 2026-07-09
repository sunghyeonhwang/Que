"use server";

import { revalidatePath } from "next/cache";
import { isQueRuleError, type StatusDetail, type Task } from "@que/core";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import { notifyTaskStatusChanged } from "@/lib/notifications/dispatch";
import {
  helpNamesOf,
  milestoneRowFormatErrors,
  parseMilestonesCsv,
  parseTasksCsv,
  taskRowFormatErrors,
  type ImportResult,
  type ImportRowResult,
  type MilestoneImportRow,
  type TaskImportRow,
} from "@/lib/import/csv";

// 설정 › 가져오기 — CSV 일괄 등록 서버 액션 (data/imports 템플릿과 1:1).
// 원본 CSV 텍스트를 받아 서버에서 파싱→이름 해석→core mutation까지 전부 수행한다(클라 결과 신뢰 금지).
// - mode="preview": 파싱·이름 해석·형식 검증까지만(dry-run). 등록 전 확인 카드 원칙(CLAUDE.md)의 CSV판.
// - mode="commit": 행별로 core createTask/createMilestone(+상태 변경) 실행. 규칙·권한·ChangeLog(via:"web")는
//   core가 그대로 강제하고, 실패 행은 건너뛰고 사유를 남긴다(부분 성공 허용).
// - 알림 정책(개별 생성 경로와 다른 점 — 결과 화면·도움말에 명시):
//   · notifyTaskCreated(담당자 개인 DM)는 의도적으로 호출하지 않는다 — 대량 등록 DM 폭탄 방지.
//   · notifyTaskStatusChanged(팀 채널 병목 알림)는 홀드/문제발생 행에 한해 **발송한다** —
//     병목을 빨리 드러내는 것이 Que의 존재 이유라, 임포트로 들어온 병목도 조용히 묻히면 안 된다.

type Db = Awaited<ReturnType<typeof getDb>>;
type ImportMode = "preview" | "commit";

// ---------- 이름 → id 해석 ----------

/** 재직자 이름 → 유저. 0건/동명이인은 오류 문자열 반환. */
function resolveUser(db: Db, name: string): { id: string } | { error: string } {
  const matches = db.users.filter((u) => u.active !== false && u.name === name);
  if (matches.length === 1) return { id: matches[0].id };
  if (matches.length === 0) return { error: `담당자를 찾을 수 없습니다: ${name}` };
  return { error: `동명이인이 있습니다: ${name} — 관리자에게 문의하세요` };
}

/** 프로젝트명(+클라이언트명) → 프로젝트. 활성 프로젝트만 대상. */
function resolveProject(
  db: Db,
  projectName: string,
  clientName: string,
): { id: string } | { error: string } {
  let candidates = db.projects.filter((p) => p.status === "active" && p.name === projectName);
  if (clientName) {
    const clients = db.clients.filter((c) => c.name === clientName);
    if (clients.length === 0) return { error: `클라이언트를 찾을 수 없습니다: ${clientName}` };
    const clientIds = new Set(clients.map((c) => c.id));
    candidates = candidates.filter((p) => p.clientId && clientIds.has(p.clientId));
  }
  if (candidates.length === 1) return { id: candidates[0].id };
  if (candidates.length === 0) {
    return {
      error: clientName
        ? `프로젝트를 찾을 수 없습니다: ${clientName} › ${projectName}`
        : `프로젝트를 찾을 수 없습니다: ${projectName}`,
    };
  }
  return { error: `같은 이름의 프로젝트가 여럿입니다: ${projectName} — 클라이언트명(clientName)으로 구분하세요` };
}

// ---------- 작업 행 해석(형식 + 이름) ----------

interface ResolvedTaskRow {
  row: TaskImportRow;
  input: {
    title: string;
    assigneeId?: string;
    projectId?: string;
    startAt?: string;
    endAt?: string;
    description?: string;
    estimatedHours?: number;
    priority?: Task["priority"];
  };
  status: string; // scheduled면 상태 변경 생략
  detail?: StatusDetail;
}

function resolveTaskRow(db: Db, row: TaskImportRow): ResolvedTaskRow | { error: string } {
  const formatErrors = taskRowFormatErrors(row);
  if (formatErrors.length > 0) return { error: formatErrors.join(" · ") };

  let assigneeId: string | undefined;
  if (row.assigneeName) {
    const r = resolveUser(db, row.assigneeName);
    if ("error" in r) return r;
    assigneeId = r.id;
  }
  let projectId: string | undefined;
  if (row.projectName) {
    const r = resolveProject(db, row.projectName, row.clientName);
    if ("error" in r) return r;
    projectId = r.id;
  } else if (row.clientName) {
    return { error: "클라이언트명만 있고 프로젝트명이 없습니다 — projectName을 채우세요" };
  }
  const helpUserIds: string[] = [];
  for (const name of helpNamesOf(row.helpUserNames)) {
    const r = resolveUser(db, name);
    if ("error" in r) return { error: `도움 주는 사람 — ${r.error}` };
    helpUserIds.push(r.id);
  }

  const status = row.status || "scheduled";
  const detail: StatusDetail | undefined =
    status === "on_hold" || status === "issue"
      ? {
          reason: row.statusReason,
          nextAction: row.nextAction || undefined,
          helpUserIds: helpUserIds.length > 0 ? helpUserIds : undefined,
          recheckAt: row.recheckAt || undefined,
        }
      : undefined;

  return {
    row,
    input: {
      title: row.title,
      assigneeId,
      projectId,
      startAt: row.startAt || undefined,
      endAt: row.endAt || undefined,
      description: row.description || undefined,
      estimatedHours: row.estimatedHours ? Number(row.estimatedHours) : undefined,
      priority: (row.priority || undefined) as Task["priority"] | undefined,
    },
    status,
    detail,
  };
}

// ---------- 액션: 작업 가져오기 ----------

const STATUS_LABEL: Record<string, string> = {
  scheduled: "예정",
  in_progress: "진행중",
  on_hold: "홀드",
  issue: "문제발생",
  needs_reschedule: "시간변경필요",
  done: "완료",
};

export async function importTasksAction(csvText: string, mode: ImportMode): Promise<ImportResult> {
  const user = await getCurrentUser();
  const parsed = parseTasksCsv(csvText);
  if (parsed.fileError) return { fileError: parsed.fileError, results: [], created: 0, failed: 0 };

  const db = await getDb();
  const results: ImportRowResult[] = [];
  let created = 0;
  // 홀드/문제로 등록된 행 — persist 후 팀 채널 병목 알림 대상(개별 경로 pm-actions와 동일 훅).
  const bottlenecks: { taskId: string; detail?: StatusDetail }[] = [];

  for (const row of parsed.rows) {
    const resolved = resolveTaskRow(db, row);
    if ("error" in resolved) {
      results.push({ line: row.line, title: row.title || "(제목 없음)", ok: false, message: resolved.error });
      continue;
    }
    const statusNote =
      resolved.status === "scheduled" ? "예정으로 등록" : `${STATUS_LABEL[resolved.status]} 상태로 등록`;
    if (mode === "preview") {
      results.push({ line: row.line, title: row.title, ok: true, message: statusNote });
      created++;
      continue;
    }
    try {
      const task = db.createTask({ actorId: user.id, via: "web" }, { ...resolved.input, source: "manual" });
      if (resolved.status !== "scheduled") {
        try {
          db.changeTaskStatus(
            { actorId: user.id, via: "web" },
            { taskId: task.id, to: resolved.status as Task["status"], detail: resolved.detail },
          );
          if (resolved.status === "on_hold" || resolved.status === "issue") {
            bottlenecks.push({ taskId: task.id, detail: resolved.detail });
          }
        } catch (statusError) {
          // 생성은 됐고 상태 변경만 실패 — 부분 성공으로 정직하게 보고한다.
          const msg = isQueRuleError(statusError) ? statusError.message : "상태 변경 실패";
          results.push({
            line: row.line,
            title: row.title,
            ok: true,
            message: `예정으로 등록됨 · 상태 변경 실패: ${msg}`,
          });
          created++;
          continue;
        }
      }
      results.push({ line: row.line, title: row.title, ok: true, message: statusNote });
      created++;
    } catch (error) {
      if (!isQueRuleError(error)) throw error; // NEXT_REDIRECT 등은 전파
      results.push({ line: row.line, title: row.title, ok: false, message: error.message });
    }
  }

  if (mode === "commit" && created > 0) {
    await db.persist();
    revalidatePath("/today");
    revalidatePath("/projects");
    revalidatePath("/schedule");
    // 커밋 직후 병목(홀드/문제) 행만 팀 채널 알림 — 훅은 throw하지 않고, 발송 실패해도 등록은 유지.
    for (const b of bottlenecks) {
      await notifyTaskStatusChanged(db, b.taskId, "scheduled", b.detail);
    }
  }
  return { results, created, failed: results.length - created };
}

// ---------- 액션: 마일스톤 가져오기 ----------

const RISK_LABEL: Record<string, string> = { on_track: "정상", at_risk: "주의", late: "지연" };

export async function importMilestonesAction(csvText: string, mode: ImportMode): Promise<ImportResult> {
  const user = await getCurrentUser();
  const parsed = parseMilestonesCsv(csvText);
  if (parsed.fileError) return { fileError: parsed.fileError, results: [], created: 0, failed: 0 };

  const db = await getDb();
  const results: ImportRowResult[] = [];
  let created = 0;

  for (const row of parsed.rows) {
    const push = (ok: boolean, message: string) =>
      results.push({ line: row.line, title: row.title || "(이름 없음)", ok, message });

    const formatErrors = milestoneRowFormatErrors(row);
    if (formatErrors.length > 0) {
      push(false, formatErrors.join(" · "));
      continue;
    }
    const project = resolveProject(db, row.projectName, row.clientName);
    if ("error" in project) {
      push(false, project.error);
      continue;
    }
    const risk = (row.riskStatus || "on_track") as MilestoneImportRow["riskStatus"];
    const note = `${row.projectName} · ${RISK_LABEL[risk] ?? risk}`;
    if (mode === "preview") {
      push(true, note);
      created++;
      continue;
    }
    try {
      db.createMilestone(
        { actorId: user.id, via: "web" },
        {
          projectId: project.id,
          title: row.title,
          dueAt: row.dueAt,
          riskStatus: risk as "on_track" | "at_risk" | "late",
        },
      );
      push(true, note);
      created++;
    } catch (error) {
      if (!isQueRuleError(error)) throw error;
      push(false, error.message);
    }
  }

  if (mode === "commit" && created > 0) {
    await db.persist();
    revalidatePath("/planning");
  }
  return { results, created, failed: results.length - created };
}
