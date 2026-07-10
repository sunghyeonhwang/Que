import { z } from "zod";

// 데이터 모델 초안: data/docs/que-product-plan.md "데이터 모델 초안" 기준.
// 날짜/시간은 직렬화 가능성(웹/MCP/CLI 공유)을 위해 ISO 8601 문자열로 다룬다.

const isoDateTime = z.iso.datetime({ offset: true });
const isoDate = z.iso.date();

// ---------- User ----------

export const userRoleSchema = z.enum(["admin", "member"]);
export type UserRole = z.infer<typeof userRoleSchema>;

/** 직급(rank) 허용값 — 성과 스코프(gradeForRank) 유도 소스이자 표시 라벨.
 *  "대표"→ceo / "관리"→manager / "사원"→staff. 자유 문자열이 아니라 이 셋으로 강제한다
 *  (편집 UI·createUser 입력이 grade 커플링을 깨는 임의값을 넣지 못하게). */
export const RANK_VALUES = ["대표", "관리", "사원"] as const;
export const rankSchema = z.enum(RANK_VALUES);
export type Rank = z.infer<typeof rankSchema>;

export const userSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  role: userRoleSchema,
  /** 캘린더/아바타에서 멤버 구분에 쓰는 색 (hex) */
  avatarColor: z.string().regex(/^#[0-9a-f]{6}$/i),
  /** 직급(대표/관리/사원). 성과 스코프(gradeForUser)의 유도 소스. DB backfill로 항상 채워지지만
   *  안전하게 optional로 두고 헬퍼가 "사원"으로 폴백한다. email·passwordHash 등 인증/PII 컬럼은
   *  도메인 User에 넣지 않는다(SupabaseQueDb.load가 로드 시 제거) — 여기엔 표시용 필드만 둔다. */
  rank: z.string().max(50).optional(),
  /** 부서(팀 표시용, 임시 배정값). 헬퍼가 빈 문자열로 폴백한다. */
  department: z.string().max(50).optional(),
  /** 재직 여부. 비활성(deactivate)이면 로그인·조회에서 차단한다(hard delete 없음). */
  active: z.boolean().default(true),
});
export type User = z.infer<typeof userSchema>;

/**
 * 직원 추가(createUser) 입력 검증. 관리자만 호출하지만, 값 자체(이메일·이름·직급 등)는
 * 여기서 런타임 검증한다(웹/서버 액션이 신뢰할 수 없는 클라이언트 값을 넘길 수 있으므로).
 * 비밀번호는 입력받지 않는다 — 자동 임시비번 1회 발급(adminReset 패턴). email·passwordHash는
 * 도메인 User에 저장하지 않지만, 생성 입력에서는 로그인 식별자로 email을 받는다.
 */
export const createUserInputSchema = z.object({
  name: z.string().trim().min(1, "이름은 필수다").max(50, "이름은 50자 이내"),
  email: z.string().trim().toLowerCase().email("올바른 이메일이 아니다").max(200),
  role: userRoleSchema,
  rank: rankSchema,
  department: z.string().trim().max(50).optional(),
  /** 아바타/캘린더 구분색(hex). 미지정 시 서버가 미사용색을 제안한다. */
  avatarColor: z
    .string()
    .regex(/^#[0-9a-f]{6}$/i, "색상은 #RRGGBB 형식이어야 한다")
    .optional(),
});
export type CreateUserInput = z.infer<typeof createUserInputSchema>;

/**
 * 직원 프로필 편집(updateUserProfile) 입력 검증 — 관리자만 호출. email·rank·department만 편집한다
 * (name·role·active는 대상 밖: name은 편집 제외, role은 별도 mutation, active는 비활성/복구 경로).
 * 부분 편집(PATCH)이라 모든 필드가 optional이지만, **최소 1개**는 있어야 한다(빈 요청 거부).
 * department는 빈 문자열("")도 허용 — "부서 비우기"를 명시적 편집으로 받는다.
 */
export const updateUserProfileInputSchema = z
  .object({
    email: z.string().trim().toLowerCase().email("올바른 이메일이 아니다").max(200).optional(),
    rank: rankSchema.optional(),
    department: z.string().trim().max(50).optional(),
  })
  .refine(
    (v) => v.email !== undefined || v.rank !== undefined || v.department !== undefined,
    { message: "변경할 항목을 최소 하나는 지정해야 한다" },
  );
export type UpdateUserProfileInput = z.infer<typeof updateUserProfileInputSchema>;

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
  reason: z.string().trim().min(1, "사유는 필수다").max(500, "사유는 500자 이내"),
  nextAction: z.string().max(500).optional(),
  /** @deprecated 단일 도움 대상 — 하위호환용. 신규 입력은 helpUserIds(배열)를 쓴다.
   *  둘 다 오면 helpUserIds가 우선이다(helpUserIdsOf 참고). */
  helpUserId: z.string().max(100).optional(),
  /** 도움 필요한 사람들 — 여러 명 지정 가능. 최대 10명. */
  helpUserIds: z.array(z.string().max(100)).max(10).optional(),
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

export const taskSourceSchema = z.enum([
  "manual",
  "natural_language",
  "action_item",
  "recurring_template",
]);
export const visibilitySchema = z.enum(["team", "private"]);
export type Visibility = z.infer<typeof visibilitySchema>;

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
  /** 선행 작업 id 목록 — "이 작업들이 끝나야 시작"(Finish-to-Start 단일 의미, E-9).
   *  같은 프로젝트 내에서만·자기 참조/순환 금지는 setTaskPredecessors mutation이 강제한다. */
  predecessorIds: z.array(z.string().min(1)).max(20).optional(),
  /** source가 recurring_template일 때 생성 출처 템플릿 (추적용) */
  recurringTemplateId: z.string().optional(),
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

// ---------- Client / Project / Milestone ----------

// 2단 분류의 상위 개념 — 거래처(멘딕스·에픽게임즈 등). 자사 그리프도 클라이언트 행 하나로
// 동일하게 취급한다(특수 분기 없음). 8인 MVP라 최소 필드만 둔다 —
// color/initials/ownerId는 넣지 않는다. 사용자 라벨은 "클라이언트".
// sortOrder: 관리자가 정한 표시 순서(오름차순). 스위처·관리화면·집계 소스가 이 순서를 공유한다.
export const clientSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1, "이름은 필수다").max(200, "이름은 200자 이내"),
  status: z.enum(["active", "archived"]),
  sortOrder: z.number().int().default(0),
});
export type Client = z.infer<typeof clientSchema>;

export const projectSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  ownerId: z.string().min(1),
  status: z.enum(["active", "archived"]),
  // 상위 클라이언트(거래처). optional — 클라이언트 없는 내부 잡무를 허용하고,
  // 마이그레이션을 무파괴로 만든다. Task는 clientId를 직접 갖지 않고 project를 통해 간접 참조한다.
  clientId: z.string().optional(),
  // PM 도구(/projects) 프로젝트 설명. DB check(char_length<=2000)와 동일 상한.
  description: z.string().max(2000).optional(),
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
  /** 대표 프로젝트(단일). 하위호환용 — 다중은 projectIds를 본다. projectIds[0]과 동일하게 유지된다. */
  projectId: z.string().optional(),
  /** 다중 프로젝트 배경(주간회의 등 여러 프로젝트 아젠다). 미지정 회의록은 빈 배열/undefined. */
  projectIds: z.array(z.string()).optional(),
  meetingAt: isoDateTime,
  attendeeIds: z.array(z.string()).default([]),
  uploaderId: z.string().min(1),
  fileName: z.string().min(1),
  markdownBody: z.string(),
  /** 회의록 공개 범위: 팀 전체 / 프로젝트 참여자 / 관리자만 / 지정 인원만(restrictedUserIds) */
  visibility: z.enum(["team", "project", "admin", "restricted"]).default("team"),
  /** visibility가 "restricted"일 때만 사용 — 이 목록의 사용자와 관리자·업로더만 열람 가능 (예: 연봉협상 회의록) */
  restrictedUserIds: z.array(z.string()).optional(),
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

// ---------- RecurringTemplate ----------

/** 매주/매월 반복되는 정기 업무를 Task로 대신 만들어주는 템플릿 (기획서 "반복 업무 템플릿", 2026-07-03 확정). */
export const recurrenceFrequencySchema = z.enum(["weekly", "monthly"]);
export type RecurrenceFrequency = z.infer<typeof recurrenceFrequencySchema>;

export const recurringTemplateSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1).max(200),
    assigneeId: z.string().min(1),
    projectId: z.string().optional(),
    frequency: recurrenceFrequencySchema,
    /** frequency가 weekly일 때 필수. 0=일 ~ 6=토 */
    dayOfWeek: z.number().int().min(0).max(6).optional(),
    /** frequency가 monthly일 때 필수. 월말 문제를 피하려고 1~28로 제한한다 */
    dayOfMonth: z.number().int().min(1).max(28).optional(),
    startTime: z.string().regex(/^\d{2}:\d{2}$/, "HH:mm 형식이어야 한다"),
    durationMinutes: z.number().int().positive().max(24 * 60).default(60),
    description: z.string().max(2000).optional(),
    active: z.boolean().default(true),
    createdBy: z.string().min(1),
    createdAt: isoDateTime,
    /** 마지막으로 Task를 생성해준 회차의 날짜(YYYY-MM-DD) — 중복 생성 방지용 */
    lastGeneratedFor: isoDate.optional(),
  })
  .refine((t) => (t.frequency === "weekly" ? t.dayOfWeek !== undefined : true), {
    message: "매주 반복은 요일을 지정해야 한다",
    path: ["dayOfWeek"],
  })
  .refine((t) => (t.frequency === "monthly" ? t.dayOfMonth !== undefined : true), {
    message: "매월 반복은 날짜를 지정해야 한다",
    path: ["dayOfMonth"],
  });
export type RecurringTemplate = z.infer<typeof recurringTemplateSchema>;

// ---------- AlertRead (알림 읽음 표시, C-3a 알림 센터) ----------
// 알림은 상태 파생 스냅샷(alerts-data)이라 저장하지 않고, "읽음"만 사용자별로 저장한다.
// 항목이 해결되면 알림은 자연 소멸하고 읽음 행만 잔존(무해·소량). 업무 데이터가 아니라 ChangeLog 없음.

export const alertReadSchema = z.object({
  /** `${userId}:${alertId}` — 사용자·알림당 1행(멱등 upsert 키). */
  id: z.string().min(1),
  userId: z.string().min(1),
  /** 파생 알림의 안정 id (예: issue-task-123, overdue-task-9). */
  alertId: z.string().min(1),
  readAt: isoDateTime,
});
export type AlertRead = z.infer<typeof alertReadSchema>;

// ---------- RevisionNote (수정사항/이슈 트래커) ----------

// 테스트 중 발견한 수정사항을 적는 팀 공용 목록. 비즈니스 업무 데이터가 아니라 ChangeLog는 남기지
// 않고(간단 유지), updatedAt/updatedBy만 추적한다. 인증만 하면 누구나 작성·상태 변경이 가능하다.
export const revisionNoteStatusSchema = z.enum([
  "unresolved", // 미해결
  "hold", // 보류
  "resolved", // 해결
]);
export type RevisionNoteStatus = z.infer<typeof revisionNoteStatusSchema>;

export const revisionNoteSchema = z.object({
  id: z.string().min(1),
  /** 어느 화면(메뉴)에서 발견했는지 — 메뉴 라벨 등 자유 텍스트 */
  menu: z.string().min(1).max(100),
  /** 화면 내 위치(자유 텍스트). 선택. */
  location: z.string().max(200).optional(),
  /** 오류/수정 내용 — 필수 */
  description: z.string().min(1).max(2000),
  status: revisionNoteStatusSchema,
  authorId: z.string().min(1),
  createdAt: isoDateTime,
  /** 마지막 상태 변경 시각 */
  updatedAt: isoDateTime.optional(),
  /** 마지막 상태 변경자 */
  updatedBy: z.string().optional(),
});
export type RevisionNote = z.infer<typeof revisionNoteSchema>;

/** 수정사항 등록 입력 검증. 신뢰 못 할 클라이언트/MCP/CLI 값을 mutation 경로에서 파싱한다. */
export const createRevisionNoteInputSchema = z.object({
  menu: z.string().trim().min(1, "메뉴는 필수다").max(100, "메뉴는 100자 이내"),
  location: z.string().trim().max(200, "위치는 200자 이내").optional(),
  description: z
    .string()
    .trim()
    .min(1, "오류사항은 필수다")
    .max(2000, "오류사항은 2000자 이내"),
  status: revisionNoteStatusSchema.optional(),
});
export type CreateRevisionNoteInput = z.infer<typeof createRevisionNoteInputSchema>;

// ---------- PaymentRequest ----------

export const paymentStatusSchema = z.enum(["waiting", "done", "cancelled"]);
export type PaymentStatus = z.infer<typeof paymentStatusSchema>;

export const paymentRequestSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  requesterId: z.string().min(1),
  /** 입금받을 곳 — 상호/사람/기관명. 기존 데이터 호환을 위해 선택 필드다. */
  recipientName: z.string().min(1).max(100).optional(),
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

// 결제 요청 분류(카테고리) — 관리자가 관리하는 목록. 클라이언트(거래처)와 동일 구조:
// 최소 필드(id/name/status)에 표시 순서(sortOrder)만 둔다. 결제 폼 select가 active 목록에서 이름을 고른다.
// payment.category는 문자열 그대로 유지(하위호환) — 이 목록은 폼의 선택지 소스일 뿐 FK가 아니다.
export const paymentCategorySchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1, "이름은 필수다").max(50, "이름은 50자 이내"),
  status: z.enum(["active", "archived"]),
  sortOrder: z.number().int().default(0),
});
export type PaymentCategory = z.infer<typeof paymentCategorySchema>;

// ---------- 댓글 ----------

/** 작업 댓글 — 타인의 작업을 수정할 수 없는 팀원이 의사를 전달하는 통로.
 *  helpUserId를 지정하면 "도움 요청"이 되어 대상자의 오늘 화면과 팀 현황에 노출된다. */
export const taskCommentSchema = z.object({
  id: z.string().min(1),
  taskId: z.string().min(1),
  authorId: z.string().min(1),
  body: z.string().trim().min(1).max(1000),
  helpUserId: z.string().optional(),
  createdAt: isoDateTime,
});
export type TaskComment = z.infer<typeof taskCommentSchema>;

// ---------- 로그 / 체크인 / 작업량 ----------

export const statusLogSchema = z.object({
  id: z.string().min(1),
  taskId: z.string().min(1),
  actorId: z.string().min(1),
  fromStatus: taskStatusSchema,
  toStatus: taskStatusSchema,
  reason: z.string().optional(),
  nextAction: z.string().optional(),
  /** @deprecated 문제발생/홀드에서 지목된 도움 필요한 사람(단일) — 레거시 컬럼(status_logs.help_user_id).
   *  다중 지원 후에도 하위호환 읽기·FK 유지를 위해 남긴다. 새 로그는 helpUserIds[0]과 동일값을 채운다.
   *  "내 관련" 판정은 helpUserIdsOf(log)로 통일해 단일/다중 모두 커버한다. */
  helpUserId: z.string().optional(),
  /** 문제발생/홀드에서 지목된 도움 필요한 사람들(다중) — status_logs.help_user_ids(text[]) */
  helpUserIds: z.array(z.string()).optional(),
  nextCheckAt: isoDateTime.optional(),
  createdAt: isoDateTime,
});
export type StatusLog = z.infer<typeof statusLogSchema>;

export const changeViaSchema = z.enum(["web", "mcp", "cli", "mobile", "slack"]);
export type ChangeVia = z.infer<typeof changeViaSchema>;

export const changeLogSchema = z.object({
  id: z.string().min(1),
  entityType: z.enum([
    "task",
    "calendar_event",
    "milestone",
    "action_item",
    "payment_request",
    "payment_category",
    "meeting_note",
    "recurring_template",
    "project",
    "client",
    "user",
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
  /** '나중에' 응답 시 다시 물어볼 시각 — 이 시각이 지날 때까지 pending/응답대기에서 제외한다.
   *  상한 48시간(mutation에서 강제). definitive 응답 시 정리된다. */
  snoozeUntil: isoDateTime.optional(),
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
