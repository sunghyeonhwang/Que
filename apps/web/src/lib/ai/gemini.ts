import "server-only";

// Gemini API 호출 래퍼 — E-10 분석 AI. 서버 전용(키는 env, 클라이언트 노출 금지 — server-only 가드).
// 온디맨드 버튼식(관리자·대표)이라 호출량이 작다 — Flash 무료 할당으로 충분.
// 실패는 QueRuleError처럼 던지지 않고 한글 메시지 Error로 — 호출부(서버 액션)가 {ok:false}로 변환.

// 기본은 Flash(빠름·무료 할당). 리포트 분석처럼 깊은 해석이 필요한 곳만 Pro를 옵션으로 쓴다
// (사용자 결정 2026-07-11 — Pro는 느리고 유료 과금이라 온디맨드 버튼 경로 한정).
// pro는 버전 고정이 아니라 최신 안정판 별칭(gemini-pro-latest) — 2.5-pro가 신규 키에 404로
// 은퇴("no longer available to new users", 2026-07-11 프로덕션 장애)한 교훈. 별칭이면 은퇴에 안전.
const MODEL_ID = { flash: "gemini-2.5-flash", pro: "gemini-pro-latest" } as const;
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

// ---------------------------------------------------------------------------
// Que Copilot 전용 — Gemini function calling(도구 호출) 저수준 래퍼.
// generateAnalysis(단발 텍스트 생성)와 달리 도구 선언 + 멀티턴 contents를 받아
// 모델의 후보 content(text 또는 functionCall parts)를 그대로 돌려준다. 도구 실행 루프는
// 호출부(copilot.ts)가 담당한다 — 이 함수는 왕복 1회만. MODEL_ID·키·타임아웃을 재사용한다.
// generateAnalysis는 건드리지 않는다(function calling 미지원 경로라 별도 함수로 분리).

/** 모델이 호출한 도구(functionCall) — args는 모델이 채운 파라미터(신뢰 금지, 호출부에서 검증). */
export interface GeminiFunctionCall {
  name: string;
  args: Record<string, unknown>;
}

/** Gemini content part — text / functionCall(모델→우리) / functionResponse(우리→모델) 중 하나. */
export interface GeminiPart {
  text?: string;
  functionCall?: GeminiFunctionCall;
  functionResponse?: { name: string; response: Record<string, unknown> };
}

/** 대화 턴. role은 v1beta에서 "user"|"model"만 유효(functionResponse도 "user" 턴으로 보낸다). */
export interface GeminiContent {
  role: "user" | "model";
  parts: GeminiPart[];
}

/** 도구(함수) 선언 — parameters는 OpenAPI subset JSON Schema. */
export interface GeminiFunctionDeclaration {
  name: string;
  description: string;
  parameters?: Record<string, unknown>;
}

/**
 * 도구 선언과 함께 1회 generateContent 호출 → 모델 후보 content(parts) 반환.
 * parts 안에 functionCall이 있으면 호출부가 도구를 실행하고 functionResponse를 append해 다시 부른다.
 */
export async function generateWithTools(params: {
  systemInstruction: string;
  contents: GeminiContent[];
  functionDeclarations: GeminiFunctionDeclaration[];
  model?: "flash" | "pro";
  maxOutputTokens?: number;
}): Promise<GeminiContent> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error("AI 코파일럿이 설정되지 않았습니다 (GEMINI_API_KEY 미설정) — 관리자에게 문의하세요.");
  }
  const model = params.model ?? "flash";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS[model]);
  try {
    const res = await fetch(urlFor(model), {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      signal: controller.signal,
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: params.systemInstruction }] },
        contents: params.contents,
        tools: [{ functionDeclarations: params.functionDeclarations }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: params.maxOutputTokens ?? 2048,
          thinkingConfig: { thinkingBudget: model === "pro" ? 2048 : 512 },
        },
      }),
    });
    if (!res.ok) {
      console.error(`[gemini:tools] HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
      throw new Error(
        res.status === 429
          ? "AI 사용량 한도에 도달했습니다. 잠시 후 다시 시도하세요."
          : "AI 응답 생성에 실패했습니다. 잠시 후 다시 시도하세요.",
      );
    }
    const data = (await res.json()) as { candidates?: { content?: GeminiContent }[] };
    const content = data.candidates?.[0]?.content;
    if (!content) throw new Error("AI가 빈 응답을 돌려줬습니다. 다시 시도하세요.");
    return { role: "model", parts: content.parts ?? [] };
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      throw new Error("AI 응답이 너무 오래 걸립니다. 잠시 후 다시 시도하세요.");
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
