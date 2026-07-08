import "server-only";

import { TASK_STATUS_LABELS, type MockQueDb, type NotificationIntent, type Task } from "@que/core";
import { deadlineThresholdHours, digestRecipientAllowlist } from "./config";

// 개인 DM 데일리 브리핑(personal_digest) 콘텐츠 빌더 — Slack Phase 2, web 계층.
// active 유저별로 4섹션(오늘 작업/막힘/마감/마일스톤 위험)을 조립해 NotificationIntent[]를 만든다.
// 부수효과 없음(발송·적재는 dispatch). 전 섹션 0건인 유저는 intent를 생략한다(빈 브리핑 미발송).
//
// v1 결정(사용자 승인): 체크인 응답대기·도움요청은 제외(4섹션만). 본인 것만(assignee/owner===userId).
// 마일스톤 "담당"은 스키마상 project.ownerId 경유가 유일 경로. riskStatus at_risk/late(=!on_track)만.
//
// v2(사용자 요청 2026-07-08): payload.text는 요약 1줄(폴백/미리보기)로 유지하고, 각 섹션의 항목 목록을
// payload.detail(mrkdwn)로 실어 DM 본문에 붙인다. 섹션당 최대 5건 + '…외 N건', 0건 섹션은 헤더 생략.

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** 섹션당 표기 상한(초과분은 '…외 N건'으로 요약). */
const SECTION_CAP = 5;
/** Slack 섹션 블록 mrkdwn 한도 3000자에 대한 안전 마진 — 초과 시 뒷섹션부터 강등. */
const MAX_DETAIL_CHARS = 2900;
/** 사유 요약 절단 길이. */
const REASON_MAX = 40;

/** 마일스톤 riskStatus → 한글 라벨(상태색 의미 고정: at_risk=주의/amber, late=지연/red). */
const RISK_LABELS: Record<"at_risk" | "late", string> = { at_risk: "주의", late: "지연" };

/** Slack mrkdwn 링크 문법(<url|text>) 깨짐 방지 — &,<,> HTML 이스케이프(Slack 표준). */
function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** iso → KST 벽시계 "HH:mm". 파싱 실패 시 빈 문자열. */
function kstHm(iso: string): string {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return "";
  const d = new Date(ms + KST_OFFSET_MS);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}

/** iso 마감을 now 기준 "오늘 HH:mm | 내일 HH:mm | MM-DD HH:mm"(KST)로 표기. */
function kstDeadlineLabel(iso: string, now: Date): string {
  const nowKey = kstDateKey(now);
  const dueKey = new Date(Date.parse(iso) + KST_OFFSET_MS).toISOString().slice(0, 10);
  const tomorrow = kstDateKey(new Date(now.getTime() + 24 * 60 * 60 * 1000));
  const hm = kstHm(iso);
  if (dueKey === nowKey) return `오늘 ${hm}`;
  if (dueKey === tomorrow) return `내일 ${hm}`;
  return `${dueKey.slice(5)} ${hm}`;
}

/** 열린(진행 가능한) 상태 — 마감·오늘 작업 스캔 대상. done/cancelled/merged 제외. */
const OPEN_STATUSES = new Set(["scheduled", "in_progress", "needs_reschedule", "on_hold", "issue"]);

/** 정렬용 endAt ms(없으면 +Infinity로 뒤로). */
function endMs(t: Task): number {
  const ms = t.endAt ? Date.parse(t.endAt) : NaN;
  return Number.isNaN(ms) ? Number.POSITIVE_INFINITY : ms;
}

/** now의 KST 날짜 키(YYYY-MM-DD). personal_digest dedup marker이자 발송 창 스코프. */
export function kstDateKey(now: Date): string {
  return new Date(now.getTime() + KST_OFFSET_MS).toISOString().slice(0, 10);
}

/**
 * active 유저별 개인 브리핑 intent. recipient=userId, kind=personal_digest, marker=KST 날짜.
 * 전 섹션 0건이면 그 유저는 생략한다(빈 브리핑 미발송).
 */
export function buildPersonalDigestIntents(db: MockQueDb, now: Date): NotificationIntent[] {
  const dateKey = kstDateKey(now);
  const thresholdMs = deadlineThresholdHours() * 60 * 60 * 1000;
  const nowMs = now.getTime();

  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(now);
  dayEnd.setHours(23, 59, 59, 999);

  // today-data.ts overlapsToday 패턴(startAt만 보는 getStandupData 말고 구간 겹침).
  const overlapsToday = (t: Task): boolean => {
    if (!t.startAt && !t.endAt) return false;
    const start = t.startAt ? new Date(t.startAt) : new Date(t.endAt!);
    const end = t.endAt ? new Date(t.endAt) : start;
    return start <= dayEnd && end >= dayStart;
  };

  // 프로젝트명 조회 + 마일스톤 담당(project.ownerId) → 위험 마일스톤 목록(dueAt 오름차순).
  const projectById = new Map(db.projects.map((p) => [p.id, p]));
  const riskByOwner = new Map<string, { title: string; projectName: string; riskStatus: "at_risk" | "late"; dueAt: string }[]>();
  for (const m of db.milestones) {
    if (m.riskStatus === "on_track") continue;
    const project = projectById.get(m.projectId);
    if (!project?.ownerId) continue;
    const list = riskByOwner.get(project.ownerId) ?? [];
    list.push({ title: m.title, projectName: project.name, riskStatus: m.riskStatus, dueAt: m.dueAt });
    riskByOwner.set(project.ownerId, list);
  }

  // 작업별 최근 issue/on_hold 전이 로그(막힘 사유·오래 막힌 순 정렬용). report-data currentBlockers 선례 재사용.
  const lastBlockLog = (taskId: string) =>
    [...db.statusLogs]
      .filter((l) => l.taskId === taskId && (l.toStatus === "issue" || l.toStatus === "on_hold"))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];

  const allow = digestRecipientAllowlist(); // null이면 전체, 아니면 그 유저만(테스트/단계적 롤아웃)

  const intents: NotificationIntent[] = [];
  for (const user of db.users) {
    if (user.active === false) continue; // active 유저만
    if (allow && !allow.includes(user.id)) continue; // 허용목록 있으면 그 유저만

    const mine = db.tasks.filter(
      (t) => t.assigneeId === user.id && t.status !== "cancelled" && t.status !== "merged",
    );

    const projName = (t: Task) => (t.projectId ? projectById.get(t.projectId)?.name : undefined) ?? "-";

    // ── 오늘 작업: 마감 빠른 순. "제목 — 프로젝트 · 상태(· ~HH:mm까지)" ──
    const todayTasks = mine
      .filter((t) => OPEN_STATUSES.has(t.status) && overlapsToday(t))
      .sort((a, b) => endMs(a) - endMs(b));
    const todayLines = todayTasks.map(
      (t) =>
        `• ${esc(t.title)} — ${esc(projName(t))} · ${TASK_STATUS_LABELS[t.status]}` +
        (t.endAt ? ` · ~${kstHm(t.endAt)}까지` : ""),
    );

    // ── 막힘: 오래 막힌 순(최근 전이 오래된 것 먼저). "제목 — 문제발생|홀드 · 사유(40자)" ──
    const blockedTasks = mine
      .filter((t) => t.status === "issue" || t.status === "on_hold")
      .sort((a, b) => {
        const sa = lastBlockLog(a.id)?.createdAt ?? a.lastChangedAt ?? "";
        const sb = lastBlockLog(b.id)?.createdAt ?? b.lastChangedAt ?? "";
        return sa.localeCompare(sb); // 오래된 전이 먼저
      });
    const blockedLines = blockedTasks.map((t) => {
      const reason = lastBlockLog(t.id)?.reason?.trim();
      const short = reason
        ? reason.length > REASON_MAX
          ? `${reason.slice(0, REASON_MAX)}…`
          : reason
        : "";
      return `• ${esc(t.title)} — ${TASK_STATUS_LABELS[t.status]}${short ? ` · ${esc(short)}` : ""}`;
    });

    // ── 마감 임박: 마감 빠른 순. "제목 — 오늘/내일 HH:mm(KST)" ──
    const deadlineTasks = mine
      .filter((t) => {
        if (!OPEN_STATUSES.has(t.status) || !t.endAt) return false;
        const due = Date.parse(t.endAt);
        if (Number.isNaN(due)) return false;
        return due >= nowMs && due <= nowMs + thresholdMs; // 지금~임계(overdue 제외)
      })
      .sort((a, b) => endMs(a) - endMs(b));
    const deadlineLines = deadlineTasks.map(
      (t) => `• ${esc(t.title)} — ${kstDeadlineLabel(t.endAt!, now)}`,
    );

    // ── 마일스톤 위험: dueAt 오름차순. "마일스톤 — 프로젝트 · 주의|지연" ──
    const riskItems = (riskByOwner.get(user.id) ?? []).sort((a, b) => a.dueAt.localeCompare(b.dueAt));
    const milestoneLines = riskItems.map(
      (m) => `• ${esc(m.title)} — ${esc(m.projectName)} · ${RISK_LABELS[m.riskStatus]}`,
    );

    const todayCount = todayLines.length;
    const blockedCount = blockedLines.length;
    const deadlineCount = deadlineLines.length;
    const milestoneCount = milestoneLines.length;

    if (todayCount + blockedCount + deadlineCount + milestoneCount === 0) continue; // 빈 브리핑 생략

    // 0건 섹션은 헤더 생략. 섹션당 SECTION_CAP + '…외 N건'. 조립 후 한도 초과 시 뒷섹션부터 강등.
    const detail = buildDetail([
      { header: "오늘 작업", lines: todayLines },
      { header: "막힘", lines: blockedLines },
      { header: "마감 임박", lines: deadlineLines },
      { header: "마일스톤 위험", lines: milestoneLines },
    ]);

    intents.push({
      kind: "personal_digest",
      entityType: "user",
      entityId: user.id,
      marker: dateKey,
      recipient: user.id, // 발송 직전 Slack member ID로 해석
      payload: {
        title: "오늘의 브리핑",
        text: `오늘 작업 ${todayCount} · 막힘 ${blockedCount} · 마감 임박 ${deadlineCount} · 마일스톤 위험 ${milestoneCount}`,
        deeplinkPath: "/today",
        tone: "blue",
        detail,
      },
    });
  }
  return intents;
}

/**
 * 섹션들(비어있지 않은 것만)을 mrkdwn 상세 본문으로 조립한다.
 * 섹션당 최대 SECTION_CAP건, 초과분은 '…외 N건'. 전체가 MAX_DETAIL_CHARS를 넘으면
 * 뒷섹션부터 표기 상한을 1씩 줄여(강등) 한도 안에 맞춘다(안전 가드).
 */
function buildDetail(sections: { header: string; lines: string[] }[]): string {
  const secs = sections.filter((s) => s.lines.length > 0);
  const caps = secs.map(() => SECTION_CAP);
  const render = () =>
    secs
      .map((s, i) => {
        const shown = s.lines.slice(0, caps[i]);
        const rest = s.lines.length - shown.length;
        const body = rest > 0 ? [...shown, `…외 ${rest}건`] : shown;
        return `*${s.header}*\n${body.join("\n")}`;
      })
      .join("\n\n");
  let detail = render();
  for (let i = secs.length - 1; i >= 0 && detail.length > MAX_DETAIL_CHARS; ) {
    if (caps[i] > 0) {
      caps[i] -= 1;
      detail = render();
    } else i -= 1;
  }
  return detail;
}
