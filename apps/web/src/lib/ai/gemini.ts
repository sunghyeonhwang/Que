import "server-only";

// Gemini API 호출 래퍼 — E-10 분석 AI. 서버 전용(키는 env, 클라이언트 노출 금지 — server-only 가드).
// 온디맨드 버튼식(관리자·대표)이라 호출량이 작다 — Flash 무료 할당으로 충분.
// 실패는 QueRuleError처럼 던지지 않고 한글 메시지 Error로 — 호출부(서버 액션)가 {ok:false}로 변환.

// 기본은 Flash(빠름·무료 할당). 리포트 분석처럼 깊은 해석이 필요한 곳만 Pro를 옵션으로 쓴다
// (사용자 결정 2026-07-11 — Pro는 느리고 유료 과금이라 온디맨드 버튼 경로 한정).
const MODEL_ID = { flash: "gemini-2.5-flash", pro: "gemini-2.5-pro" } as const;
const urlFor = (model: keyof typeof MODEL_ID) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_ID[model]}:generateContent`;
// Pro는 내부 thinking이 길어 응답이 수십 초 — maxDuration 60 안에서 최대한(재시도 없이 1회).
const TIMEOUT_MS = { flash: 45_000, pro: 52_000 } as const;

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
}

/** generateAnalysis 옵션. maxOutputTokens는 공용 기본 2048 — 더 긴 브리핑(대표 경영 브리핑 등)만 상향. */
export interface GenerateAnalysisOptions {
  /** 모델 선택. 기본 flash. pro=깊은 해석(리포트 분석) — 느리고 유료라 온디맨드 한정. */
  model?: "flash" | "pro";
  /** 최대 출력 토큰. 기본 2048. 분량이 긴 브리핑(대표)만 3072 등으로 올린다. */
  maxOutputTokens?: number;
}

/**
 * 시스템 지시 + 사용자 콘텐츠로 텍스트 생성. GEMINI_API_KEY 미설정이면 기능 비활성 안내를 던진다.
 */
export async function generateAnalysis(
  systemInstruction: string,
  userContent: string,
  options: GenerateAnalysisOptions = {},
): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error("AI 분석이 설정되지 않았습니다 (GEMINI_API_KEY 미설정) — 관리자에게 문의하세요.");
  }
  const maxOutputTokens = options.maxOutputTokens ?? 2048;
  const model = options.model ?? "flash";

  // 일시 오류(503 과부하·네트워크)는 1회만 짧게 재시도 — 사용자가 버튼을 다시 누르게 하지 않는다.
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 1500));
    try {
      return await callOnce(key, systemInstruction, userContent, maxOutputTokens, model);
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
      // 429(한도)·타임아웃은 재시도해도 소용없거나 역효과 — 즉시 반환.
      if (lastError.message.includes("한도") || lastError.message.includes("오래 걸립니다")) break;
    }
  }
  throw lastError ?? new Error("AI 분석 생성에 실패했습니다.");
}

async function callOnce(
  key: string,
  systemInstruction: string,
  userContent: string,
  maxOutputTokens: number,
  model: "flash" | "pro",
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS[model]);
  try {
    const res = await fetch(urlFor(model), {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      signal: controller.signal,
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemInstruction }] },
        contents: [{ role: "user", parts: [{ text: userContent }] }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens,
          // 2.5-flash의 '생각' 시간을 제한 — 요약·조언 태스크라 품질 손실 없이 응답을 수 초로
          // 단축한다(무제한이면 10~30초로 들쭉날쭉 → 서버리스 함수 시간 초과의 주원인).
          // Flash: thinking 제한(512)으로 응답을 수 초로. Pro: thinking을 끄거나 너무 줄이면
          // 해석 품질이 떨어지므로 넉넉히(2048) — Pro 경로는 온디맨드라 지연 감수.
          thinkingConfig: { thinkingBudget: model === "pro" ? 2048 : 512 },
        },
      }),
    });
    if (!res.ok) {
      // 429=할당 초과, 4xx/5xx — 사용자에게는 재시도 안내만(상세는 서버 로그).
      console.error(`[gemini] HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
      throw new Error(
        res.status === 429
          ? "AI 사용량 한도에 도달했습니다. 잠시 후 다시 시도하세요."
          : "AI 분석 생성에 실패했습니다. 잠시 후 다시 시도하세요.",
      );
    }
    const data = (await res.json()) as GeminiResponse;
    const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    if (!text.trim()) throw new Error("AI가 빈 응답을 돌려줬습니다. 다시 시도하세요.");
    return text.trim();
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      throw new Error("AI 응답이 너무 오래 걸립니다. 잠시 후 다시 시도하세요.");
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
