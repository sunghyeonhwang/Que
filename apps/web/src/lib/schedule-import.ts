// 일정시트 임포트 — YAML 양식 파싱 · 계획(dry-run) · 일괄 생성.
//
// 형식의 유일 정본: data/docs/que-import-template.md (v1). 이 파일의 필드/규약과 어긋나는
// 필드를 임의로 추가하지 않는다. 다른 프로젝트 세션이 그 양식을 채워 붙여넣으면,
// buildImportPlan이 등록 전 요약(확인 카드 원칙)을 만들고, 사람이 확인한 뒤
// executeScheduleImport가 core mutation 경유로 생성한다(ChangeLog via:"web").
//
// 설계 원칙:
// - buildImportPlan/analyze는 **순수 함수** — db의 배열(users/clients/projects/milestones/tasks)만
//   읽는다. mutation·persist를 하지 않으므로 클라이언트 미리보기·수동 검증이 안전하다.
// - 도메인 규칙·권한·중복 최종 판정은 core가 강제한다. 이 계층은 사람에게 보여줄 계획을 만들고
//   실행 불가(errors)를 미리 막을 뿐, core 검증을 대체하지 않는다(execute도 서버에서 계획 재수립).
// - 시각 규약: 시작 기본 09:00 · 마감/기한 기본 18:00. KST 벽시계 → ISO는
//   `new Date("YYYY-MM-DDTHH:mm:00").toISOString()` (레포 toIso 규약, 서버 TZ=Asia/Seoul).

import { z } from "zod";
import { parse as parseYaml } from "yaml";
import {
  QueRuleError,
  type CalendarEvent,
  type Client,
  type MockQueDb,
  type Milestone,
  type Project,
  type Task,
  type User,
} from "@que/core";

// ---------- 상수/상한 ----------

/** 붙여넣기 입력 크기 상한(폭주 방지). UTF-8 바이트 기준. */
const MAX_INPUT_BYTES = 200 * 1024; // 200KB
const MAX_TASKS = 200;
const MAX_MILESTONES = 50;
const MAX_EVENTS = 100;
const MAX_DEPENDS = 50;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

const PRIORITIES = ["high", "normal", "low"] as const;
type Priority = (typeof PRIORITIES)[number];
/** 양식이 지정할 수 있는 상태 — cancelled/merged/needs_reschedule/on_hold/issue는 생성 경로로 만들지 않는다. */
const STATUSES = ["scheduled", "in_progress", "done"] as const;
type ImportStatus = (typeof STATUSES)[number];

// ---------- 공개 계약 타입 (프론트 /import 페이지가 소비) ----------

export interface ImportPlanClient {
  /** 클라이언트명. 사내 잡무(클라이언트 없음)면 null. */
  name: string | null;
  /** Que에 이미 있는가. */
  exists: boolean;
  /** 이번 임포트로 새로 만들 것인가. */
  willCreate: boolean;
}

export interface ImportPlanProject {
  name: string;
  exists: boolean;
  willCreate: boolean;
}

export interface ImportPlanMilestone {
  title: string;
  /** 기한 ISO(오프셋 포함). */
  dueAt: string;
  critical: boolean;
  /** 이미 있어 건너뛸 항목. */
  duplicate: boolean;
}

export interface ImportPlanTask {
  title: string;
  /** 담당자명. 미지정(등록자 배정)이면 null. */
  assignee: string | null;
  status: ImportStatus;
  priority: Priority;
  startAt?: string;
  endAt?: string;
  estimatedHours?: number;
  /** 선행 작업 title 목록(양식 안 또는 기존 프로젝트 작업). */
  dependsOn: string[];
  duplicate: boolean;
}

export interface ImportPlanEvent {
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  /** 참석자명 목록. */
  attendees: string[];
  duplicate: boolean;
}

export interface ImportPlan {
  client: ImportPlanClient;
  project: ImportPlanProject;
  milestones: ImportPlanMilestone[];
  tasks: ImportPlanTask[];
  events: ImportPlanEvent[];
  /** 양식의 미해결 질문 — 실행은 막지 않지만 미리보기에 강조한다. */
  questions: string[];
  /** 하나라도 있으면 실행 불가. */
  errors: string[];
  /** 진행은 가능하나 주의가 필요한 항목(보관됨/중복 스킵 등). */
  warnings: string[];
  /** 실제로 생성될 수(중복·기존은 제외). */
  counts: {
    clients: number;
    projects: number;
    milestones: number;
    tasks: number;
    events: number;
  };
}

export interface ImportResult {
  created: {
    clients: number;
    projects: number;
    milestones: number;
    tasks: number;
    events: number;
  };
  skipped: {
    milestones: number;
    tasks: number;
    events: number;
  };
}

/** buildImportPlan이 읽는 최소 DB 뷰(읽기 전용). MockQueDb가 구조적으로 만족한다.
 *  순수·검증 목적이라 배열만 읽는다(mutation 없음). */
export interface ImportDbView {
  readonly users: readonly User[];
  readonly clients: readonly Client[];
  readonly projects: readonly Project[];
  readonly milestones: readonly Milestone[];
  readonly tasks: readonly Task[];
}

// ---------- YAML 구조 스키마 (구조·상한·타입만; 내용 검증은 analyze) ----------

/** 선택 문자열: null/공백은 undefined로. 상한만 검사한다(형식/필수는 analyze). */
const optStr = (max: number) =>
  z
    .string()
    .max(max, `${max}자를 넘을 수 없습니다`)
    .nullish()
    .transform((v) => {
      const t = v?.trim();
      return t ? t : undefined;
    });

/** 필수 문자열: null도 빈 값으로 취급해 필수 오류 메시지를 낸다. */
const reqStr = (label: string, max: number) =>
  z.preprocess(
    (v) => (v == null ? "" : v),
    z
      .string()
      .trim()
      .min(1, `${label}은(는) 필수입니다`)
      .max(max, `${label}은(는) ${max}자를 넘을 수 없습니다`),
  );

const boolDefault = (fallback: boolean) => z.boolean().nullish().transform((v) => v ?? fallback);

const importYamlSchema = z.object({
  meta: z
    .object({
      source_project: optStr(300),
      filled_by: optStr(300),
      filled_at: optStr(20),
    })
    .nullish(),
  client: z
    .object({
      name: optStr(200),
      create_if_missing: boolDefault(true),
    })
    .nullish(),
  project: z.object({
    name: reqStr("프로젝트명", 200),
    description: optStr(2000),
    create_if_missing: boolDefault(true),
  }),
  milestones: z
    .array(
      z.object({
        title: reqStr("마일스톤 제목", 200),
        due: reqStr("마일스톤 기한(due)", 20),
        due_time: optStr(10),
        critical: boolDefault(false),
      }),
    )
    .max(MAX_MILESTONES, `마일스톤은 최대 ${MAX_MILESTONES}개까지 가져올 수 있습니다`)
    .nullish()
    .transform((v) => v ?? []),
  tasks: z
    .array(
      z.object({
        title: reqStr("작업명", 200),
        assignee: optStr(100),
        start: optStr(20),
        start_time: optStr(10),
        due: optStr(20),
        due_time: optStr(10),
        priority: optStr(20),
        estimated_hours: z.number().nullish(),
        status: optStr(20),
        description: optStr(2000),
        depends_on: z
          .array(z.string().max(200))
          .max(MAX_DEPENDS, `선행 작업(depends_on)은 최대 ${MAX_DEPENDS}개까지입니다`)
          .nullish()
          .transform((v) => v ?? []),
      }),
    )
    .max(MAX_TASKS, `작업은 최대 ${MAX_TASKS}개까지 가져올 수 있습니다`)
    .nullish()
    .transform((v) => v ?? []),
  events: z
    .array(
      z.object({
        title: reqStr("회의 제목", 200),
        date: reqStr("회의 날짜(date)", 20),
        start_time: reqStr("회의 시작 시각(start_time)", 10),
        end_time: reqStr("회의 종료 시각(end_time)", 10),
        attendees: z
          .array(z.string().max(100))
          .max(50)
          .nullish()
          .transform((v) => v ?? []),
      }),
    )
    .max(MAX_EVENTS, `회의는 최대 ${MAX_EVENTS}개까지 가져올 수 있습니다`)
    .nullish()
    .transform((v) => v ?? []),
  questions: z
    .array(z.string().max(1000))
    .max(200)
    .nullish()
    .transform((v) => v ?? []),
});

type ImportYaml = z.infer<typeof importYamlSchema>;

// ---------- 시각 헬퍼 ----------

/** YYYY-MM-DD + HH:mm → KST 벽시계 기준 ISO. 형식 오류/무효 날짜면 null. */
function toIso(date: string, time: string | undefined, fallback: string): string | null {
  if (!DATE_RE.test(date)) return null;
  const hhmm = time && TIME_RE.test(time) ? time : fallback;
  if (!TIME_RE.test(hhmm)) return null;
  const parsed = new Date(`${date}T${hhmm}:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

/** 붙여넣기에 섞여 들어온 ```yaml … ``` 코드펜스를 벗겨낸다(다른 세션이 코드블록으로 출력하는 관행 대응). */
function stripCodeFence(text: string): string {
  const t = text.trim();
  const fence = /^```(?:ya?ml)?\s*\n([\s\S]*?)\n```$/i.exec(t);
  return fence ? fence[1] : text;
}

// ---------- zod 이슈 → 한국어 위치 라벨 ----------

function sectionLabel(path: readonly (string | number | symbol)[]): string {
  const [head, index, field] = path;
  const fieldKo = (k: unknown): string => {
    switch (k) {
      case "title":
        return "제목";
      case "name":
        return "이름";
      case "due":
        return "기한";
      case "date":
        return "날짜";
      case "start_time":
        return "시작 시각";
      case "end_time":
        return "종료 시각";
      case "estimated_hours":
        return "예상 시간";
      default:
        return typeof k === "string" ? k : "";
    }
  };
  if (head === "milestones" && typeof index === "number")
    return `마일스톤 ${index + 1}번째${field ? ` ${fieldKo(field)}` : ""}`;
  if (head === "tasks" && typeof index === "number")
    return `작업 ${index + 1}번째${field ? ` ${fieldKo(field)}` : ""}`;
  if (head === "events" && typeof index === "number")
    return `회의 ${index + 1}번째${field ? ` ${fieldKo(field)}` : ""}`;
  if (head === "project") return `프로젝트${index ? ` ${fieldKo(index)}` : ""}`;
  if (head === "client") return `클라이언트${index ? ` ${fieldKo(index)}` : ""}`;
  return path.map(String).join(".") || "입력";
}

/** zod 기본(영어) 메시지 중 흔한 것을 한국어로 옮긴다. 나머지는 스키마에 심은 한국어 메시지를 그대로 쓴다. */
function koIssueMessage(issue: z.ZodError["issues"][number]): string {
  if (issue.code === "invalid_type" && /received undefined|received null/.test(issue.message)) {
    return "필수 항목이 없습니다";
  }
  if (issue.code === "invalid_type") return "형식이 올바르지 않습니다";
  return issue.message;
}

function formatZodIssues(error: z.ZodError): string[] {
  return error.issues.map((issue) => `${sectionLabel(issue.path)}: ${koIssueMessage(issue)}`);
}

// ---------- 내부 분석 결과(계획·실행 공용) ----------

interface AnalysisClient {
  name: string | null;
  createIfMissing: boolean;
  existingId?: string;
  willCreate: boolean;
  archived: boolean;
}
interface AnalysisProject {
  name: string;
  description?: string;
  createIfMissing: boolean;
  existingId?: string;
  willCreate: boolean;
  archived: boolean;
}
interface AnalysisMilestone {
  title: string;
  dueAt: string;
  critical: boolean;
  duplicate: boolean;
}
interface AnalysisTask {
  title: string;
  assigneeId?: string;
  assigneeName: string | null;
  startAt?: string;
  endAt?: string;
  description?: string;
  estimatedHours?: number;
  priority: Priority;
  status: ImportStatus;
  dependsOn: string[];
  duplicate: boolean;
}
interface AnalysisEvent {
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  startAt: string;
  endAt: string;
  attendeeIds: string[];
  attendees: string[];
  duplicate: boolean;
}

interface Analysis {
  errors: string[];
  warnings: string[];
  questions: string[];
  client: AnalysisClient;
  project: AnalysisProject;
  milestones: AnalysisMilestone[];
  tasks: AnalysisTask[];
  events: AnalysisEvent[];
}

/** 재직자 이름 → 유저. 0건/동명이인은 오류 문자열. */
function resolveUser(db: ImportDbView, name: string): { id: string; name: string } | { error: string } {
  const matches = db.users.filter((u) => u.active !== false && u.name === name);
  if (matches.length === 1) return { id: matches[0].id, name: matches[0].name };
  if (matches.length === 0) return { error: `'${name}'는 팀 로스터에 없습니다` };
  return { error: `동명이인이 있습니다: '${name}' — 관리자에게 문의하세요` };
}

/** 파싱 실패/스키마 실패 시 반환할 빈 분석. */
function emptyAnalysis(errors: string[], questions: string[] = []): Analysis {
  return {
    errors,
    warnings: [],
    questions,
    client: { name: null, createIfMissing: true, willCreate: false, archived: false },
    project: { name: "", createIfMissing: true, willCreate: false, archived: false },
    milestones: [],
    tasks: [],
    events: [],
  };
}

/**
 * YAML 텍스트를 파싱·검증하고 계획/실행 공용 분석 결과를 만든다(순수 — db 배열만 읽음).
 * db가 실행 시점 서버 상태여야 계획==실행이 보장된다(execute가 서버에서 재수립).
 */
function analyze(db: ImportDbView, actor: User, yamlText: string): Analysis {
  // 1) 크기 상한
  const byteLength = new TextEncoder().encode(yamlText).length;
  if (byteLength > MAX_INPUT_BYTES) {
    return emptyAnalysis([
      `입력이 너무 큽니다(${Math.round(byteLength / 1024)}KB) — 최대 ${MAX_INPUT_BYTES / 1024}KB까지만 가져올 수 있습니다`,
    ]);
  }
  if (!yamlText.trim()) {
    return emptyAnalysis(["내용이 비어 있습니다 — 양식 YAML을 붙여넣으세요"]);
  }

  // 2) YAML 파싱
  let raw: unknown;
  try {
    raw = parseYaml(stripCodeFence(yamlText));
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return emptyAnalysis([`YAML 형식 오류: ${msg}`]);
  }
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return emptyAnalysis(["최상위는 meta/client/project/… 필드를 가진 객체여야 합니다"]);
  }

  // 3) 구조/상한/타입 검증
  const parsed = importYamlSchema.safeParse(raw);
  if (!parsed.success) {
    // questions는 구조가 맞으면 살려 보여주고 싶지만, 스키마 실패 시엔 원본에서 안전 추출.
    const rawQuestions = extractRawQuestions(raw);
    return emptyAnalysis(formatZodIssues(parsed.error), rawQuestions);
  }
  const data: ImportYaml = parsed.data;

  const errors: string[] = [];
  const warnings: string[] = [];

  // 4) 클라이언트 해석
  const client = resolveClient(db, data, errors);

  // 5) 프로젝트 해석
  const project = resolveProject(db, data, client, errors);
  if (client.archived) {
    warnings.push(`클라이언트 '${client.name}'는 보관됨(archived) 상태입니다 — 그대로 사용합니다`);
  }
  if (project.archived) {
    warnings.push(`프로젝트 '${project.name}'는 보관됨(archived) 상태입니다 — 그대로 사용합니다`);
  }

  // 6) 기존 프로젝트라면 중복 판정 기준이 되는 현재 마일스톤/작업 목록
  const existingProjectId = project.existingId;
  const existingMilestones = existingProjectId
    ? db.milestones.filter((m) => m.projectId === existingProjectId)
    : [];
  const existingTasks = existingProjectId
    ? db.tasks.filter((t) => t.projectId === existingProjectId && t.status !== "cancelled")
    : [];

  // 7) 마일스톤
  const milestones = resolveMilestones(data, existingMilestones, errors, warnings);

  // 8) 작업
  const tasks = resolveTasks(db, data, existingTasks, errors, warnings);

  // 9) 회의
  const events = resolveEvents(db, data, errors);

  // 등록자 배정 안내(미지정 담당자가 있으면 계획에 남긴다)
  if (tasks.some((t) => t.assigneeName === null && !t.duplicate)) {
    warnings.push(`담당자 미지정 작업은 등록자(${actor.name})에게 배정됩니다`);
  }

  return {
    errors,
    warnings,
    questions: data.questions.map((q) => q.trim()).filter((q) => q.length > 0),
    client,
    project,
    milestones,
    tasks,
    events,
  };
}

/** 스키마 실패 상황에서도 questions만 관대하게 뽑아 미리보기에 남긴다. */
function extractRawQuestions(raw: unknown): string[] {
  if (raw && typeof raw === "object" && "questions" in raw) {
    const q = (raw as { questions?: unknown }).questions;
    if (Array.isArray(q)) return q.filter((x): x is string => typeof x === "string").map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

function resolveClient(db: ImportDbView, data: ImportYaml, errors: string[]): AnalysisClient {
  const name = data.client?.name;
  const createIfMissing = data.client?.create_if_missing ?? true;
  if (!name) {
    return { name: null, createIfMissing, willCreate: false, archived: false };
  }
  const existing = db.clients.find((c) => c.name.trim() === name);
  if (existing) {
    return {
      name,
      createIfMissing,
      existingId: existing.id,
      willCreate: false,
      archived: existing.status === "archived",
    };
  }
  if (!createIfMissing) {
    errors.push(`클라이언트 '${name}'가 Que에 없고 새로 만들지 않도록 설정되어 있습니다(create_if_missing=false)`);
    return { name, createIfMissing, willCreate: false, archived: false };
  }
  return { name, createIfMissing, willCreate: true, archived: false };
}

function resolveProject(
  db: ImportDbView,
  data: ImportYaml,
  client: AnalysisClient,
  errors: string[],
): AnalysisProject {
  const name = data.project.name;
  const description = data.project.description;
  const createIfMissing = data.project.create_if_missing ?? true;

  // 클라이언트를 새로 만들 예정이면 그 밑에 같은 프로젝트가 있을 수 없다 → 항상 신규.
  let existing: Project | undefined;
  if (!client.willCreate) {
    const scopeClientId = client.existingId; // undefined = 사내(클라이언트 없음)
    const candidates = db.projects.filter(
      (p) => p.name.trim() === name && (p.clientId ?? undefined) === (scopeClientId ?? undefined),
    );
    if (candidates.length > 1) {
      errors.push(`같은 이름의 프로젝트가 여럿입니다: '${name}' — 관리자에게 문의하세요`);
    }
    existing = candidates[0];
  }

  if (existing) {
    return {
      name,
      description,
      createIfMissing,
      existingId: existing.id,
      willCreate: false,
      archived: existing.status === "archived",
    };
  }
  if (!createIfMissing) {
    errors.push(`프로젝트 '${name}'가 Que에 없고 새로 만들지 않도록 설정되어 있습니다(create_if_missing=false)`);
    return { name, description, createIfMissing, willCreate: false, archived: false };
  }
  return { name, description, createIfMissing, willCreate: true, archived: false };
}

function resolveMilestones(
  data: ImportYaml,
  existingMilestones: readonly Milestone[],
  errors: string[],
  warnings: string[],
): AnalysisMilestone[] {
  return data.milestones.map((m, i) => {
    const label = `마일스톤 ${i + 1}번째('${m.title}')`;
    if (!DATE_RE.test(m.due)) {
      errors.push(`${label}: 기한(due) 날짜 형식 오류 — 예: 2026-07-20`);
    }
    if (m.due_time && !TIME_RE.test(m.due_time)) {
      errors.push(`${label}: 기한 시각(due_time) 형식 오류 — 예: 18:00`);
    }
    const dueAt = toIso(m.due, m.due_time, "18:00");
    if (!dueAt && DATE_RE.test(m.due)) {
      errors.push(`${label}: 유효하지 않은 날짜입니다 — ${m.due}`);
    }
    const duplicate = existingMilestones.some((em) => em.title.trim() === m.title);
    if (duplicate) warnings.push(`마일스톤 '${m.title}'는 이미 있어 건너뜁니다`);
    return { title: m.title, dueAt: dueAt ?? "", critical: m.critical, duplicate };
  });
}

function resolveTasks(
  db: ImportDbView,
  data: ImportYaml,
  existingTasks: readonly Task[],
  errors: string[],
  warnings: string[],
): AnalysisTask[] {
  const formTitles = new Set(data.tasks.map((t) => t.title));
  const existingTitles = new Set(existingTasks.map((t) => t.title.trim()));
  // 양식 안 직접 상호참조 검사용: title → depends_on 집합
  const dependsByTitle = new Map<string, Set<string>>();
  for (const t of data.tasks) dependsByTitle.set(t.title, new Set(t.depends_on.map((d) => d.trim())));

  return data.tasks.map((t, i) => {
    const label = `작업 ${i + 1}번째('${t.title}')`;

    // 담당자
    let assigneeId: string | undefined;
    let assigneeName: string | null = null;
    if (t.assignee) {
      const r = resolveUser(db, t.assignee);
      if ("error" in r) errors.push(`${label}: 담당자 ${r.error}`);
      else {
        assigneeId = r.id;
        assigneeName = r.name;
      }
    }

    // 우선순위
    let priority: Priority = "normal";
    if (t.priority) {
      if ((PRIORITIES as readonly string[]).includes(t.priority)) priority = t.priority as Priority;
      else errors.push(`${label}: 우선순위는 high/normal/low 중 하나여야 합니다 — '${t.priority}'`);
    }

    // 상태
    let status: ImportStatus = "scheduled";
    if (t.status) {
      if ((STATUSES as readonly string[]).includes(t.status)) status = t.status as ImportStatus;
      else errors.push(`${label}: 상태는 scheduled/in_progress/done 중 하나여야 합니다 — '${t.status}'`);
    }

    // 시각
    if (t.start && !DATE_RE.test(t.start)) errors.push(`${label}: 시작 날짜(start) 형식 오류 — 예: 2026-07-14`);
    if (t.start_time && !TIME_RE.test(t.start_time)) errors.push(`${label}: 시작 시각(start_time) 형식 오류 — 예: 09:00`);
    if (t.due && !DATE_RE.test(t.due)) errors.push(`${label}: 마감 날짜(due) 형식 오류 — 예: 2026-07-20`);
    if (t.due_time && !TIME_RE.test(t.due_time)) errors.push(`${label}: 마감 시각(due_time) 형식 오류 — 예: 18:00`);
    const startAt = t.start && DATE_RE.test(t.start) ? toIso(t.start, t.start_time, "09:00") ?? undefined : undefined;
    const endAt = t.due && DATE_RE.test(t.due) ? toIso(t.due, t.due_time, "18:00") ?? undefined : undefined;
    if (startAt && endAt && Date.parse(startAt) > Date.parse(endAt)) {
      errors.push(`${label}: 시작이 마감보다 늦습니다`);
    }

    // 예상 시간
    let estimatedHours: number | undefined;
    if (t.estimated_hours != null) {
      if (t.estimated_hours > 0) estimatedHours = t.estimated_hours;
      else errors.push(`${label}: 예상 시간(estimated_hours)은 0보다 커야 합니다`);
    }

    // depends_on 해석: 양식 안 title 또는 기존 프로젝트 작업 title
    const dependsOn: string[] = [];
    for (const rawDep of t.depends_on) {
      const dep = rawDep.trim();
      if (!dep) continue;
      if (dep === t.title) {
        errors.push(`${label}: 자기 자신을 선행 작업으로 지정할 수 없습니다`);
        continue;
      }
      if (!formTitles.has(dep) && !existingTitles.has(dep)) {
        errors.push(`${label}: 선행 작업 '${dep}'을(를) 양식·기존 프로젝트에서 찾을 수 없습니다`);
        continue;
      }
      // 직접 상호참조(A↔B)만 계획 단계에서 거른다(전체 순환은 core가 최종 거부).
      if (formTitles.has(dep) && dependsByTitle.get(dep)?.has(t.title)) {
        errors.push(`${label}: '${dep}'와(과) 서로를 선행으로 지정했습니다(상호 참조 불가)`);
        continue;
      }
      if (!dependsOn.includes(dep)) dependsOn.push(dep);
    }

    const duplicate = existingTitles.has(t.title);
    if (duplicate) warnings.push(`작업 '${t.title}'는 이미 있어 건너뜁니다`);

    return {
      title: t.title,
      assigneeId,
      assigneeName,
      startAt,
      endAt,
      description: t.description,
      estimatedHours,
      priority,
      status,
      dependsOn,
      duplicate,
    };
  });
}

function resolveEvents(db: ImportDbView, data: ImportYaml, errors: string[]): AnalysisEvent[] {
  return data.events.map((e, i) => {
    const label = `회의 ${i + 1}번째('${e.title}')`;
    if (!DATE_RE.test(e.date)) errors.push(`${label}: 날짜(date) 형식 오류 — 예: 2026-07-14`);
    if (!TIME_RE.test(e.start_time)) errors.push(`${label}: 시작 시각(start_time) 형식 오류 — 예: 10:00`);
    if (!TIME_RE.test(e.end_time)) errors.push(`${label}: 종료 시각(end_time) 형식 오류 — 예: 11:00`);
    const startAt = toIso(e.date, e.start_time, "09:00");
    const endAt = toIso(e.date, e.end_time, "18:00");
    if (startAt && endAt && Date.parse(endAt) <= Date.parse(startAt)) {
      errors.push(`${label}: 종료 시각이 시작 시각보다 늦어야 합니다`);
    }

    const attendeeIds: string[] = [];
    const attendees: string[] = [];
    for (const rawName of e.attendees) {
      const name = rawName.trim();
      if (!name) continue;
      const r = resolveUser(db, name);
      if ("error" in r) errors.push(`${label}: 참석자 ${r.error}`);
      else if (!attendeeIds.includes(r.id)) {
        attendeeIds.push(r.id);
        attendees.push(r.name);
      }
    }

    // 중복(제목 + 시작 시각 일치) 판정은 calendarEvents가 필요해 analyzeWithEvents에서 보강한다.
    return {
      title: e.title,
      date: e.date,
      startTime: e.start_time,
      endTime: e.end_time,
      startAt: startAt ?? "",
      endAt: endAt ?? "",
      attendeeIds,
      attendees,
      duplicate: false,
    };
  });
}

// ---------- 공개 함수 ----------

/** 실행 없이 계획만 만든다(dry-run). errors가 하나라도 있으면 실행 불가. */
export function buildImportPlan(db: ImportDbView, actor: User, yamlText: string): ImportPlan {
  const a = analyzeWithEvents(db, actor, yamlText);
  return {
    client: { name: a.client.name, exists: !!a.client.existingId, willCreate: a.client.willCreate },
    project: { name: a.project.name, exists: !!a.project.existingId, willCreate: a.project.willCreate },
    milestones: a.milestones.map((m) => ({
      title: m.title,
      dueAt: m.dueAt,
      critical: m.critical,
      duplicate: m.duplicate,
    })),
    tasks: a.tasks.map((t) => ({
      title: t.title,
      assignee: t.assigneeName,
      status: t.status,
      priority: t.priority,
      startAt: t.startAt,
      endAt: t.endAt,
      estimatedHours: t.estimatedHours,
      dependsOn: t.dependsOn,
      duplicate: t.duplicate,
    })),
    events: a.events.map((e) => ({
      title: e.title,
      date: e.date,
      startTime: e.startTime,
      endTime: e.endTime,
      attendees: e.attendees,
      duplicate: e.duplicate,
    })),
    questions: a.questions,
    errors: a.errors,
    warnings: a.warnings,
    counts: {
      clients: a.client.willCreate ? 1 : 0,
      projects: a.project.willCreate ? 1 : 0,
      milestones: a.milestones.filter((m) => !m.duplicate).length,
      tasks: a.tasks.filter((t) => !t.duplicate).length,
      events: a.events.filter((e) => !e.duplicate).length,
    },
  };
}

/** 회의 중복 판정은 calendarEvents가 필요하다. ImportDbView엔 없으므로 여기서 보강한다.
 *  (buildImportPlan/executeScheduleImport는 실제 MockQueDb를 넘겨 이 경로를 탄다.) */
function analyzeWithEvents(db: ImportDbView, actor: User, yamlText: string): Analysis {
  const a = analyze(db, actor, yamlText);
  const events = (db as { calendarEvents?: readonly CalendarEvent[] }).calendarEvents;
  if (events && a.events.length > 0) {
    for (const ev of a.events) {
      if (!ev.startAt) continue;
      const dup = events.some(
        (c) => c.title.trim() === ev.title && Date.parse(c.startAt) === Date.parse(ev.startAt),
      );
      if (dup && !ev.duplicate) {
        ev.duplicate = true;
        a.warnings.push(`회의 '${ev.title}'는 이미 있어 건너뜁니다`);
      }
    }
  }
  return a;
}

/**
 * 계획을 서버에서 재수립하고(클라이언트 계획 불신) 생성한다. persist는 호출자(액션)가 1회 수행한다.
 * errors가 있으면 QueRuleError("INVALID_INPUT")로 거부한다. 생성 순서:
 * 클라이언트 → 프로젝트 → 마일스톤 → 작업 → 선행(일괄) → 상태 전이 → 회의.
 */
export function executeScheduleImport(db: MockQueDb, actor: User, yamlText: string): ImportResult {
  const a = analyzeWithEvents(db, actor, yamlText);
  if (a.errors.length > 0) {
    const summary = a.errors.slice(0, 3).join(" · ");
    const more = a.errors.length > 3 ? ` 외 ${a.errors.length - 3}건` : "";
    throw new QueRuleError("INVALID_INPUT", `임포트를 실행할 수 없습니다: ${summary}${more}`);
  }

  const ctx = { actorId: actor.id, via: "web" as const };
  const created = { clients: 0, projects: 0, milestones: 0, tasks: 0, events: 0 };
  const skipped = { milestones: 0, tasks: 0, events: 0 };

  // 1) 클라이언트
  let clientId: string | undefined = a.client.existingId;
  if (a.client.willCreate && a.client.name) {
    clientId = db.createClient(ctx, { name: a.client.name }).id;
    created.clients += 1;
  }

  // 2) 프로젝트
  let projectId: string;
  if (a.project.existingId) {
    projectId = a.project.existingId;
  } else {
    projectId = db.createProject(ctx, {
      name: a.project.name,
      clientId,
      description: a.project.description,
    }).id;
    created.projects += 1;
  }

  // 3) 마일스톤
  for (const m of a.milestones) {
    if (m.duplicate) {
      skipped.milestones += 1;
      continue;
    }
    db.createMilestone(ctx, { projectId, title: m.title, dueAt: m.dueAt, critical: m.critical });
    created.milestones += 1;
  }

  // 4) 작업 — title → 새로 만든 task id 매핑
  const createdByTitle = new Map<string, string>();
  const statusTargets: { taskId: string; status: ImportStatus }[] = [];
  const dependsTargets: { taskId: string; dependsOn: string[] }[] = [];
  for (const t of a.tasks) {
    if (t.duplicate) {
      skipped.tasks += 1;
      continue;
    }
    const task = db.createTask(ctx, {
      title: t.title,
      assigneeId: t.assigneeId,
      projectId,
      startAt: t.startAt,
      endAt: t.endAt,
      description: t.description,
      estimatedHours: t.estimatedHours,
      priority: t.priority,
      source: "manual",
    });
    created.tasks += 1;
    createdByTitle.set(t.title, task.id);
    if (t.dependsOn.length > 0) dependsTargets.push({ taskId: task.id, dependsOn: t.dependsOn });
    if (t.status !== "scheduled") statusTargets.push({ taskId: task.id, status: t.status });
  }

  // 5) 선행(일괄) — title → id(신규 우선, 없으면 기존 프로젝트 작업)
  const existingByTitle = new Map<string, string>();
  for (const et of db.tasks) {
    if (et.projectId === projectId && et.status !== "cancelled" && !existingByTitle.has(et.title.trim())) {
      existingByTitle.set(et.title.trim(), et.id);
    }
  }
  for (const dt of dependsTargets) {
    const predIds: string[] = [];
    for (const depTitle of dt.dependsOn) {
      const id = createdByTitle.get(depTitle) ?? existingByTitle.get(depTitle);
      if (id && id !== dt.taskId && !predIds.includes(id)) predIds.push(id);
    }
    if (predIds.length > 0) db.setTaskPredecessors(ctx, { taskId: dt.taskId, predecessorIds: predIds });
  }

  // 6) 상태 전이 — core에 scheduled→in_progress/done 직접 전이 가드가 없으므로 바로 전환한다.
  //    (in_progress/done은 사유 불필요. issue/on_hold는 양식에서 애초에 허용하지 않는다.)
  for (const st of statusTargets) {
    db.changeTaskStatus(ctx, { taskId: st.taskId, to: st.status });
  }

  // 7) 회의
  for (const e of a.events) {
    if (e.duplicate) {
      skipped.events += 1;
      continue;
    }
    db.createCalendarEvent(ctx, {
      title: e.title,
      startAt: e.startAt,
      endAt: e.endAt,
      attendeeIds: e.attendeeIds,
      visibility: "team",
    });
    created.events += 1;
  }

  return { created, skipped };
}
