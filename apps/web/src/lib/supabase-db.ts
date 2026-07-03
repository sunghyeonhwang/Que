import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  MockQueDb,
  TABLE_INSERT_ORDER,
  fromRow,
  rowForTable,
  type Milestone,
  type Project,
} from "@que/core";

// Supabase 어댑터 — MockQueDb를 상속해 16개 mutation·도메인 규칙을 재구현 없이 그대로 쓰고,
// 요청마다 실 DB에서 스냅샷을 로드(load)한 뒤, mutation 이후 변경분만 write-through(persist)한다.
// 8인 팀 규모(≈200행)라 전체 스냅샷 로드가 저렴하다. 배포 후 스케줄러/외부동기화는 Vercel Cron으로.

// DB 테이블명 → MockQueDb의 public 배열 필드명 (snake ↔ camel)
const TABLE_TO_FIELD = {
  users: "users",
  projects: "projects",
  milestones: "milestones",
  tasks: "tasks",
  calendar_events: "calendarEvents",
  meeting_notes: "meetingNotes",
  action_items: "actionItems",
  payment_requests: "paymentRequests",
  recurring_templates: "recurringTemplates",
  status_logs: "statusLogs",
  change_logs: "changeLogs",
  task_comments: "taskComments",
  check_ins: "checkIns",
} as const;

type TableName = keyof typeof TABLE_TO_FIELD;

export class SupabaseQueDb extends MockQueDb {
  private readonly client: SupabaseClient;
  /** 로드 시점의 엔티티별 직렬화 스냅샷(테이블→id→JSON). persist가 이 기준으로 diff한다. */
  private baseline: Record<string, Map<string, string>> = {};

  constructor(url: string, key: string, now = new Date()) {
    super(now); // mock 시드로 채워지지만 load()에서 전부 덮어쓴다
    this.client = createClient(url, key, { auth: { persistSession: false } });
  }

  /** 요청 간 충돌 없는 전역 고유 id (인메모리 시퀀스 대체). */
  protected nextId(prefix: string): string {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  /** 실 DB 전체를 읽어 부모의 public 배열을 채운다. */
  async load(): Promise<void> {
    for (const [table, field] of Object.entries(TABLE_TO_FIELD) as [TableName, string][]) {
      const { data, error } = await this.client.from(table).select("*");
      if (error) throw new Error(`Supabase load ${table} 실패: ${error.message}`);
      (this as unknown as Record<string, unknown[]>)[field] = (data ?? []).map((r) =>
        fromRow(r as Record<string, unknown>),
      );
    }
    // 정규화로 사라진 Project.milestoneIds를 milestones에서 재구성(도메인 객체 충실성 유지).
    for (const p of this.projects as Project[]) {
      p.milestoneIds = (this.milestones as Milestone[])
        .filter((m) => m.projectId === p.id)
        .map((m) => m.id);
    }
    this.snapshotBaseline();
  }

  private snapshotBaseline(): void {
    for (const [table, field] of Object.entries(TABLE_TO_FIELD)) {
      const arr = (this as unknown as Record<string, { id: string }[]>)[field] ?? [];
      this.baseline[table] = new Map(arr.map((e) => [e.id, JSON.stringify(e)]));
    }
  }

  /** 변경분 write-through: 신규/변경은 upsert(FK 순서), 삭제는 역순. 변경 없으면 네트워크 호출 없음. */
  async persist(): Promise<void> {
    // upsert: FK 안전 순서 (users → ... → 로그류)
    for (const table of TABLE_INSERT_ORDER as readonly TableName[]) {
      const field = TABLE_TO_FIELD[table];
      const arr = (this as unknown as Record<string, { id: string }[]>)[field] ?? [];
      const base = this.baseline[table] ?? new Map();
      // 로드 이후 값이 바뀌었거나(변경) 없던 것(신규)만 — 손대지 않은 행은 문자열이 동일해 걸러진다
      const changed = arr.filter((e) => base.get(e.id) !== JSON.stringify(e));
      if (changed.length > 0) {
        const rows = changed.map((e) => rowForTable(table, e as unknown as Record<string, unknown>));
        const { error } = await this.client.from(table).upsert(rows);
        if (error) throw new Error(`Supabase upsert ${table} 실패: ${error.message}`);
      }
    }
    // delete: 역순 (자식 먼저)
    for (const table of [...TABLE_INSERT_ORDER].reverse() as TableName[]) {
      const field = TABLE_TO_FIELD[table];
      const arr = (this as unknown as Record<string, { id: string }[]>)[field] ?? [];
      const currentIds = new Set(arr.map((e) => e.id));
      const base = this.baseline[table] ?? new Map();
      const removed = [...base.keys()].filter((id) => !currentIds.has(id));
      if (removed.length > 0) {
        const { error } = await this.client.from(table).delete().in("id", removed);
        if (error) throw new Error(`Supabase delete ${table} 실패: ${error.message}`);
      }
    }
    this.snapshotBaseline(); // 같은 요청에서 persist가 여러 번 불릴 때를 대비해 기준 갱신
  }
}
