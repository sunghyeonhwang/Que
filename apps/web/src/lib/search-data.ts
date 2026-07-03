import { canViewMeetingNote, departmentForUser, rankForUser, type User } from "@que/core";
import { getDb } from "./db";

// 전역 검색 데이터 계층 — 상단바 검색이 실제로 조회하는 곳.
// 조회 전용. 열람 권한(회의록)·민감정보(결제 금액/계좌 미노출)를 지킨다.

export type SearchKind = "task" | "note" | "action" | "payment" | "member";

export interface SearchHit {
  kind: SearchKind;
  id: string;
  title: string;
  subtitle: string;
  href: string;
}

export interface SearchGroup {
  kind: SearchKind;
  label: string;
  hits: SearchHit[];
}

const GROUP_LABEL: Record<SearchKind, string> = {
  task: "작업",
  note: "회의록",
  action: "Action",
  payment: "결제",
  member: "팀원",
};

/** 그룹별 최대 노출 수 */
const PER_GROUP = 5;

function match(haystack: string | undefined, q: string): boolean {
  return !!haystack && haystack.toLowerCase().includes(q);
}

/** 워크스페이스 전역 검색. query가 비면 빈 배열. */
export async function searchWorkspace(query: string, user: User): Promise<SearchGroup[]> {
  const q = query.trim().toLowerCase();
  if (q.length === 0) return [];

  const db = await getDb();
  const userById = new Map(db.users.map((u) => [u.id, u]));
  const nameOf = (id: string) => userById.get(id)?.name ?? id;

  // 열람 가능한 회의록만 (권한 없는 회의록/그 Action은 검색에도 안 뜬다)
  const viewableNotes = db.meetingNotes.filter((n) => canViewMeetingNote(user, n));
  const viewableNoteIds = new Set(viewableNotes.map((n) => n.id));

  const groups: SearchGroup[] = [];
  const push = (kind: SearchKind, hits: SearchHit[]) => {
    if (hits.length > 0) groups.push({ kind, label: GROUP_LABEL[kind], hits });
  };

  // 작업 — 팀 운영표(/now)가 전체 작업을 나열하므로 그쪽으로 보낸다
  push(
    "task",
    db.tasks
      .filter((t) => match(t.title, q))
      .slice(0, PER_GROUP)
      .map((t) => ({
        kind: "task" as const,
        id: t.id,
        title: t.title,
        subtitle: `담당 ${nameOf(t.assigneeId)}`,
        href: "/now",
      })),
  );

  // 회의록 (제목/파일명)
  push(
    "note",
    viewableNotes
      .filter((n) => match(n.title, q) || match(n.fileName, q))
      .slice(0, PER_GROUP)
      .map((n) => ({
        kind: "note" as const,
        id: n.id,
        title: n.title,
        subtitle: n.fileName,
        href: "/meeting-notes",
      })),
  );

  // Action 후보 (열람 가능한 회의록에서 나온 것만)
  push(
    "action",
    db.actionItems
      .filter((a) => viewableNoteIds.has(a.meetingNoteId) && match(a.title, q))
      .slice(0, PER_GROUP)
      .map((a) => ({
        kind: "action" as const,
        id: a.id,
        title: a.title,
        subtitle: "확인필요",
        href: "/action",
      })),
  );

  // 결제 (제목/분류만 — 금액·계좌는 검색 결과에 노출하지 않는다)
  push(
    "payment",
    db.paymentRequests
      .filter((p) => match(p.title, q) || match(p.category, q))
      .slice(0, PER_GROUP)
      .map((p) => ({
        kind: "payment" as const,
        id: p.id,
        title: p.title,
        subtitle: p.category,
        href: "/payments",
      })),
  );

  // 팀원 (이름) → 멤버 상세
  push(
    "member",
    db.users
      .filter((u) => match(u.name, q))
      .slice(0, PER_GROUP)
      .map((u) => ({
        kind: "member" as const,
        id: u.id,
        title: u.name,
        subtitle: [departmentForUser(u.id), rankForUser(u.id)].filter(Boolean).join(" · "),
        href: `/members/${u.id}`,
      })),
  );

  return groups;
}
