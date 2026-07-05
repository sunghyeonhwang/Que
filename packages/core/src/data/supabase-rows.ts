// 도메인 객체 ↔ Supabase(Postgres) 행 매핑. 시드 스크립트와 Supabase 어댑터가 공유한다.
// core는 supabase-js에 의존하지 않는다 — 여기는 순수 변환 함수만 둔다.
//
// 규칙: 도메인은 camelCase, DB 컬럼은 snake_case. 1:1로 대응하므로 제네릭 변환으로 충분하다.
// - toRow: undefined는 null로(선택 컬럼) 또는 생략(created_at 등 DB default)한다.
// - fromRow: null은 undefined로 되돌리고, Postgres가 문자열로 주는 numeric은 숫자로 캐스팅한다.

const camelToSnake = (s: string): string => s.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
const snakeToCamel = (s: string): string => s.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());

/** 도메인 객체 → DB 행. undefined 필드는 null로 보낸다(선택 컬럼). */
export function toRow(obj: Record<string, unknown>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    row[camelToSnake(k)] = v === undefined ? null : v;
  }
  return row;
}

/** Postgres가 numeric/int8 등을 문자열로 돌려주는 컬럼 — fromRow에서 숫자로 캐스팅한다. */
const NUMERIC_FIELDS = new Set([
  "estimatedHours",
  "amount",
  "confidence",
  "durationMinutes",
  "dayOfWeek",
  "dayOfMonth",
]);

/** DB 행 → 도메인 객체. null은 undefined로, numeric 문자열은 숫자로 되돌린다. */
export function fromRow<T = Record<string, unknown>>(row: Record<string, unknown>): T {
  const obj: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    const key = snakeToCamel(k);
    if (v === null) continue; // 선택 필드는 undefined로 남긴다(zod optional 호환)
    obj[key] = NUMERIC_FIELDS.has(key) && typeof v === "string" ? Number(v) : v;
  }
  return obj as T;
}

/** 도메인엔 있지만 DB 컬럼이 아닌 필드(정규화로 다른 테이블에 표현). upsert 전에 제거한다. */
const NON_COLUMN_ROW_FIELDS: Record<string, string[]> = {
  // Project.milestoneIds는 milestones.project_id로 정규화되어 projects 테이블엔 컬럼이 없다.
  projects: ["milestone_ids"],
};

/** 도메인 객체 → 해당 테이블에 upsert 가능한 행(비-컬럼 필드 제거). */
export function rowForTable(table: string, obj: Record<string, unknown>): Record<string, unknown> {
  const row = toRow(obj);
  for (const c of NON_COLUMN_ROW_FIELDS[table] ?? []) delete row[c];
  return row;
}

/** FK 안전 삽입/삭제 순서. 삽입은 이 순서, 삭제는 역순. (users가 가장 먼저, 로그류가 마지막) */
export const TABLE_INSERT_ORDER = [
  "users",
  "clients",
  "projects",
  "milestones",
  "tasks",
  "calendar_events",
  "meeting_notes",
  "action_items",
  "payment_requests",
  "recurring_templates",
  "status_logs",
  "change_logs",
  "task_comments",
  "check_ins",
] as const;

/** QueSeed의 필드명 → DB 테이블명. users는 USERS 상수에서 별도로 넣는다. */
export const SEED_KEY_TO_TABLE: Record<string, string> = {
  clients: "clients",
  projects: "projects",
  milestones: "milestones",
  tasks: "tasks",
  calendarEvents: "calendar_events",
  meetingNotes: "meeting_notes",
  actionItems: "action_items",
  paymentRequests: "payment_requests",
  recurringTemplates: "recurring_templates",
  statusLogs: "status_logs",
  changeLogs: "change_logs",
  taskComments: "task_comments",
  checkIns: "check_ins",
};
