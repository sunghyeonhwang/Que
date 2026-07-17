import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { canViewMeetingNote, formatProjectLabel, type User } from "@que/core";
import { getDb } from "./db";

// 회의록 결정 로그(meeting_note_decisions) — AI가 회의록 원문에서 뽑은 "명시된 결정"(명세 B-4).
// meeting_note_summaries·standup-summary와 같은 선례: core 도메인 스냅샷 밖이라 SupabaseQueDb.persist를
// 절대 타지 않고, 전용 admin 클라이언트로 직조회/직쓰기만 한다. meetingNoteSchema에도 필드를 추가하지 않는다.
//
// ⚠️ 성격: AI 추출 파생물이라 "원문 대조 필요"(요약과 동급). 확인 카드 불요 — 쓰기 액션이 아니라
//    파생 표시물이다. 단 Task/일정 등 **업무 데이터 쓰기는 절대 없다**. 재생성 시 note_id 기준 delete 후
//    재삽입한다(요약 upsert와 짝).
//
// 우아한 비활성: mock/dev(키 없음)·테이블 부재·DB 오류는 조회 빈 배열, 쓰기 false로 강등한다
// (웹 훅에서 throw 금지 — 결정 저장 실패가 업로드를 깨면 안 된다).

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;
const useSupabase =
  process.env.QUE_DB === "supabase" && !!SUPABASE_URL && !!SUPABASE_SECRET_KEY;

function admin(): SupabaseClient {
  return createClient(SUPABASE_URL!, SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false },
  });
}

/**
 * 회의록의 결정사항을 통째로 교체(재생성 안전) — note_id 기준 delete 후 재삽입한다.
 * decidedAt은 회의 일시(note.meetingAt)를 쓴다(결정 시각의 최선의 근사). 성공 true, 비활성·오류 false.
 * 웹 훅에서 throw 금지: 실패해도 업로드/재생성 흐름을 깨지 않는다. 결정 0건이면 delete만 하고 true.
 */
export async function replaceNoteDecisions(
  noteId: string,
  decisions: string[],
  decidedAt: string,
): Promise<boolean> {
  if (!useSupabase) return false;
  try {
    const client = admin();
    // 재생성 시 기존 결정 제거(요약 upsert와 달리 1:N이라 delete→insert).
    const { error: delError } = await client
      .from("meeting_note_decisions")
      .delete()
      .eq("note_id", noteId);
    if (delError) return false;
    const rows = decisions
      .map((c) => c.trim())
      .filter(Boolean)
      .map((content) => ({ note_id: noteId, content, decided_at: decidedAt }));
    if (rows.length === 0) return true; // 결정 없음 — delete만으로 완료(빈 목록도 정상)
    const { error: insError } = await client.from("meeting_note_decisions").insert(rows);
    return !insError;
  } catch (e) {
    console.error("[que-decisions] 결정 저장 실패(무시)", e);
    return false;
  }
}

/** 결정 로그 1건(조회) — /meeting-notes?tab=decisions 탭용 계약. 회의록 제목·일시·프로젝트 병기. */
export interface DecisionLogEntry {
  id: string;
  noteId: string;
  noteTitle: string;
  /** 회의 일시(ISO) — 회의록 meetingAt. */
  noteDate: string;
  /** 회의록 프로젝트 라벨("클라이언트 · 프로젝트"). 미지정이면 undefined. */
  projectName?: string;
  content: string;
  /** 결정 시각(ISO, note.meetingAt 근사). */
  decidedAt: string;
  /** AI 추출 파생물임을 표시하기 위한 플래그(항상 true) — UI가 "원문 대조 필요" 뱃지를 붙일 근거. */
  aiExtracted: true;
}

/**
 * 결정 로그 조회 — **canViewMeetingNote 통과 회의록의 결정만** 최신순으로.
 * 비공개(admin/restricted) 회의록 결정은 권한 없는 뷰어에게 새지 않는다(요약과 동일 등급).
 * @param options.projectId 지정 시 그 프로젝트(단일 projectId 또는 projectIds 포함)의 회의록만.
 * @param options.limit 반환 상한(기본 100). DB 조회는 여유분(limit*3, 상한 500)을 받아 권한 필터 후 자른다.
 */
export async function getDecisionLog(
  viewer: User,
  options: { projectId?: string; limit?: number } = {},
): Promise<DecisionLogEntry[]> {
  if (!useSupabase) return [];
  const limit = options.limit ?? 100;
  try {
    const db = await getDb();
    // 열람 가능한 회의록만(권한 필터를 먼저 — 비공개 회의록 결정은 조회 자체에서 제외).
    const viewableNotes = new Map(
      db.meetingNotes
        .filter((n) => canViewMeetingNote(viewer, n))
        .filter((n) => {
          if (!options.projectId) return true;
          return n.projectId === options.projectId || (n.projectIds ?? []).includes(options.projectId);
        })
        .map((n) => [n.id, n]),
    );
    if (viewableNotes.size === 0) return [];

    const client = admin();
    // 권한 통과 회의록으로 한정 조회(note_id in) + 최신순. 여유분을 받아 상한만큼 반환.
    const { data, error } = await client
      .from("meeting_note_decisions")
      .select("id,note_id,content,decided_at")
      .in("note_id", [...viewableNotes.keys()])
      .order("decided_at", { ascending: false })
      .limit(Math.min(limit * 3, 500));
    if (error || !data) return [];

    const projectById = new Map(db.projects.map((p) => [p.id, p]));
    const clientById = new Map(db.clients.map((c) => [c.id, c]));
    const projectLabel = (projectId?: string): string | undefined => {
      if (!projectId) return undefined;
      const project = projectById.get(projectId);
      if (!project) return undefined;
      return formatProjectLabel(project, project.clientId ? clientById.get(project.clientId) : undefined);
    };

    const entries: DecisionLogEntry[] = [];
    for (const row of data) {
      const note = viewableNotes.get(row.note_id as string);
      if (!note) continue; // 조회 시점 이후 권한 밖(방어)
      const primaryProjectId = note.projectId ?? note.projectIds?.[0];
      entries.push({
        id: row.id as string,
        noteId: note.id,
        noteTitle: note.title,
        noteDate: note.meetingAt,
        projectName: projectLabel(primaryProjectId),
        content: row.content as string,
        decidedAt: row.decided_at as string,
        aiExtracted: true,
      });
      if (entries.length >= limit) break;
    }
    return entries;
  } catch (e) {
    console.error("[que-decisions] 결정 로그 조회 실패(무시)", e);
    return [];
  }
}
