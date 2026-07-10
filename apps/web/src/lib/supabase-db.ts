import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  MockQueDb,
  TABLE_INSERT_ORDER,
  fromRow,
  rowForTable,
  type Milestone,
  type NotificationOutboxEntry,
  type Project,
} from "@que/core";

// Supabase 어댑터 — MockQueDb를 상속해 16개 mutation·도메인 규칙을 재구현 없이 그대로 쓰고,
// 요청마다 실 DB에서 스냅샷을 로드(load)한 뒤, mutation 이후 변경분만 write-through(persist)한다.
// 8인 팀 규모(≈200행)라 전체 스냅샷 로드가 저렴하다. 배포 후 스케줄러/외부동기화는 Vercel Cron으로.

// DB 테이블명 → MockQueDb의 public 배열 필드명 (snake ↔ camel)
const TABLE_TO_FIELD = {
  users: "users",
  clients: "clients",
  projects: "projects",
  milestones: "milestones",
  tasks: "tasks",
  calendar_events: "calendarEvents",
  meeting_notes: "meetingNotes",
  action_items: "actionItems",
  payment_categories: "paymentCategories",
  payment_requests: "paymentRequests",
  recurring_templates: "recurringTemplates",
  status_logs: "statusLogs",
  change_logs: "changeLogs",
  task_comments: "taskComments",
  check_ins: "checkIns",
  revision_notes: "revisionNotes",
  alert_reads: "alertReads",
} as const;

type TableName = keyof typeof TABLE_TO_FIELD;

// 재발 방지(2026-07-10 F-1): TABLE_TO_FIELD에 등록된 테이블이 TABLE_INSERT_ORDER에 빠지면
// load만 되고 persist가 조용히 건너뛴다(alert_reads 사고). **완전성**을 컴파일 에러로 강제한다 —
// 누락된 테이블이 있으면 Exclude가 그 리터럴 타입이 되어 AssertNever 제약을 위반한다.
type AssertNever<T extends never> = T;
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- 컴파일 타임 가드(참조 불필요)
type _OrderCoversAllTables = AssertNever<
  Exclude<TableName, (typeof TABLE_INSERT_ORDER)[number]>
>;

// ── 스냅샷 TTL 캐시 (2026-07-11 성능) ─────────────────────────────────────────
// 서버리스 인스턴스(모듈 스코프)별 캐시. 같은 인스턴스에 연속 요청이 떨어지면 TTL 안에서는
// 실 DB 왕복(~110ms) 없이 스냅샷을 재사용한다. persist가 실제로 뭔가 쓰면 즉시 무효화해
// "방금 저장했는데 다음 화면이 옛날 데이터"가 되는 UX를 막는다(다른 인스턴스는 최대 TTL 지연 — 수용).
// QUE_SNAPSHOT_TTL_MS=0 으로 끌 수 있다(기본 5000ms).
const SNAPSHOT_TTL_MS = (() => {
  const raw = Number(process.env.QUE_SNAPSHOT_TTL_MS);
  return Number.isFinite(raw) && raw >= 0 ? raw : 5000;
})();

interface SnapshotCacheEntry {
  at: number;
  /** TABLE_TO_FIELD 필드별 rows — 저장·배포 모두 깊은 복사로 인스턴스 간 오염을 차단한다. */
  fields: Record<string, unknown[]>;
  outbox: NotificationOutboxEntry[];
}
let snapshotCache: SnapshotCacheEntry | null = null;

export class SupabaseQueDb extends MockQueDb {
  private readonly client: SupabaseClient;
  /** 로드 시점의 엔티티별 직렬화 스냅샷(테이블→id→JSON). persist가 이 기준으로 diff한다. */
  private baseline: Record<string, Map<string, string>> = {};
  /** 알림 아웃박스 전용 baseline(id→JSON). 제네릭 TABLE_TO_FIELD 경로를 타지 않는다 — 아래 참조. */
  private outboxBaseline: Map<string, string> = new Map();

  constructor(url: string, key: string, now = new Date()) {
    super(now); // mock 시드로 채워지지만 load()에서 전부 덮어쓴다
    this.client = createClient(url, key, { auth: { persistSession: false } });
  }

  /** 요청 간 충돌 없는 전역 고유 id (인메모리 시퀀스 대체). */
  protected nextId(prefix: string): string {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  /** 실 DB 전체를 읽어 부모의 public 배열을 채운다.
   *  17개 테이블을 순차로 돌면 요청마다 왕복 지연이 테이블 수만큼 누적된다(실측 ~600ms)
   *  — 전 테이블을 병렬 SELECT해 가장 느린 한 번의 왕복 시간으로 줄인다(2026-07-11).
   *  TTL 안이면 인스턴스 캐시 스냅샷을 깊은 복사로 재사용한다(위 SNAPSHOT_TTL_MS 참조). */
  async load(): Promise<void> {
    if (SNAPSHOT_TTL_MS > 0 && snapshotCache && Date.now() - snapshotCache.at < SNAPSHOT_TTL_MS) {
      for (const [field, rows] of Object.entries(snapshotCache.fields)) {
        (this as unknown as Record<string, unknown[]>)[field] = structuredClone(rows);
      }
      this.notificationOutbox = structuredClone(snapshotCache.outbox);
      this.outboxBaseline = new Map(this.notificationOutbox.map((e) => [e.id, JSON.stringify(e)]));
      this.snapshotBaseline();
      return;
    }

    await Promise.all(
      (Object.entries(TABLE_TO_FIELD) as [TableName, string][]).map(async ([table, field]) => {
        // select("*")는 순서를 보장하지 않는다. 로그류는 createdAt 오름차순으로 로드해 두어
        // 조회 지점(latestStatusLog)과 별개로 배열 순서 자체도 시간순이 되게 방어한다.
        const query = this.client.from(table).select("*");
        if (table === "status_logs" || table === "change_logs") {
          query.order("created_at", { ascending: true });
        }
        // 클라이언트·결제 분류는 관리자가 정한 표시 순서(sort_order)로 로드해 배열 순서 자체를 정렬해 둔다.
        if (table === "clients" || table === "payment_categories") {
          query.order("sort_order", { ascending: true });
        }
        const { data, error } = await query;
        if (error) throw new Error(`Supabase load ${table} 실패: ${error.message}`);
        const rows = (data ?? []).map((r) => fromRow(r as Record<string, unknown>));
        if (table === "users") {
          // 인증·연동 전용 컬럼은 도메인 User가 아니다 — 메모리 객체/직렬화(팀 API 등)에서 완전히 제거해
          // password_hash·email·slack_user_id가 클라이언트로 새지 않게 한다.
          for (const u of rows as Record<string, unknown>[]) {
            delete u.passwordHash;
            delete u.email;
            delete u.slackUserId;
          }
        }
        (this as unknown as Record<string, unknown[]>)[field] = rows;
      }),
    );
    // 정규화로 사라진 Project.milestoneIds를 milestones에서 재구성(도메인 객체 충실성 유지).
    for (const p of this.projects as Project[]) {
      p.milestoneIds = (this.milestones as Milestone[])
        .filter((m) => m.projectId === p.id)
        .map((m) => m.id);
    }
    // 알림 아웃박스는 TABLE_TO_FIELD 제네릭 diff 경로를 쓰지 않는다 — 신규 적재는 id(PK)가 아니라
    // dedup_key ON CONFLICT DO NOTHING으로 써야 서버리스 동시 삽입에서 중복이 안 생긴다. 별도로 로드.
    await this.loadOutbox();
    this.snapshotBaseline();

    // 캐시 저장 — milestoneIds 재구성·users 민감 컬럼 제거가 끝난 최종 상태를 깊은 복사로 보관한다
    // (이 인스턴스가 이후 mutate해도 캐시가 오염되지 않게).
    if (SNAPSHOT_TTL_MS > 0) {
      const fields: Record<string, unknown[]> = {};
      for (const field of Object.values(TABLE_TO_FIELD)) {
        fields[field] = structuredClone(
          (this as unknown as Record<string, unknown[]>)[field] ?? [],
        );
      }
      snapshotCache = {
        at: Date.now(),
        fields,
        outbox: structuredClone(this.notificationOutbox),
      };
    }
  }

  /** notification_outbox 스냅샷 로드 + 전용 baseline 기록. */
  private async loadOutbox(): Promise<void> {
    const { data, error } = await this.client
      .from("notification_outbox")
      .select("*")
      .order("created_at", { ascending: true });
    if (error) throw new Error(`Supabase load notification_outbox 실패: ${error.message}`);
    this.notificationOutbox = (data ?? []).map((r) =>
      fromRow<NotificationOutboxEntry>(r as Record<string, unknown>),
    );
    this.outboxBaseline = new Map(this.notificationOutbox.map((e) => [e.id, JSON.stringify(e)]));
  }

  private snapshotBaseline(): void {
    for (const [table, field] of Object.entries(TABLE_TO_FIELD)) {
      const arr = (this as unknown as Record<string, { id: string }[]>)[field] ?? [];
      this.baseline[table] = new Map(arr.map((e) => [e.id, JSON.stringify(e)]));
    }
  }

  /** 변경분 write-through: 신규/변경은 upsert(FK 순서), 삭제는 역순. 변경 없으면 네트워크 호출 없음. */
  async persist(): Promise<void> {
    let didWrite = false;
    // upsert: FK 안전 순서 (users → ... → 로그류)
    for (const table of TABLE_INSERT_ORDER) {
      // ⚠️ users는 절대 write-back하지 않는다. load()에서 password_hash·email을 제거했으므로
      // upsert하면 그 컬럼이 NULL로 덮여 로그인 불능이 된다. 사용자 편집 기능은 전용 경로로.
      if (table === "users") continue;
      const field = TABLE_TO_FIELD[table];
      const arr = (this as unknown as Record<string, { id: string }[]>)[field] ?? [];
      const base = this.baseline[table] ?? new Map();
      // 로드 이후 값이 바뀌었거나(변경) 없던 것(신규)만 — 손대지 않은 행은 문자열이 동일해 걸러진다
      const changed = arr.filter((e) => base.get(e.id) !== JSON.stringify(e));
      if (changed.length > 0) {
        const rows = changed.map((e) => rowForTable(table, e as unknown as Record<string, unknown>));
        const { error } = await this.client.from(table).upsert(rows);
        if (error) throw new Error(`Supabase upsert ${table} 실패: ${error.message}`);
        didWrite = true;
      }
    }
    // delete: 역순 (자식 먼저)
    for (const table of [...TABLE_INSERT_ORDER].reverse()) {
      if (table === "users") continue; // users는 write-back 대상에서 완전히 제외(위 참조)
      const field = TABLE_TO_FIELD[table];
      const arr = (this as unknown as Record<string, { id: string }[]>)[field] ?? [];
      const currentIds = new Set(arr.map((e) => e.id));
      const base = this.baseline[table] ?? new Map();
      const removed = [...base.keys()].filter((id) => !currentIds.has(id));
      if (removed.length > 0) {
        const { error } = await this.client.from(table).delete().in("id", removed);
        if (error) throw new Error(`Supabase delete ${table} 실패: ${error.message}`);
        didWrite = true;
      }
    }
    if (await this.persistOutbox()) didWrite = true;
    this.snapshotBaseline(); // 같은 요청에서 persist가 여러 번 불릴 때를 대비해 기준 갱신
    // 실제 쓰기가 있었으면 이 인스턴스의 스냅샷 캐시를 버린다 — 같은 컨테이너의 다음 요청이
    // 방금 저장한 내용을 5초 묵은 캐시로 가리는 UX를 막는 핵심 안전장치.
    if (didWrite) snapshotCache = null;
  }

  /**
   * 알림 아웃박스 write-through. 신규(적재)와 변경(상태 전이)을 분리한다.
   *  - 신규: dedup_key ON CONFLICT DO NOTHING(ignoreDuplicates) — 동시 요청/크론 재실행이 같은 키를 넣어도
   *    UNIQUE 위반으로 persist가 throw하지 않고 조용히 흡수(중복 발송 방지의 핵심). 삭제는 없음(원장 보존).
   *  - 변경: 이미 DB에 있는 행(id)의 status/sent_at/attempts 등 → id(PK) upsert.
   */
  private async persistOutbox(): Promise<boolean> {
    const arr = this.notificationOutbox;
    const newRows = arr.filter((e) => !this.outboxBaseline.has(e.id));
    const changed = arr.filter(
      (e) => this.outboxBaseline.has(e.id) && this.outboxBaseline.get(e.id) !== JSON.stringify(e),
    );
    if (newRows.length > 0) {
      const rows = newRows.map((e) =>
        rowForTable("notification_outbox", e as unknown as Record<string, unknown>),
      );
      const { error } = await this.client
        .from("notification_outbox")
        .upsert(rows, { onConflict: "dedup_key", ignoreDuplicates: true });
      if (error) throw new Error(`Supabase insert notification_outbox 실패: ${error.message}`);
    }
    if (changed.length > 0) {
      const rows = changed.map((e) =>
        rowForTable("notification_outbox", e as unknown as Record<string, unknown>),
      );
      const { error } = await this.client.from("notification_outbox").upsert(rows);
      if (error) throw new Error(`Supabase upsert notification_outbox 실패: ${error.message}`);
    }
    this.outboxBaseline = new Map(arr.map((e) => [e.id, JSON.stringify(e)]));
    return newRows.length > 0 || changed.length > 0;
  }
}
