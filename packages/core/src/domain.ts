import { z } from "zod";

// 데이터 모델 초안: data/docs/que-product-plan.md "데이터 모델 초안" 기준.
// 날짜/시간은 직렬화 가능성(웹/MCP/CLI 공유)을 위해 ISO 8601 문자열로 다룬다.

const isoDateTime = z.iso.datetime({ offset: true });
const isoDate = z.iso.date();

// ---------- User ----------

export const userRoleSchema = z.enum(["admin", "member"]);
export type UserRole = z.infer<typeof userRoleSchema>;

export const userSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  role: userRoleSchema,
  /** 캘린더/아바타에서 멤버 구분에 쓰는 색 (hex) */
  avatarColor: z.string().regex(/^#[0-9a-f]{6}$/i),
});
export type User = z.infer<typeof userSchema>;

// ---------- Task ----------

export const taskStatusSchema = z.enum([
  "scheduled", // 예정
  "in_progress", // 진행중
  "done", // 완료
  "needs_reschedule", // 시간변경필요
  "on_hold", // 홀드
  "issue", // 문제발생
  "cancelled", // 취소/필요없음
  "merged", // 다른 프로젝트와 병합
]);
export type TaskStatus = z.infer<typeof taskStatusSchema>;

/** 문제발생/홀드 전환 시 함께 받는 추가 정보 (기획서 "작업 상태 관리") */
export const statusDetailSchema = z.object({
  reason: z.string().trim().min(1, "사유는 필수다"),
  nextAction: z.string().optional(),
  helpUserId: z.string().optional(),
  recheckAt: isoDateTime.optional(),
});
export type StatusDetail = z.infer<typeof statusDetailSchema>;

/** 일정 이동 입력. MCP/CLI 등 외부 입력을 신뢰하지 않고 mutation 경로에서 파싱한다. */
export const scheduleRangeSchema = z
  .object({
    startAt: isoDateTime,
    endAt: isoDateTime,
  })
  .refine((r) => Date.parse(r.startAt) <= Date.parse(r.endAt), {
    message: "종료 시각은 시작 시각보다 빠를 수 없다",
  });
export type ScheduleRange = z.infer<typeof scheduleRangeSchema>;

export const taskSourceSchema = z.enum(["manual", "natural_language", "action_item"]);
export const visibilitySchema = z.enum(["team", "private"]);

export const taskSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  ownerId: z.string().min(1),
  assigneeId: z.string().min(1),
  projectId: z.string().optional(),
  startAt: isoDateTime.optional(),
  endAt: isoDateTime.optional(),
  status: taskStatusSchema,
  priority: z.enum(["low", "normal", "high"]).default("normal"),
  description: z.string().optional(),
  estimatedHours: z.number().positive().optional(),
  source: taskSourceSchema,
  visibility: visibilitySchema.default("team"),
  mergedIntoTaskId: z.string().optional(),
  lastChangedBy: z.string().optional(),
  lastChangedAt: isoDateTime.optional(),
});
export type Task = z.infer<typeof taskSchema>;

// ---------- CalendarEvent ----------

export const calendarEventSchema = z.object({
  id: z.string().min(1),
  /** company = 외부 회사 캘린더에서 읽어온 원본(수정/이동 불가), que = Que에서 생성 */
  source: z.enum(["company", "que"]),
  title: z.string().min(1),
  ownerId: z.string().min(1),
  startAt: isoDateTime,
  endAt: isoDateTime,
  attendeeIds: z.array(z.string()).default([]),
  visibility: visibilitySchema.default("team"),
  externalCalendarId: z.string().optional(),
  lastChangedBy: z.string().optional(),
  lastChangedAt: isoDateTime.optional(),
});
export type CalendarEvent = z.infer<typeof calendarEventSchema>;

// ---------- Project / Milestone ----------

export const projectSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  ownerId: z.string().min(1),
  status: z.enum(["active", "archived"]),
  milestoneIds: z.array(z.string()).default([]),
});
export type Project = z.infer<typeof projectSchema>;

export const milestoneSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  title: z.string().min(1),
  dueAt: isoDateTime,
  riskStatus: z.enum(["on_track", "at_risk", "late"]),
  lastChangedBy: z.string().optional(),
  lastChangedAt: isoDateTime.optional(),
});
export type Milestone = z.infer<typeof milestoneSchema>;

// ---------- MeetingNote / ActionItem ----------

export const meetingNoteSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  projectId: z.string().optional(),
  meetingAt: isoDateTime,
  attendeeIds: z.array(z.string()).default([]),
  uploaderId: z.string().min(1),
  fileName: z.string().min(1),
  markdownBody: z.string(),
  /** 회의록 공개 범위: 팀 전체 / 프로젝트 참여자 / 관리자만 */
  visibility: z.enum(["team", "project", "admin"]).default("team"),
  extractionStatus: z.enum(["pending", "done"]),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
});
export type MeetingNote = z.infer<typeof meetingNoteSchema>;

export const actionItemStatusSchema = z.enum([
  "needs_review", // 확인 필요 (담당자 또는 마감일 누락)
  "candidate", // 생성 대기
  "created", // Task 생성됨
  "held", // 보류
  "ignored", // 무시
]);
export type ActionItemStatus = z.infer<typeof actionItemStatusSchema>;

export const actionItemSchema = z.object({
  id: z.string().min(1),
  meetingNoteId: z.string().min(1),
  /** 회의록 원문 문장 — Action의 출처 추적용으로 항상 보존한다 */
  sourceText: z.string().min(1),
  title: z.string().min(1),
  assigneeId: z.string().optional(),
  dueAt: isoDateTime.optional(),
  projectId: z.string().optional(),
  status: actionItemStatusSchema,
  createdTaskId: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
  lastChangedBy: z.string().optional(),
  lastChangedAt: isoDateTime.optional(),
  createdAt: isoDateTime,
});
export type ActionItem = z.infer<typeof actionItemSchema>;

// ---------- PaymentRequest ----------

export const paymentStatusSchema = z.enum(["waiting", "done", "cancelled"]);
export type PaymentStatus = z.infer<typeof paymentStatusSchema>;

export const paymentRequestSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  requesterId: z.string().min(1),
  bankName: z.string().min(1),
  /** 민감 정보 — 화면에서는 권한에 따라 마스킹한다 */
  accountNumber: z.string().min(1),
  amount: z.number().positive(),
  description: z.string().optional(),
  dueAt: isoDateTime.optional(),
  category: z.string().min(1),
  status: paymentStatusSchema,
  lastChangedBy: z.string().optional(),
  lastChangedAt: isoDateTime.optional(),
  createdAt: isoDateTime,
});
export type PaymentRequest = z.infer<typeof paymentRequestSchema>;

// ---------- 로그 / 체크인 / 작업량 ----------

export const statusLogSchema = z.object({
  id: z.string().min(1),
  taskId: z.string().min(1),
  actorId: z.string().min(1),
  fromStatus: taskStatusSchema,
  toStatus: taskStatusSchema,
  reason: z.string().optional(),
  nextAction: z.string().optional(),
  /** 문제발생/홀드에서 지목된 도움 필요한 사람 — 오늘/팀 현황 화면의 "내 관련" 판정에 쓴다 */
  helpUserId: z.string().optional(),
  nextCheckAt: isoDateTime.optional(),
  createdAt: isoDateTime,
});
export type StatusLog = z.infer<typeof statusLogSchema>;

export const changeViaSchema = z.enum(["web", "mcp", "cli"]);
export type ChangeVia = z.infer<typeof changeViaSchema>;

export const changeLogSchema = z.object({
  id: z.string().min(1),
  entityType: z.enum([
    "task",
    "calendar_event",
    "milestone",
    "action_item",
    "payment_request",
    "meeting_note",
  ]),
  entityId: z.string().min(1),
  actorId: z.string().min(1),
  changeType: z.enum(["create", "update", "move", "status_change", "delete"]),
  beforeValue: z.string().optional(),
  afterValue: z.string().optional(),
  reason: z.string().optional(),
  /** 어디서 변경됐는지 — 웹 UI / MCP 도구 / CLI */
  via: changeViaSchema,
  visibleTo: z.array(z.string()).optional(),
  createdAt: isoDateTime,
});
export type ChangeLog = z.infer<typeof changeLogSchema>;

export const checkInResponseSchema = z.enum([
  "working", // 작업중
  "done", // 완료
  "needs_reschedule", // 다른 작업 때문에 시간 변경 필요
  "issue", // 문제발생
  "not_needed", // 필요없어짐
  "merged", // 다른 프로젝트와 병합
  "later", // 나중에 답변
]);
export type CheckInResponse = z.infer<typeof checkInResponseSchema>;

export const checkInSchema = z.object({
  id: z.string().min(1),
  taskId: z.string().min(1),
  assigneeId: z.string().min(1),
  scheduledAt: isoDateTime,
  answeredAt: isoDateTime.optional(),
  response: checkInResponseSchema.optional(),
  followUpRequired: z.boolean().default(false),
});
export type CheckIn = z.infer<typeof checkInSchema>;

export const workloadMetricSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  date: isoDate,
  taskCount: z.number().int().min(0),
  estimatedHours: z.number().min(0),
  issueCount: z.number().int().min(0),
  holdCount: z.number().int().min(0),
  dueSoonCount: z.number().int().min(0),
  /** 0(여유)~4(과부하) — 히트맵 색상 강도 */
  intensity: z.number().int().min(0).max(4),
});
export type WorkloadMetric = z.infer<typeof workloadMetricSchema>;
