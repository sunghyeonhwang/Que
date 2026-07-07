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
  /** 캡(PER_GROUP) 적용 전 실제 매치 총 수 — 초과 시 '더 있음' 안내에 사용. */
  total: number;
  /** '전체 보기' 대상 목록 화면 경로. */
  listHref: string;
}

const GROUP_LABEL: Record<SearchKind, string> = {
  task: "작업",
  note: "회의록",
  action: "Action",
  payment: "결제",
  member: "팀원",
};

/** 각 종류의 '전체 보기'가 향하는 목록 화면. */
const GROUP_LIST_HREF: Record<SearchKind, string> = {
  task: "/now",
  note: "/meeting-notes",
  action: "/action",
  payment: "/payments",
  member: "/members",
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
  // allHits = 캡 적용 전 전체 매치. total은 전체 수, hits는 PER_GROUP까지만 노출.
  const push = (kind: SearchKind, allHits: SearchHit[]) => {
    if (allHits.length === 0) return;
    groups.push({
      kind,
      label: GROUP_LABEL[kind],
      hits: allHits.slice(0, PER_GROUP),
      total: allHits.length,
      listHref: GROUP_LIST_HREF[kind],
    });
  };

  // 작업 — 팀 운영표(/now)가 전체 작업을 나열하고, ?task=<id>로 해당 행을 자동으로 연다
  push(
    "task",
    db.tasks
      .filter((t) => match(t.title, q))
      .map((t) => ({
        kind: "task" as const,
        id: t.id,
        title: t.title,
        subtitle: `담당 ${nameOf(t.assigneeId)}`,
        href: `/now?task=${t.id}`,
      })),
  );

  // 회의록 (제목/파일명) → 해당 회의록 하이라이트
  push(
    "note",
    viewableNotes
      .filter((n) => match(n.title, q) || match(n.fileName, q))
      .map((n) => ({
        kind: "note" as const,
        id: n.id,
        title: n.title,
        subtitle: n.fileName,
        href: `/meeting-notes?note=${n.id}`,
      })),
  );

  // Action 후보 (열람 가능한 회의록에서 나온 것만) → 해당 회의록으로 좁힌 확인필요 화면
  push(
    "action",
    db.actionItems
      .filter((a) => viewableNoteIds.has(a.meetingNoteId) && match(a.title, q))
      .map((a) => ({
        kind: "action" as const,
        id: a.id,
        title: a.title,
        subtitle: "회의록",
        href: `/action?note=${a.meetingNoteId}`,
      })),
  );

  // 결제 (제목/분류만 — 금액·계좌는 검색 결과에 노출하지 않는다) → 해당 결제 행 하이라이트
  push(
    "payment",
    db.paymentRequests
      .filter((p) => match(p.title, q) || match(p.category, q))
      .map((p) => ({
        kind: "payment" as const,
        id: p.id,
        title: p.title,
        subtitle: p.category,
        href: `/payments?payment=${p.id}`,
      })),
  );

  // 팀원 (이름) → 멤버 상세 — 활성(재직) 명단만 검색에 노출한다(비활성=퇴사/정지 제외).
  push(
    "member",
    db.users
      .filter((u) => u.active !== false && match(u.name, q))
      .map((u) => ({
        kind: "member" as const,
        id: u.id,
        title: u.name,
        subtitle: [departmentForUser(u), rankForUser(u)].filter(Boolean).join(" · "),
        href: `/members/${u.id}`,
      })),
  );

  return groups;
}
