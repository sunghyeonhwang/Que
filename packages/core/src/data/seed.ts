import type {
  ActionItem,
  CalendarEvent,
  ChangeLog,
  ChangeRequest,
  CheckIn,
  Client,
  KeyResult,
  MeetingNote,
  Milestone,
  MilestoneRetro,
  Objective,
  PaymentCategory,
  PaymentRequest,
  Project,
  RecurringTemplate,
  RevisionNote,
  StandupEntry,
  StandupTeamSummary,
  StatusLog,
  Task,
  TaskComment,
} from "../domain";
import { USERS } from "../mock/users";

// Phase 3~5 화면 개발용 mock 시드. 기준 시각(now)에 상대적으로 생성해
// 언제 실행해도 "오늘" 화면에 데이터가 보이게 한다.

export interface QueSeed {
  clients: Client[];
  projects: Project[];
  milestones: Milestone[];
  tasks: Task[];
  calendarEvents: CalendarEvent[];
  meetingNotes: MeetingNote[];
  actionItems: ActionItem[];
  paymentCategories: PaymentCategory[];
  paymentRequests: PaymentRequest[];
  statusLogs: StatusLog[];
  changeLogs: ChangeLog[];
  checkIns: CheckIn[];
  taskComments: TaskComment[];
  recurringTemplates: RecurringTemplate[];
  revisionNotes: RevisionNote[];
  standupEntries: StandupEntry[];
  standupTeamSummaries: StandupTeamSummary[];
  objectives: Objective[];
  keyResults: KeyResult[];
  milestoneRetros: MilestoneRetro[];
  changeRequests: ChangeRequest[];
}

export function createSeed(now: Date): QueSeed {
  const at = (dayOffset: number, hour: number, minute = 0): string => {
    const d = new Date(now);
    d.setDate(d.getDate() + dayOffset);
    d.setHours(hour, minute, 0, 0);
    return d.toISOString();
  };

  const [hwang, oh, sungjin, park, song, yejin, riwon] = USERS;

  // 상위 분류 = 클라이언트(거래처). 자사 그리프도 클라이언트 한 행으로 동일 취급한다.
  const clients: Client[] = [
    { id: "client-mendix", name: "멘딕스", status: "active", sortOrder: 0 },
    { id: "client-epic", name: "에픽게임즈", status: "active", sortOrder: 1 },
    { id: "client-griff", name: "그리프", status: "active", sortOrder: 2 },
  ];

  const projects: Project[] = [
    {
      id: "prj-summer",
      name: "여름 프로모션",
      ownerId: hwang.id,
      status: "active",
      clientId: "client-mendix",
      milestoneIds: ["ms-summer-open", "ms-summer-report"],
      sortOrder: 0,
    },
    {
      id: "prj-payment",
      name: "결제 개선",
      ownerId: oh.id,
      status: "active",
      clientId: "client-epic",
      milestoneIds: ["ms-payment-qa"],
      sortOrder: 0,
    },
    {
      id: "prj-cs",
      name: "CS 운영",
      ownerId: yejin.id,
      status: "active",
      clientId: "client-griff", // 자사(그리프) 내부 운영도 클라이언트 행으로 취급
      milestoneIds: ["ms-cs-faq"],
      sortOrder: 0,
    },
  ];

  const milestones: Milestone[] = [
    { id: "ms-summer-open", projectId: "prj-summer", title: "프로모션 오픈", dueAt: at(7, 10), riskStatus: "on_track" },
    { id: "ms-summer-report", projectId: "prj-summer", title: "결과 리포트", dueAt: at(14, 18), riskStatus: "on_track" },
    { id: "ms-payment-qa", projectId: "prj-payment", title: "결제 QA 완료", dueAt: at(2, 18), riskStatus: "at_risk" },
    { id: "ms-cs-faq", projectId: "prj-cs", title: "FAQ 개편 배포", dueAt: at(5, 12), riskStatus: "on_track" },
  ];

  const tasks: Task[] = [
    {
      id: "task-landing-copy",
      title: "랜딩페이지 문구 수정",
      ownerId: hwang.id,
      assigneeId: hwang.id,
      projectId: "prj-summer",
      startAt: at(0, 9, 30),
      endAt: at(0, 11),
      status: "in_progress",
      priority: "high",
      description: "11:00까지 초안 공유",
      estimatedHours: 1.5,
      source: "manual",
      visibility: "team",
      keyResultId: "kr-summer-tasks", // task_auto KR 연결(진척 자동 집계)
    },
    {
      id: "task-ad-review",
      title: "광고 소재 검수",
      ownerId: oh.id,
      assigneeId: oh.id,
      projectId: "prj-summer",
      startAt: at(0, 11, 30),
      endAt: at(0, 12, 30),
      status: "scheduled",
      priority: "normal",
      estimatedHours: 1,
      source: "manual",
      visibility: "team",
    },
    {
      id: "task-detail-qa",
      title: "상세페이지 QA",
      ownerId: hwang.id,
      assigneeId: hwang.id,
      projectId: "prj-summer",
      startAt: at(0, 13),
      endAt: at(0, 15),
      status: "scheduled",
      priority: "high",
      description: "자동 체크인 응답 대기",
      estimatedHours: 2,
      source: "natural_language",
      visibility: "team",
      keyResultId: "kr-summer-tasks", // task_auto KR 연결(진척 자동 집계)
    },
    {
      id: "task-payment-qa",
      title: "결제 페이지 QA",
      ownerId: oh.id,
      assigneeId: park.id,
      projectId: "prj-payment",
      startAt: at(0, 10),
      endAt: at(0, 12),
      status: "issue",
      priority: "high",
      description: "API 응답 오류로 멈춤",
      estimatedHours: 3,
      source: "manual",
      visibility: "team",
      lastChangedBy: park.id,
      lastChangedAt: at(0, 10, 40),
    },
    {
      id: "task-weekly-report",
      title: "주간 리포트 정리",
      ownerId: sungjin.id,
      assigneeId: sungjin.id,
      startAt: at(0, 15, 30),
      endAt: at(0, 17),
      status: "scheduled",
      priority: "normal",
      description: "데이터 확인 필요",
      estimatedHours: 1.5,
      source: "manual",
      visibility: "team",
    },
    {
      id: "task-banner-design",
      title: "프로모션 배너 시안",
      ownerId: riwon.id,
      assigneeId: riwon.id,
      projectId: "prj-summer",
      startAt: at(0, 10),
      endAt: at(0, 13),
      status: "in_progress",
      priority: "normal",
      estimatedHours: 3,
      source: "manual",
      visibility: "team",
    },
    {
      id: "task-cs-macro",
      title: "CS 응대 매크로 정리",
      ownerId: yejin.id,
      assigneeId: riwon.id,
      projectId: "prj-cs",
      startAt: at(0, 14),
      endAt: at(0, 16),
      status: "on_hold",
      priority: "normal",
      description: "FAQ 개편 방향 확정 대기",
      estimatedHours: 2,
      source: "manual",
      visibility: "team",
      lastChangedBy: riwon.id,
      lastChangedAt: at(-1, 17, 30),
    },
    {
      id: "task-stock-check",
      title: "재고 수량 확인",
      ownerId: song.id,
      assigneeId: song.id,
      startAt: at(0, 9),
      endAt: at(0, 10),
      status: "done",
      priority: "normal",
      estimatedHours: 1,
      source: "manual",
      visibility: "team",
      lastChangedBy: song.id,
      lastChangedAt: at(0, 10, 5),
    },
    {
      id: "task-faq-draft",
      title: "CS FAQ 초안 정리",
      ownerId: yejin.id,
      assigneeId: yejin.id,
      projectId: "prj-cs",
      startAt: at(1, 14),
      endAt: at(1, 16),
      status: "scheduled",
      priority: "normal",
      estimatedHours: 2,
      source: "action_item",
      visibility: "team",
    },
    {
      id: "task-api-schema",
      title: "결제 API 응답 형식 확인",
      ownerId: oh.id,
      assigneeId: oh.id,
      projectId: "prj-payment",
      startAt: at(1, 10),
      endAt: at(1, 12),
      status: "scheduled",
      priority: "high",
      description: "프론트 표시값과 백엔드 응답 스키마 맞추기",
      estimatedHours: 2,
      source: "action_item",
      visibility: "team",
    },
    {
      id: "task-final-review",
      title: "상세페이지 최종 검수",
      ownerId: hwang.id,
      assigneeId: riwon.id,
      projectId: "prj-summer",
      startAt: at(1, 10),
      endAt: at(1, 12),
      status: "scheduled",
      priority: "high",
      estimatedHours: 2,
      source: "manual",
      visibility: "team",
    },
    {
      id: "task-old-copy",
      title: "구버전 상세 문구 백업",
      ownerId: sungjin.id,
      assigneeId: sungjin.id,
      projectId: "prj-summer",
      startAt: at(-1, 15),
      endAt: at(-1, 16),
      status: "cancelled",
      priority: "low",
      estimatedHours: 1,
      source: "manual",
      visibility: "team",
      lastChangedBy: sungjin.id,
      lastChangedAt: at(-1, 15, 20),
    },
  ];

  const calendarEvents: CalendarEvent[] = [
    {
      id: "evt-ad-meeting",
      source: "company",
      title: "광고 소재 검수 회의",
      ownerId: oh.id,
      startAt: at(0, 10),
      endAt: at(0, 11),
      attendeeIds: [oh.id, hwang.id, riwon.id],
      visibility: "team",
      externalCalendarId: "google:ad-review",
    },
    {
      id: "evt-weekly-sync",
      source: "company",
      title: "주간 전체 회의",
      ownerId: hwang.id,
      startAt: at(1, 9, 30),
      endAt: at(1, 10, 30),
      attendeeIds: USERS.map((u) => u.id),
      visibility: "team",
      externalCalendarId: "google:weekly-sync",
    },
    {
      id: "evt-park-away",
      source: "company",
      title: "개인 일정",
      ownerId: park.id,
      startAt: at(0, 16),
      endAt: at(0, 18),
      attendeeIds: [park.id],
      visibility: "private",
      externalCalendarId: "google:park-private",
    },
    {
      id: "evt-cs-review",
      source: "que",
      title: "CS FAQ 개편 리뷰",
      ownerId: yejin.id,
      startAt: at(2, 14),
      endAt: at(2, 15),
      attendeeIds: [yejin.id, riwon.id, hwang.id],
      visibility: "team",
    },
  ];

  const meetingNotes: MeetingNote[] = [
    {
      id: "note-payment-qa",
      title: "결제 플로우 QA 회의",
      projectId: "prj-payment",
      meetingAt: at(-1, 14),
      attendeeIds: [oh.id, park.id, hwang.id],
      uploaderId: oh.id,
      fileName: "결제 플로우 QA.md",
      markdownBody: [
        "# 결제 플로우 QA 회의",
        "",
        "## 결정사항",
        "- 결제 API 응답 형식을 프론트 표시값과 맞춘다. (담당: 오승훈, 내일까지)",
        "- 오류 재현 시나리오를 문서화한다.",
        "",
        "## 할 일",
        "- CS FAQ 초안을 정리한다. (담당: 이예진)",
        "- 환불 정책 문구 검토 — 담당자 미정",
      ].join("\n"),
      visibility: "team",
      kind: "general",
      extractionStatus: "done",
      createdAt: at(-1, 15),
      updatedAt: at(-1, 15),
    },
    {
      id: "note-summer-kickoff",
      title: "여름 프로모션 킥오프",
      projectId: "prj-summer",
      meetingAt: at(-3, 10),
      attendeeIds: [hwang.id, riwon.id, sungjin.id, song.id],
      uploaderId: hwang.id,
      fileName: "여름 프로모션 킥오프.md",
      markdownBody: "# 여름 프로모션 킥오프\n\n- 오픈 D-7 기준으로 역산 일정 확정\n- 배너 시안 2종 우선",
      visibility: "team",
      kind: "general",
      extractionStatus: "pending",
      createdAt: at(-3, 11),
      updatedAt: at(-3, 11),
    },
    {
      id: "note-salary-review",
      title: "박승환 연봉협상",
      meetingAt: at(-2, 16),
      attendeeIds: [hwang.id, park.id],
      uploaderId: hwang.id,
      fileName: "연봉협상_박승환.md",
      markdownBody: "# 박승환 연봉협상\n\n- 다음 분기 목표와 연동해 재검토\n- 결과는 별도 서면 통보",
      visibility: "restricted",
      restrictedUserIds: [park.id],
      kind: "general",
      extractionStatus: "done",
      createdAt: at(-2, 17),
      updatedAt: at(-2, 17),
    },
  ];

  const actionItems: ActionItem[] = [
    {
      id: "act-api-schema",
      meetingNoteId: "note-payment-qa",
      sourceText: "결제 API 응답 형식을 프론트 표시값과 맞춘다. (담당: 오승훈, 내일까지)",
      title: "결제 API 응답 형식 확인",
      assigneeId: oh.id,
      dueAt: at(1, 18),
      projectId: "prj-payment",
      status: "created",
      createdTaskId: "task-api-schema",
      confidence: 0.92,
      createdAt: at(-1, 15, 10),
    },
    {
      id: "act-faq-draft",
      meetingNoteId: "note-payment-qa",
      sourceText: "CS FAQ 초안을 정리한다. (담당: 이예진)",
      title: "CS FAQ 초안 정리",
      assigneeId: yejin.id,
      dueAt: at(1, 18),
      projectId: "prj-cs",
      status: "created",
      createdTaskId: "task-faq-draft",
      confidence: 0.88,
      createdAt: at(-1, 15, 10),
    },
    {
      id: "act-error-doc",
      meetingNoteId: "note-payment-qa",
      sourceText: "오류 재현 시나리오를 문서화한다.",
      title: "결제 오류 재현 시나리오 문서화",
      assigneeId: park.id,
      dueAt: at(2, 18),
      projectId: "prj-payment",
      status: "candidate",
      confidence: 0.81,
      createdAt: at(-1, 15, 10),
    },
    {
      id: "act-refund-copy",
      meetingNoteId: "note-payment-qa",
      sourceText: "환불 정책 문구 검토 — 담당자 미정",
      title: "환불 정책 문구 검토",
      dueAt: at(3, 18),
      projectId: "prj-payment",
      status: "needs_review",
      confidence: 0.64,
      createdAt: at(-1, 15, 10),
    },
    {
      id: "act-banner-copy",
      meetingNoteId: "note-summer-kickoff",
      sourceText: "배너 시안 2종 우선",
      title: "배너 카피 후보 정리",
      assigneeId: riwon.id,
      projectId: "prj-summer",
      status: "needs_review",
      confidence: 0.58,
      createdAt: at(-3, 11, 5),
    },
    {
      id: "act-salary-followup",
      meetingNoteId: "note-salary-review",
      sourceText: "다음 분기 목표와 연동해 재검토",
      title: "연봉 재검토 후속 확인",
      assigneeId: park.id,
      status: "needs_review",
      confidence: 0.6,
      createdAt: at(-2, 17, 5),
    },
  ];

  // 결제 요청 분류(카테고리) — 관리자가 관리. 아래 결제 시드가 쓰는 이름과 정합.
  const paymentCategories: PaymentCategory[] = [
    { id: "paycat-subscription", name: "구독", status: "active", sortOrder: 0 },
    { id: "paycat-logistics", name: "물류", status: "active", sortOrder: 1 },
    { id: "paycat-license", name: "라이선스", status: "active", sortOrder: 2 },
    { id: "paycat-outsourcing", name: "외주", status: "active", sortOrder: 3 },
  ];

  const paymentRequests: PaymentRequest[] = [
    {
      id: "pay-stock-photo",
      title: "스톡 이미지 연간 구독",
      requesterId: riwon.id,
      recipientName: "셔터스톡 코리아",
      bankName: "신한은행",
      accountNumber: "110-123-456789",
      amount: 264000,
      description: "프로모션 배너 제작용",
      dueAt: at(1, 17),
      category: "구독",
      status: "waiting",
      createdAt: at(-1, 9),
    },
    {
      id: "pay-courier",
      title: "샘플 발송 택배비",
      requesterId: song.id,
      recipientName: "대한통운",
      bankName: "국민은행",
      accountNumber: "012-34-5678-901",
      amount: 48000,
      dueAt: at(-1, 17),
      category: "물류",
      status: "waiting",
      createdAt: at(-2, 14),
    },
    {
      id: "pay-fonts",
      title: "폰트 라이선스",
      requesterId: sungjin.id,
      recipientName: "산돌구름",
      bankName: "우리은행",
      accountNumber: "1002-345-678901",
      amount: 99000,
      category: "라이선스",
      status: "done",
      lastChangedBy: hwang.id,
      lastChangedAt: at(-2, 11),
      createdAt: at(-4, 10),
    },
    {
      id: "pay-cancel-sample",
      title: "외주 촬영 선금",
      requesterId: riwon.id,
      recipientName: "스튜디오 담",
      bankName: "하나은행",
      accountNumber: "123-456789-01234",
      amount: 500000,
      description: "일정 변경으로 취소",
      category: "외주",
      status: "cancelled",
      lastChangedBy: hwang.id,
      lastChangedAt: at(-1, 16),
      createdAt: at(-3, 13),
    },
  ];

  const statusLogs: StatusLog[] = [
    {
      id: "slog-payment-qa-issue",
      taskId: "task-payment-qa",
      actorId: park.id,
      fromStatus: "in_progress",
      toStatus: "issue",
      reason: "API 응답 오류로 멈춤",
      nextAction: "응답 스키마 확인 후 재개",
      helpUserId: oh.id,
      nextCheckAt: at(0, 14, 30),
      createdAt: at(0, 10, 40),
    },
    {
      id: "slog-cs-macro-hold",
      taskId: "task-cs-macro",
      actorId: riwon.id,
      fromStatus: "scheduled",
      toStatus: "on_hold",
      reason: "FAQ 개편 방향 확정 대기",
      nextCheckAt: at(1, 10),
      createdAt: at(-1, 17, 30),
    },
  ];

  const changeLogs: ChangeLog[] = [
    {
      id: "clog-payment-qa",
      entityType: "task",
      entityId: "task-payment-qa",
      actorId: park.id,
      changeType: "status_change",
      beforeValue: "in_progress",
      afterValue: "issue",
      reason: "API 응답 오류로 멈춤",
      via: "web",
      createdAt: at(0, 10, 40),
    },
    {
      id: "clog-final-review-move",
      entityType: "task",
      entityId: "task-final-review",
      actorId: hwang.id,
      changeType: "move",
      beforeValue: at(0, 16),
      afterValue: at(1, 10),
      via: "web",
      createdAt: at(-1, 18, 10),
    },
  ];

  const checkIns: CheckIn[] = [
    {
      id: "chk-detail-qa",
      taskId: "task-detail-qa",
      assigneeId: hwang.id,
      scheduledAt: at(0, 13),
      followUpRequired: false,
    },
    {
      id: "chk-stock-check",
      taskId: "task-stock-check",
      assigneeId: song.id,
      scheduledAt: at(0, 9),
      answeredAt: at(0, 9, 2),
      response: "working",
      followUpRequired: false,
    },
  ];

  const taskComments: TaskComment[] = [
    {
      id: "cmt-payment-qa-log",
      taskId: "task-payment-qa",
      authorId: oh.id,
      body: "재현되는 요청/응답 로그를 스레드에 공유해주시면 바로 확인하겠습니다.",
      createdAt: at(0, 11, 5),
    },
  ];

  const recurringTemplates: RecurringTemplate[] = [
    {
      id: "tmpl-weekly-standup",
      title: "주간 스탠드업 준비",
      assigneeId: hwang.id,
      frequency: "weekly",
      dayOfWeek: 1, // 매주 월요일
      startTime: "09:30",
      durationMinutes: 30,
      description: "지난 주 완료/이월 정리 후 스탠드업 진행",
      active: true,
      createdBy: hwang.id,
      createdAt: at(-30, 9),
    },
    {
      id: "tmpl-monthly-settlement",
      title: "월간 정산",
      assigneeId: oh.id,
      projectId: "prj-payment",
      frequency: "monthly",
      dayOfMonth: 25,
      startTime: "14:00",
      durationMinutes: 120,
      description: "결제/입금 내역 월 정산 및 대사",
      active: true,
      createdBy: oh.id,
      createdAt: at(-30, 9),
    },
  ];

  // 수정사항(이슈/피드백) 트래커 — 테스트 중 발견한 수정사항 팀 공용 메모. 샘플 2건.
  const revisionNotes: RevisionNote[] = [
    {
      id: "rev-1",
      menu: "일정",
      location: "주간 뷰 상단 날짜 이동 버튼",
      description: "이전 주로 이동하면 오늘 표시가 사라진다",
      status: "unresolved",
      authorId: oh.id,
      createdAt: at(-2, 11),
    },
    {
      id: "rev-2",
      menu: "결제요청",
      location: "금액 입력란",
      description: "천 단위 구분 쉼표가 입력 중에 커서를 튕긴다",
      status: "resolved",
      authorId: yejin.id,
      createdAt: at(-4, 15),
      updatedAt: at(-1, 10),
      updatedBy: hwang.id,
    },
  ];

  // 데일리 스탠드업 데모 체크인 — 오늘(KST) 날짜 기준 2건(황성현·오승훈). mock 모드 전용 시드.
  // (date, userId) 유니크. 파생 4분면은 저장하지 않고 제출 시점 Task id만 경량 동결한다(기획 §2).
  const dateKey = (dayOffset: number): string => {
    // KST(Asia/Seoul, instrumentation.ts에서 TZ 고정) 로컬 날짜. UTC 변환 금지.
    const d = new Date(now);
    d.setDate(d.getDate() + dayOffset);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };
  const today = dateKey(0);
  const standupEntries: StandupEntry[] = [
    {
      id: "standup-hwang-today",
      date: today,
      userId: hwang.id,
      focus: "여름 프로모션 오픈 D-7 역산 일정 확정하고 배너 시안 방향 잡기",
      note: "오전엔 킥오프 후속 정리, 오후엔 시안 리뷰.",
      snapshotTaskIds: { yesterdayDone: [], yesterdayUnfinished: [], todayPlanned: [] },
      aiDrafted: false,
      submittedAt: at(0, 9, 40),
      updatedAt: at(0, 9, 40),
    },
    {
      id: "standup-oh-today",
      date: today,
      userId: oh.id,
      focus: "결제 QA 잔여 케이스 마무리 — 마감 임박 마일스톤 우선",
      blockerText: "결제 API 응답 형식이 프론트 표시값과 아직 안 맞아 확인 대기 중",
      snapshotTaskIds: { yesterdayDone: [], yesterdayUnfinished: [], todayPlanned: [] },
      aiDrafted: true,
      draftEdited: true,
      submittedAt: at(0, 9, 52),
      updatedAt: at(0, 9, 52),
    },
  ];

  // AI 팀 요약은 시드에 두지 않는다 — 크론(11시/전원 제출)이 generateTeamSummary로 당일 생성한다.
  const standupTeamSummaries: StandupTeamSummary[] = [];

  // ── OKR 데모 시드(기획 §2) — 분기 목표 1 + 월 KR 3(manual 2·task_auto 1, 오너 분산) ──────
  // period/month는 now 기준 현재 분기·현재 월로 파생해 언제 실행해도 OKR 탭에 보이게 한다.
  const okrYear = now.getFullYear();
  const okrMonthNum = now.getMonth() + 1;
  const okrQuarter = Math.floor((okrMonthNum - 1) / 3) + 1;
  const okrPeriod = `${okrYear}-Q${okrQuarter}`;
  const okrMonth = `${okrYear}-${String(okrMonthNum).padStart(2, "0")}`;
  const objectives: Objective[] = [
    {
      id: "obj-summer",
      title: "여름 프로모션을 성공적으로 런칭한다",
      description: "오픈 일정 준수 + 결제 안정화 + CS 대응 체계 확립",
      period: okrPeriod,
      ownerId: hwang.id, // 대표(admin)
      status: "active",
      order: 0,
      createdAt: at(-7, 10),
    },
  ];
  const keyResults: KeyResult[] = [
    {
      // task_auto — 연결 Task(kr-summer-tasks) 완료율로 자동 집계.
      id: "kr-summer-tasks",
      objectiveId: "obj-summer",
      title: "여름 프로모션 핵심 작업을 기한 내 완료",
      ownerId: hwang.id,
      month: okrMonth,
      metricType: "task_auto",
      status: "active",
      updatedAt: at(-7, 10),
      updatedBy: hwang.id,
    },
    {
      // manual — 오승훈 담당. 90건 중 40건 진행.
      id: "kr-payment-cases",
      objectiveId: "obj-summer",
      title: "결제 QA 케이스 90건 처리",
      ownerId: oh.id,
      month: okrMonth,
      metricType: "manual",
      targetValue: 90,
      currentValue: 40,
      unit: "건",
      status: "active",
      updatedAt: at(-1, 15),
      updatedBy: oh.id,
    },
    {
      // manual — 이예진 담당. 30건 중 12건.
      id: "kr-cs-faq",
      objectiveId: "obj-summer",
      title: "CS FAQ 항목 30건 신규 작성",
      ownerId: yejin.id,
      month: okrMonth,
      metricType: "manual",
      targetValue: 30,
      currentValue: 12,
      unit: "건",
      status: "active",
      updatedAt: at(-2, 11),
      updatedBy: yejin.id,
    },
  ];

  // ── 과거 6주 완료/취소 이력 (결정론적 생성) ──────────────────────────
  // 관리자 리포트의 주간/월간 집계가 빈 표가 아니라 실제 데이터로 검증되도록,
  // 지난 42~3일의 이력을 만든다. random 없이 인덱스 기반으로 분배해 재현 가능.
  // 근래(어제·그제)는 기존 시드가 오늘/스탠드업 화면을 책임지므로 건드리지 않는다(d>=3).
  const HISTORY_TITLES = [
    "배너 시안 검토",
    "카피 교정",
    "QA 리그레션",
    "결제 로그 분석",
    "FAQ 항목 추가",
    "이미지 리터칭",
    "응답 스키마 점검",
    "정산 대사",
    "리뷰 반영",
    "샘플 재확인",
  ];
  const HISTORY_ASSIGNEES = [oh, sungjin, park, song, yejin, riwon, hwang];
  const HISTORY_PROJECTS: (string | undefined)[] = ["prj-summer", "prj-payment", "prj-cs", undefined];
  let hIdx = 0;
  for (let d = 42; d >= 3; d -= 1) {
    const dow = new Date(at(-d, 9)).getDay();
    if (dow === 0 || dow === 6) continue; // 주말 제외
    const perDay = (d % 3) + 1; // 하루 1~3건
    for (let k = 0; k < perDay; k += 1) {
      hIdx += 1;
      const assignee = HISTORY_ASSIGNEES[hIdx % HISTORY_ASSIGNEES.length];
      const projectId = HISTORY_PROJECTS[hIdx % HISTORY_PROJECTS.length];
      const title = HISTORY_TITLES[hIdx % HISTORY_TITLES.length];
      const hours = (hIdx % 3) + 1;
      const startHour = 9 + k * 2;
      const doneHour = startHour + hours;
      const id = `task-h${hIdx}`;
      const cancelled = hIdx % 6 === 0; // 6건마다 1건은 취소(필요없어짐)
      const finalStatus = cancelled ? "cancelled" : "done";
      tasks.push({
        id,
        title,
        ownerId: assignee.id,
        assigneeId: assignee.id,
        projectId,
        startAt: at(-d, startHour),
        endAt: at(-d, doneHour),
        status: finalStatus,
        priority: "normal",
        estimatedHours: hours,
        source: "manual",
        visibility: "team",
        lastChangedBy: assignee.id,
        lastChangedAt: at(-d, doneHour),
      });
      // 완료 건 일부는 중간에 문제발생/홀드를 거쳤다 해소됐다고 기록한다 —
      // 그래야 리포트의 "병목 유입(raisedIssues/Holds)"이 기간별로 실제로 달라진다.
      // (전이 로그만 남기고 최종 상태는 done이므로 '현재 막힘'은 오염되지 않는다.)
      if (!cancelled && hIdx % 5 === 0) {
        statusLogs.push({
          id: `slog-h${hIdx}-issue`,
          taskId: id,
          actorId: assignee.id,
          fromStatus: "in_progress",
          toStatus: "issue",
          reason: "진행 중 이슈 발견",
          createdAt: at(-d, startHour, 30),
        });
      } else if (!cancelled && hIdx % 7 === 0) {
        statusLogs.push({
          id: `slog-h${hIdx}-hold`,
          taskId: id,
          actorId: assignee.id,
          fromStatus: "in_progress",
          toStatus: "on_hold",
          reason: "선행 작업 대기",
          createdAt: at(-d, startHour, 30),
        });
      }
      statusLogs.push({
        id: `slog-h${hIdx}`,
        taskId: id,
        actorId: assignee.id,
        fromStatus: "in_progress",
        toStatus: finalStatus,
        createdAt: at(-d, doneHour),
      });
    }
  }

  // ── OS-2a 실패 분류 회고(부록 B) ── 지난주 집계가 빈 표가 아니게 최근 며칠분을 둔다.
  // 회고는 프로젝트·마일스톤 단위 — 담당자 강조 없음. managed=대응 프로세스를 탔는가.
  const milestoneRetros: MilestoneRetro[] = [
    {
      id: "retro-payment-qa",
      milestoneId: "ms-payment-qa",
      cause: "internal",
      causeDetail: "qa_lack",
      note: "QA 케이스 커버리지가 부족해 마감이 밀렸다",
      managed: false,
      createdBy: oh.id,
      createdAt: at(-3, 18),
    },
    {
      id: "retro-cs-faq",
      milestoneId: "ms-cs-faq",
      cause: "external",
      causeDetail: "client_direction",
      note: "클라이언트 방향 전환으로 FAQ 범위가 바뀌었다 — 대응 프로세스 진행",
      managed: true,
      createdBy: hwang.id,
      createdAt: at(-2, 14),
    },
  ];

  // ── OS-2b 외부 변경 접수(부록 C) ── 진행 중 1건(영향 분석 단계). SLA 24h 카운트다운 데모.
  const changeRequests: ChangeRequest[] = [
    {
      id: "chgreq-summer-scope",
      projectId: "prj-summer",
      milestoneId: "ms-summer-open",
      title: "멘딕스 프로모션 오픈일 1주 앞당김 요청",
      description: "클라이언트가 오픈 일정을 앞당겨 달라고 요청 — 영향 분석 중",
      stage: "impact_analyzed",
      receivedAt: at(0, 9),
      impactDeadline: at(1, 9),
      stageLog: [
        { stage: "received", at: at(0, 9), by: hwang.id },
        { stage: "impact_analyzed", at: at(0, 11), by: hwang.id },
      ],
    },
  ];

  return {
    clients,
    projects,
    milestones,
    tasks,
    calendarEvents,
    meetingNotes,
    actionItems,
    paymentCategories,
    paymentRequests,
    statusLogs,
    changeLogs,
    checkIns,
    taskComments,
    recurringTemplates,
    revisionNotes,
    standupEntries,
    standupTeamSummaries,
    objectives,
    keyResults,
    milestoneRetros,
    changeRequests,
  };
}
