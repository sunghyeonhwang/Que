import "server-only";

// Gemini API 호출 래퍼 — E-10 분석 AI. 서버 전용(키는 env, 클라이언트 노출 금지 — server-only 가드).
// 온디맨드 버튼식(관리자·대표)이라 호출량이 작다 — Flash 무료 할당으로 충분.
// 실패는 QueRuleError처럼 던지지 않고 한글 메시지 Error로 — 호출부(서버 액션)가 {ok:false}로 변환.

const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const TIMEOUT_MS = 45_000; // 리포트 분석은 수 초 — 여유 있게

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
}

/**
 * 시스템 지시 + 사용자 콘텐츠로 텍스트 생성. GEMINI_API_KEY 미설정이면 기능 비활성 안내를 던진다.
 */
export async function generateAnalysis(systemInstruction: string, userContent: string): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error("AI 분석이 설정되지 않았습니다 (GEMINI_API_KEY 미설정) — 관리자에게 문의하세요.");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(GEMINI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      signal: controller.signal,
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemInstruction }] },
        contents: [{ role: "user", parts: [{ text: userContent }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 4096 },
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
