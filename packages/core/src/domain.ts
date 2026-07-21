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
  /** 연결된 월 KR(핵심결과) id — 단일(다대다는 8인 규모에 과설계, 기획 §2). 실재 검증은 mutation이 강제. */
  keyResultId: z.string().optional(),
  /** 간트 수동 정렬 — 프로젝트 내 표시 순서(오름차순). 사용자가 간트에서 행을 드래그해 정한 순서를
   *  reorderProjectTasks가 (index+1)*10으로 채운다. 미지정(과거 데이터)은 0으로 해석하고
   *  시작일(startAt)로 tie-break한다 — 표시 속성이라 lastChangedBy/lastChangedAt은 갱신하지 않는다. */
  sortOrder: z.number().int().optional(),
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
  // 관리자가 정한 표시 순서(오름차순) — 같은 클라이언트(또는 미소속) 그룹 안에서만 의미를 갖는다.
  // 클라이언트 sortOrder 선례. /clients·/projects 목록이 이 순서를 공유한다.
  sortOrder: z.number().int().default(0),
});
export type Project = z.infer<typeof projectSchema>;

export const milestoneSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  title: z.string().min(1),
  dueAt: isoDateTime,
  riskStatus: z.enum(["on_track", "at_risk", "late"]),
  /** 중요 마일스톤(최종 런칭일 등) — 켜면 전 화면 칩이 붉은 그라데이션으로 표기된다. */
  critical: z.boolean().optional(),
  /** 완료 시각(ISO). 있으면 이 마일스톤은 달성됨 — riskStatus(위험 의미)와 분리한 완료 개념이다.
   *  달성된 마일스톤은 위험·재촉·긴급 결정 로직에서 제외된다(각 판정 지점이 achievedAt를 스킵).
   *  setMilestoneAchieved가 토글한다: 완료=현재 시각 기록, 해제=필드 제거(다시 위험 로직에 편입). */
  achievedAt: isoDateTime.optional(),
  lastChangedBy: z.string().optional(),
  lastChangedAt: isoDateTime.optional(),
  /** 마지막 안건 결정(유지/연기/보류) — 긴급 결정 카드·재촉 DM의 당일 억제 근거.
   *  keep은 데이터를 바꾸지 않으므로 이 기록이 없으면 '미결정'으로 오판된다. */
  lastDecision: z.enum(["keep", "defer", "hold"]).optional(),
  lastDecisionAt: isoDateTime.optional(),
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
  /** 회의 종류 — weekly=월요일 주간 통합 회의, milestone=주중 수시 마일스톤 처리, general=일반.
   *  하위호환: 기존 데이터·미지정은 general(default). (데일리 스탠드업 기획 §1-f·§2) */
  kind: z.enum(["milestone", "weekly", "general"]).default("general"),
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

// ---------- StandupEntry (데일리 스탠드업 비동기 체크인) ----------

// 매일 10시 비동기 스탠드업에서 "사람이 쓴 말"만 저장한다(데일리 스탠드업 기획 §2).
// 파생 데이터(어제/오늘/막힘)는 저장하지 않고 getStandupData 파생을 계속 쓰되, 다음 날 재현이
// 안 되므로 제출 시점 Task id만 경량 동결(snapshotTaskIds)한다.
// (date, userId) 1건 유니크 — 재제출은 덮어쓰기. ChangeLog 생략(운영 리듬 기록 — RevisionNote 선례),
// updatedAt만 추적한다. 권한: 생성/수정 본인만, 조회 전원(도메인 규칙 "본인 작업만 수정" 정합).

/** 제출 시점 파생 4분면의 Task id만 경량 동결(다음 날 파생 재현 불가 대비). 표시는 여전히 파생을 쓴다. */
export const standupSnapshotSchema = z.object({
  yesterdayDone: z.array(z.string()),
  yesterdayUnfinished: z.array(z.string()),
  todayPlanned: z.array(z.string()),
});
export type StandupSnapshot = z.infer<typeof standupSnapshotSchema>;

export const standupEntrySchema = z.object({
  id: z.string().min(1),
  /** KST 날짜 키(YYYY-MM-DD). (date, userId) 유니크. */
  date: isoDate,
  userId: z.string().min(1),
  /** 오늘의 포커스 한마디 — 필수, 최대 200자. */
  focus: z.string().min(1).max(200),
  /** 부연(선택, 최대 1000자). */
  note: z.string().max(1000).optional(),
  /** 막힘 자유 서술(선택). */
  blockerText: z.string().max(1000).optional(),
  /** 막힌 작업 참조(선택 — issue/on_hold Task id). */
  blockedTaskIds: z.array(z.string()).optional(),
  /** 제출 시점 파생 4분면 Task id 동결. */
  snapshotTaskIds: standupSnapshotSchema,
  /** AI 개인 초안으로 프리필됐는지. */
  aiDrafted: z.boolean(),
  /** AI 초안을 사람이 편집했는지(선택). */
  draftEdited: z.boolean().optional(),
  submittedAt: isoDateTime,
  updatedAt: isoDateTime,
});
export type StandupEntry = z.infer<typeof standupEntrySchema>;

/** 스탠드업 제출 입력 검증. userId는 입력이 아니라 ctx.actorId에서 온다(본인만 — 대리 제출 차단).
 *  신뢰 못 할 클라이언트/MCP/CLI 값을 mutation 경로에서 파싱한다. */
export const submitStandupEntryInputSchema = z.object({
  date: isoDate,
  focus: z.string().trim().min(1, "오늘의 포커스는 필수다").max(200, "포커스는 200자 이내"),
  note: z.string().trim().max(1000, "부연은 1000자 이내").optional(),
  blockerText: z.string().trim().max(1000, "막힘 서술은 1000자 이내").optional(),
  blockedTaskIds: z.array(z.string()).optional(),
  snapshotTaskIds: standupSnapshotSchema,
  aiDrafted: z.boolean().optional(),
  draftEdited: z.boolean().optional(),
});
export type SubmitStandupEntryInput = z.infer<typeof submitStandupEntryInputSchema>;

// ---------- StandupTeamSummary (AI 팀 요약) ----------
// 날짜당 1건의 AI 팀 요약. **AI 저장 관례("AI는 확인을 거쳐 저장")의 의도적 예외**(기획 §2):
//  ⑴ Slack 게시·보드 표시 시점이 분리되고, ⑵ 하루 1회 pro 재생성 비용이 크며, ⑶ 과거 회고 재현이
//  필요해 시스템이 생성 즉시 저장한다. 사람 확인 게이트가 없는 유일한 AI 산출물이다.
// 권한: 시스템(크론) 생성 — 재생성만 admin(호출부가 강제). date 유니크 1건, 재생성은 덮어쓰기.
// ChangeLog는 남기지 않는다(운영 리듬 산출물 — StandupEntry·RevisionNote 선례).

export const standupTeamSummaryModelSchema = z.enum(["flash", "pro"]);
export type StandupTeamSummaryModel = z.infer<typeof standupTeamSummaryModelSchema>;

export const standupTeamSummarySchema = z.object({
  id: z.string().min(1),
  /** KST 날짜 키(YYYY-MM-DD). 유니크 1건 — 재생성은 덮어쓰기. */
  date: isoDate,
  generatedAt: isoDateTime,
  /** 생성에 실제로 쓴 모델. pro 우선, 실패 시 flash 폴백. */
  model: standupTeamSummaryModelSchema,
  /** 구조화 텍스트 — (a)막힘 클러스터+도울 사람 (b)어제→오늘 흐름 (c)추천 액션 2~3개. */
  content: z.string().min(1),
  /** 요약 생성 시점에 제출돼 있던 유저 id들(지각 제출 미반영 판정·"n인 미제출" 근거). */
  submittedUserIds: z.array(z.string()),
  /** admin 재생성 시 그 actorId(최초 자동 생성이면 미설정). */
  regeneratedBy: z.string().optional(),
});
export type StandupTeamSummary = z.infer<typeof standupTeamSummarySchema>;

// ---------- Objective / KeyResult (OKR — 분기 목표 + 월 핵심결과, 기획 §2) ----------
// 회사 레벨 단일 계층(팀/회사 분리는 8인 규모에 과설계). Objective=분기 목표, KeyResult=월 핵심결과.
// 목표 데이터는 감사 대상 — 생성·진척 변경은 ChangeLog에 남긴다(운영 리듬 산출물인 standup과 다르다).
// 권한: objectives는 admin, key_results는 admin 또는 Objective 소유자, manual 진척 입력은 KR 소유자+admin.

/** 분기 키(예: 2026-Q3). Q1~Q4만 허용. */
const periodPattern = /^\d{4}-Q[1-4]$/;
/** 월 키(예: 2026-07). 01~12만 허용. */
const monthPattern = /^\d{4}-(0[1-9]|1[0-2])$/;

export const objectiveStatusSchema = z.enum(["draft", "active", "done", "cancelled"]);
export type ObjectiveStatus = z.infer<typeof objectiveStatusSchema>;

export const objectiveSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  /** 분기 키(YYYY-Qn). */
  period: z.string().regex(periodPattern, "분기는 YYYY-Qn 형식이어야 한다 (예: 2026-Q3)"),
  ownerId: z.string().min(1),
  status: objectiveStatusSchema.default("active"),
  /** 표시 정렬 순서(작을수록 먼저). */
  order: z.number(),
  createdAt: isoDateTime,
});
export type Objective = z.infer<typeof objectiveSchema>;

/** Objective 생성 입력 검증(신뢰 못 할 클라이언트/MCP/CLI 값을 mutation 경로에서 파싱). */
export const createObjectiveInputSchema = z.object({
  title: z.string().trim().min(1, "제목은 필수다").max(200, "제목은 200자 이내"),
  description: z.string().trim().max(2000, "설명은 2000자 이내").optional(),
  period: z.string().trim().regex(periodPattern, "분기는 YYYY-Qn 형식이어야 한다 (예: 2026-Q3)"),
  ownerId: z.string().min(1, "소유자는 필수다"),
  status: objectiveStatusSchema.optional(),
  order: z.number().optional(),
});
export type CreateObjectiveInput = z.infer<typeof createObjectiveInputSchema>;

export const keyResultStatusSchema = z.enum(["active", "done", "cancelled"]);
export type KeyResultStatus = z.infer<typeof keyResultStatusSchema>;

/** KR 측정 방식(기획 §2 하이브리드 + OS-1 부록 A).
 *  manual=사람이 입력하는 수치, task_auto=연결 Task 완료율, state=상태 체크리스트 완료 비율. */
export const keyResultMetricTypeSchema = z.enum(["manual", "task_auto", "state"]);
export type KeyResultMetricType = z.infer<typeof keyResultMetricTypeSchema>;

/** 상태형 KR(OS-1 부록 A)의 체크 항목 1개. done 비율로 진척을 낸다.
 *  requiresAdminConfirm=true면 admin만 토글 가능(클라이언트 최종 승인 등 이중 확인 항목). */
export const stateCheckSchema = z.object({
  id: z.string().min(1),
  label: z.string().trim().min(1, "체크 항목 라벨은 필수다").max(100, "체크 항목은 100자 이내"),
  done: z.boolean(),
  /** true면 admin만 이 항목을 완료/해제할 수 있다(잠금). */
  requiresAdminConfirm: z.boolean(),
  /** 완료로 토글한 사람(감사용). */
  confirmedBy: z.string().optional(),
  /** 완료로 토글한 시각. */
  doneAt: isoDateTime.optional(),
});
export type StateCheck = z.infer<typeof stateCheckSchema>;

/** 상태형 KR 생성 입력의 체크 항목(id·done은 mutation이 부여한다). */
export const stateCheckInputSchema = z.object({
  label: z.string().trim().min(1, "체크 항목 라벨은 필수다").max(100, "체크 항목은 100자 이내"),
  requiresAdminConfirm: z.boolean().default(false),
});
export type StateCheckInput = z.infer<typeof stateCheckInputSchema>;

export const keyResultSchema = z
  .object({
    id: z.string().min(1),
    objectiveId: z.string().min(1),
    title: z.string().min(1).max(200),
    ownerId: z.string().min(1),
    /** 월 키(YYYY-MM). */
    month: z.string().regex(monthPattern, "월은 YYYY-MM 형식이어야 한다 (예: 2026-07)"),
    metricType: keyResultMetricTypeSchema,
    /** manual 측정용 — 목표치(양수). */
    targetValue: z.number().positive().optional(),
    /** manual 측정용 — 현재치. */
    currentValue: z.number().optional(),
    /** manual 측정용 — 단위(예: 건, %, 만원). */
    unit: z.string().max(20).optional(),
    /** state 측정용 — 상태 체크리스트(1~7개). state일 때만 유효. */
    stateChecks: z.array(stateCheckSchema).max(7).optional(),
    status: keyResultStatusSchema.default("active"),
    updatedAt: isoDateTime,
    updatedBy: z.string().min(1),
  })
  .refine((kr) => kr.metricType !== "manual" || (kr.targetValue ?? 0) > 0, {
    message: "manual KR은 목표치(targetValue)가 필수다 (양수)",
    path: ["targetValue"],
  })
  .refine((kr) => kr.metricType !== "state" || (kr.stateChecks?.length ?? 0) >= 1, {
    message: "state KR은 체크 항목이 1개 이상 필요하다",
    path: ["stateChecks"],
  });
export type KeyResult = z.infer<typeof keyResultSchema>;

/** KR 생성 입력 검증. manual이면 targetValue 필수(양수), state면 stateChecks 1개 이상을 refine으로 강제한다. */
export const createKeyResultInputSchema = z
  .object({
    objectiveId: z.string().min(1, "Objective는 필수다"),
    title: z.string().trim().min(1, "제목은 필수다").max(200, "제목은 200자 이내"),
    ownerId: z.string().min(1, "소유자는 필수다"),
    month: z.string().trim().regex(monthPattern, "월은 YYYY-MM 형식이어야 한다 (예: 2026-07)"),
    metricType: keyResultMetricTypeSchema,
    targetValue: z.number().positive("목표치는 양수여야 한다").optional(),
    currentValue: z.number().optional(),
    unit: z.string().trim().max(20, "단위는 20자 이내").optional(),
    /** state 측정용 — 체크 항목(label·requiresAdminConfirm). id·done은 mutation이 부여. */
    stateChecks: z.array(stateCheckInputSchema).max(7, "체크 항목은 7개 이내").optional(),
    status: keyResultStatusSchema.optional(),
  })
  .refine((kr) => kr.metricType !== "manual" || (kr.targetValue ?? 0) > 0, {
    message: "manual KR은 목표치(targetValue)가 필수다 (양수)",
    path: ["targetValue"],
  })
  .refine((kr) => kr.metricType !== "state" || (kr.stateChecks?.length ?? 0) >= 1, {
    message: "state KR은 체크 항목이 1개 이상 필요하다",
    path: ["stateChecks"],
  })
  // manual 필드(targetValue/unit)와 state 필드(stateChecks)는 배타 — 측정 방식과 무관한 필드는 거부.
  .refine((kr) => kr.metricType === "manual" || (kr.targetValue === undefined && kr.unit === undefined), {
    message: "manual이 아닌 KR에는 목표치·단위를 넣을 수 없다",
    path: ["targetValue"],
  })
  .refine((kr) => kr.metricType === "state" || (kr.stateChecks === undefined), {
    message: "state가 아닌 KR에는 체크 항목을 넣을 수 없다",
    path: ["stateChecks"],
  });
export type CreateKeyResultInput = z.infer<typeof createKeyResultInputSchema>;

// ---------- MilestoneRetro (OS-2a 실패 분류, 부록 B) ----------
// 마일스톤이 기한 초과로 종결되거나 수동 회고 시 남기는 불변 레코드. 회고=기록 그 자체라
// ChangeLog를 남기지 않는다(revision_notes 선례). 원칙: 회고는 프로젝트·마일스톤 단위 —
// 카드에 담당자 이름을 강조하지 않는다(감시 아님). createdBy는 감사용 최소 기록.

/** 실패 원인 대분류 — 내부(개선 가능) vs 외부(클라이언트·환경). */
export const retroCauseSchema = z.enum(["internal", "external"]);
export type RetroCause = z.infer<typeof retroCauseSchema>;

/** 실패 세부 유형(부록 B). 앞쪽은 내부 성향, 뒤쪽은 외부 성향이나 강제 매핑은 하지 않는다. */
export const retroCauseDetailSchema = z.enum([
  "schedule_mgmt", // 일정 관리 미흡(내부)
  "qa_lack", // QA 부족(내부)
  "communication", // 커뮤니케이션(내부)
  "approval_missed", // 승인 누락(내부)
  "client_direction", // 클라이언트 방향 전환(외부)
  "budget_change", // 예산 변경(외부)
  "schedule_change", // 일정 변경(외부)
  "event_cancelled", // 행사 취소(외부)
  "other", // 기타
]);
export type RetroCauseDetail = z.infer<typeof retroCauseDetailSchema>;

export const milestoneRetroSchema = z.object({
  id: z.string().min(1),
  milestoneId: z.string().min(1),
  cause: retroCauseSchema,
  causeDetail: retroCauseDetailSchema,
  /** 한 줄 메모(≤300자). */
  note: z.string().max(300).optional(),
  /** 대응 프로세스(외부 변경 접수 등)를 탔는가. */
  managed: z.boolean(),
  createdBy: z.string().min(1),
  createdAt: isoDateTime,
});
export type MilestoneRetro = z.infer<typeof milestoneRetroSchema>;

/** 회고 생성 입력 검증(웹/자동 생성 공유). id·createdBy·createdAt은 mutation이 부여. */
export const createMilestoneRetroInputSchema = z.object({
  milestoneId: z.string().min(1, "마일스톤은 필수다"),
  cause: retroCauseSchema,
  causeDetail: retroCauseDetailSchema,
  note: z.string().trim().max(300, "메모는 300자 이내").optional(),
  managed: z.boolean().default(false),
});
export type CreateMilestoneRetroInput = z.infer<typeof createMilestoneRetroInputSchema>;

// ---------- ChangeRequest (OS-2b 외부 변경 접수, 부록 C) ----------
// 클라이언트발 외부 변경을 접수→분석→재협의→승인→종결 5단계로 관리한다. SLA 24h 고정.
// 업무 영향 변경이라 ChangeLog에 기록(entityType "change_request"). 종결 시 external·managed 회고 자동 생성.

/** 외부 변경 대응 5단계(순서 강제). */
export const changeRequestStageSchema = z.enum([
  "received", // 접수
  "impact_analyzed", // 영향 분석
  "renegotiated", // 재협의
  "approved", // 승인(admin)
  "closed", // 종결
]);
export type ChangeRequestStage = z.infer<typeof changeRequestStageSchema>;

/** 단계 전이 로그 1건(누가·언제). */
export const changeRequestStageLogSchema = z.object({
  stage: changeRequestStageSchema,
  at: isoDateTime,
  by: z.string().min(1),
});
export type ChangeRequestStageLog = z.infer<typeof changeRequestStageLogSchema>;

export const changeRequestSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  milestoneId: z.string().optional(),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  stage: changeRequestStageSchema.default("received"),
  receivedAt: isoDateTime,
  /** 영향 분석 마감 = 접수 + 24h(SLA). */
  impactDeadline: isoDateTime,
  stageLog: z.array(changeRequestStageLogSchema).default([]),
  closedAt: isoDateTime.optional(),
});
export type ChangeRequest = z.infer<typeof changeRequestSchema>;

/** 변경 접수 입력 검증. receivedAt·impactDeadline·stage·stageLog는 mutation이 부여. */
export const createChangeRequestInputSchema = z.object({
  projectId: z.string().min(1, "프로젝트는 필수다"),
  milestoneId: z.string().optional(),
  title: z.string().trim().min(1, "제목은 필수다").max(200, "제목은 200자 이내"),
  description: z.string().trim().max(2000, "설명은 2000자 이내").optional(),
});
export type CreateChangeRequestInput = z.infer<typeof createChangeRequestInputSchema>;

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
 *  도움 대상을 지정하면 "도움 요청"이 되어 대상자의 오늘 화면과 팀 현황에 노출된다. */
export const taskCommentSchema = z.object({
  id: z.string().min(1),
  taskId: z.string().min(1),
  authorId: z.string().min(1),
  body: z.string().trim().min(1).max(1000),
  /** @deprecated 단일 도움 대상 — 하위호환 읽기용. 신규는 helpUserIds(배열). 읽기는 helpUserIdsOf로 통일. */
  helpUserId: z.string().optional(),
  /** 도움 대상 다중(2026-07-11 — statusLog 선례와 동일 패턴). 새 댓글은 [0]을 helpUserId에도 복제(FK·하위호환). */
  helpUserIds: z.array(z.string()).max(10).optional(),
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

// chat = Que Copilot(⌘K 채팅) 확정 실행 — 대화 경유 변경을 구분 기록한다(기획 모듈 D-2).
export const changeViaSchema = z.enum(["web", "mcp", "cli", "mobile", "slack", "chat"]);
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
    "objective",
    "key_result",
    "change_request",
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
