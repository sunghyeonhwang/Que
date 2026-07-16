import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { generateAnalysis } from "./ai/gemini";

// 회의록 AI 요약 — 업로드 직후 자동 생성해 저장한다(핵심 결정·논의 흐름·리스크 불릿).
// PAT(tokens.ts)·패스키(webauthn.ts)·표준업 요약(standup-summary.ts)과 같은 선례다:
// meeting_note_summaries 는 core 도메인 스냅샷 밖이라 SupabaseQueDb.persist를 절대 타지 않고,
// 전용 admin 클라이언트로 직조회/직쓰기만 한다. meetingNoteSchema에도 필드를 추가하지 않는다.
//
// 우아한 비활성: mock/dev(키 없음)에서는 조회는 빈 Map, 쓰기는 false. 테이블 부재·DB 오류도
// error→빈 값/false로 강등한다(웹 훅에서 throw 금지 — 요약 실패가 업로드를 깨면 안 된다).

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;
const useSupabase =
  process.env.QUE_DB === "supabase" && !!SUPABASE_URL && !!SUPABASE_SECRET_KEY;

function admin(): SupabaseClient {
  return createClient(SUPABASE_URL!, SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false },
  });
}

/** 저장된 회의록 요약(목록 조립·재생성 반환용). generatedAt은 ISO 문자열. */
export interface NoteSummary {
  content: string;
  model: string;
  generatedAt: string;
}

/**
 * 여러 회의록의 요약을 한 번에 조회한다(목록 조립용 일괄 조회 — N+1 방지).
 * 반환은 요약이 존재하는 noteId만 담긴 Map. mock/dev·테이블 부재·DB 오류면 빈 Map(우아한 비활성).
 */
export async function getNoteSummaries(
  noteIds: string[],
): Promise<Map<string, NoteSummary>> {
  const result = new Map<string, NoteSummary>();
  if (!useSupabase || noteIds.length === 0) return result;
  try {
    const client = admin();
    const { data, error } = await client
      .from("meeting_note_summaries")
      .select("note_id,content,model,generated_at")
      .in("note_id", noteIds);
    if (error || !data) return result;
    for (const row of data) {
      result.set(row.note_id as string, {
        content: row.content as string,
        model: row.model as string,
        generatedAt: row.generated_at as string,
      });
    }
  } catch (e) {
    // 테이블 부재·네트워크 등 — 요약 없이 목록을 계속 그린다.
    console.error("[que-summary] 요약 일괄 조회 실패(무시)", e);
  }
  return result;
}

/**
 * 회의록 요약 upsert(note_id PK — 재생성 시 덮어쓴다). 성공 true, 비활성·오류 false.
 * 웹 훅에서 throw 금지: 실패해도 업로드/재생성 흐름을 깨지 않는다.
 */
export async function upsertNoteSummary(
  noteId: string,
  content: string,
  model: string,
  generatedBy: string,
): Promise<boolean> {
  if (!useSupabase) return false;
  try {
    const client = admin();
    const { error } = await client.from("meeting_note_summaries").upsert(
      {
        note_id: noteId,
        content,
        model,
        generated_at: new Date().toISOString(),
        generated_by: generatedBy,
      },
      { onConflict: "note_id" },
    );
    return !error;
  } catch (e) {
    console.error("[que-summary] 요약 저장 실패(무시)", e);
    return false;
  }
}

// AI 요약 생성 ────────────────────────────────────────────────────────────────
// 회의록 파서(extractActionItems)와 동일 철학: 회의록에 없는 내용을 창작하지 않고, 담당자를
// 추정하지 않는다. flash로 빠르게(업로드 응답을 오래 붙잡지 않게) 한국어 요약을 만든다.

const SUMMARY_MODEL = "gemini-2.5-flash";
/** 원문이 아주 길면 앞부분만 준다(토큰·지연 상한). 회의록 결정은 대개 전반부에 몰린다. */
const MAX_INPUT_CHARS = 40_000;

const SUMMARY_SYSTEM = [
  "너는 8명 규모 한국 회사의 회의록 요약가다. 주어진 회의록 원문을 근거로,",
  "팀이 3초 안에 파악할 요약을 만든다. 감시가 아니라 결정과 후속 확인을 빨리 드러내는 운영 요약이다.",
  "규칙:",
  "- 반드시 한국어 존댓말. 회의록에 없는 사실을 지어내지 않는다. 담당자를 추정하지 않는다(이름이 원문에 명시된 경우만 인용).",
  "- 핵심 결정 / 논의 흐름 / 리스크·후속 확인을 아우르는 4~8개 불릿으로 정리한다.",
  "- 각 불릿은 한 줄, '- '로 시작한다. 마크다운 굵게(**)나 제목(#)은 쓰지 않는다.",
  "- 사람 평가·질책 금지. 원문에 근거가 없으면 리스크·후속 확인 불릿은 생략한다.",
].join("\n");

/**
 * 회의록 본문으로 한국어 요약을 생성한다(flash). 실패는 null(throw 금지 — 웹 훅이 삼킨다).
 * 원문이 매우 길면 앞 MAX_INPUT_CHARS 자로 절단한다.
 */
export async function generateNoteSummary(
  markdownBody: string,
  title: string,
): Promise<string | null> {
  const body = markdownBody.length > MAX_INPUT_CHARS
    ? markdownBody.slice(0, MAX_INPUT_CHARS)
    : markdownBody;
  const userContent = `회의 제목: ${title}\n\n회의록 원문:\n${body}`;
  try {
    const text = await generateAnalysis(SUMMARY_SYSTEM, userContent, {
      model: "flash",
      maxOutputTokens: 1024,
    });
    const trimmed = text.trim();
    return trimmed || null;
  } catch (e) {
    console.error("[que-summary] 요약 생성 실패(무시)", e);
    return null;
  }
}

/** 저장 시 기록할 모델 식별자(요약 생성에 쓴 모델). */
export const NOTE_SUMMARY_MODEL = SUMMARY_MODEL;
