import "server-only";

import type { MockQueDb } from "@que/core";
import { collectTodayActions } from "@/lib/meeting-minutes";
import { generateAnalysis } from "@/lib/ai/gemini";

// Plaud 전사 대조 검증(기획 §1-f 캡처 방식 ⑵ · "검증 게이트") — 행동 기반 회의록(정본)과 전사를 대조한다.
// server-only. 저장하지 않고, 자동 병합하지 않는다(행동 기반이 항상 정본). 업로드 응답에 플래그로 첨부한다.
//
// 산출: ⓐ전사엔 있는데 시스템에 안 남은 결정(missing) ⓑ서로 어긋나는 내용(mismatch).

/** 전사 대조 결과(저장 안 함 — 업로드 응답 첨부용). */
export interface TranscriptVerification {
  /** 전사에는 있는데 시스템 행동에 없는 결정(누락). */
  missing: string[];
  /** 시스템 행동과 전사가 어긋나는 내용(불일치). */
  mismatch: string[];
}

const VERIFY_SYSTEM = [
  "너는 8명 규모 한국 회사의 회의록 검증 보조다. '시스템 행동 목록'(정본)과 'Plaud 전사'를 대조한다.",
  "규칙:",
  "- 반드시 한국어 존댓말. 데이터에 없는 사실을 지어내지 않는다.",
  "- 아래 JSON 스키마로만 답한다(코드펜스·설명 없이 JSON 객체 하나만):",
  '  {"missing": ["전사엔 있는데 시스템에 안 남은 결정 한 줄", ...], "mismatch": ["시스템과 전사가 어긋나는 내용 한 줄", ...]}',
  "- missing: 전사에서 결정·합의로 보이는데 시스템 행동 목록에 대응이 없는 항목만.",
  "- mismatch: 같은 사안인데 날짜·담당·상태 등이 서로 다른 항목만.",
  "- 확신이 없으면 넣지 않는다. 각 배열은 최대 8개. 없으면 빈 배열.",
].join("\n");

/** AI 응답에서 {missing, mismatch} JSON을 관대하게 추출한다. 실패 시 null. */
function parseVerifyJson(text: string): TranscriptVerification | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    const obj = JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
    const arr = (v: unknown): string[] =>
      Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").map((s) => s.trim()) : [];
    return { missing: arr(obj.missing), mismatch: arr(obj.mismatch) };
  } catch {
    return null;
  }
}

/**
 * 전사(transcript)를 그 회의 날짜(date)의 시스템 행동(collectTodayActions)과 pro로 대조한다.
 * **저장·병합하지 않는다** — {missing, mismatch}를 반환해 업로드 응답에 플래그로 첨부한다(검증 게이트).
 * AI 실패·빈 응답이면 undefined(업로드를 막지 않는다 — 검증은 부가 신호일 뿐).
 */
export async function verifyTranscript(
  db: MockQueDb,
  transcript: string,
  date: Date = new Date(),
): Promise<TranscriptVerification | undefined> {
  const body = transcript?.trim();
  if (!body) return undefined;
  try {
    const actions = collectTodayActions(db, date);
    const payload = {
      "시스템 행동 목록": actions.map((a) => `${a.text} · ${a.actorName}`),
      "Plaud 전사": body.slice(0, 20000), // 과도한 길이 방어(pro 입력 상한 고려)
    };
    const text = await generateAnalysis(VERIFY_SYSTEM, JSON.stringify(payload, null, 1), {
      model: "pro",
      maxOutputTokens: 2048,
    });
    const parsed = parseVerifyJson(text);
    if (!parsed) return undefined;
    // 둘 다 비면 검증 통과(플래그 없음)를 명시적으로 반환한다(호출부가 '검증됨' 표시 가능).
    return parsed;
  } catch (error) {
    console.error("[que-minutes] 전사 대조 실패(무시)", error);
    return undefined;
  }
}
