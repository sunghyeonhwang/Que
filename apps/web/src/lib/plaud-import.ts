import "server-only";

// Plaud 공유 링크 → 회의록 가져오기(서버 전용). 인증 불필요한 공개 공유 API를 호출한다.
//
// SSRF 방어 원칙:
//  - 사용자가 준 URL을 그대로 fetch하지 않는다. 입력에서 shareId(pub_…::token)만 정규식으로 뽑아,
//    fetch 대상 URL은 **우리가** 조립한다(api.plaud.ai + shareId).
//  - 지역 리다이렉트(status -302)가 준 도메인도 host가 *.plaud.ai(https)인지 검증한 뒤에만 재요청한다.
//  - HTTP 리다이렉트는 따르지 않는다(redirect:"error") — 3xx로 임의 호스트로 튀는 것을 차단.
//  - 타임아웃 10s, 응답 크기 상한 2MB.

/** Plaud 공유 링크에서 가져온 회의록 원자료(저장 전). */
export interface PlaudNoteImport {
  title: string;
  markdownBody: string;
  /** 회의 시각 ISO(start_time epoch ms 변환). 파싱 실패 시 호출부가 폴백한다. */
  meetingAt?: string;
  fileName: string;
}

const SHARE_ID_RE = /\/s\/(pub_[A-Za-z0-9-]+::[A-Za-z0-9_-]+)/;
const PRIMARY_HOST = "api.plaud.ai";
const FETCH_TIMEOUT_MS = 10_000;
const MAX_BYTES = 2 * 1024 * 1024; // 2MB

/** 입력(공유 URL 또는 붙여넣기 텍스트)에서 shareId를 뽑는다. 없으면 null. 순수 함수. */
export function extractPlaudShareId(input: string): string | null {
  if (typeof input !== "string") return null;
  return input.match(SHARE_ID_RE)?.[1] ?? null;
}

/** fetch 허용 호스트인지 — plaud.ai 또는 그 서브도메인만(SSRF 화이트리스트). 순수 함수. */
export function isAllowedPlaudHost(host: string): boolean {
  const h = host.toLowerCase();
  return h === "plaud.ai" || h.endsWith(".plaud.ai");
}

/** 검증된 https + 허용 호스트 URL만 반환(그 외 null). 리다이렉트 도메인 검증에 쓴다. */
function safePlaudBase(rawOrigin: unknown): string | null {
  if (typeof rawOrigin !== "string" || !rawOrigin) return null;
  let url: URL;
  try {
    url = new URL(rawOrigin);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  if (!isAllowedPlaudHost(url.hostname)) return null;
  return `${url.protocol}//${url.host}`;
}

/** 단일 GET(타임아웃·크기 상한·리다이렉트 금지). 파싱된 JSON을 돌려준다. */
async function getJson(url: string): Promise<Record<string, unknown>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "error", // HTTP 리다이렉트로 임의 호스트 이동 차단
      headers: {
        accept: "application/json",
        // Plaud가 node 기본 UA를 403으로 차단한다(2026-07-15 라이브 실측 — curl·브라우저 UA는 통과).
        // 화이트리스트 호스트에만 나가는 요청이므로 브라우저형 UA로 식별 문제 없음.
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 QueBot/1.0",
      },
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const len = Number(res.headers.get("content-length") ?? "0");
    if (Number.isFinite(len) && len > MAX_BYTES) throw new Error("응답이 너무 큽니다");
    const text = await res.text();
    if (text.length > MAX_BYTES) throw new Error("응답이 너무 큽니다");
    return JSON.parse(text) as Record<string, unknown>;
  } finally {
    clearTimeout(timer);
  }
}

function asObject(v: unknown): Record<string, unknown> | undefined {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : undefined;
}

/** start_time(epoch ms) → ISO. 초 단위로 온 값도 방어적으로 보정. 실패 시 undefined. */
function startTimeToIso(raw: unknown): string | undefined {
  if (typeof raw !== "number" || !Number.isFinite(raw) || raw <= 0) return undefined;
  // 10자리(초)면 ms로 환산, 13자리(ms)는 그대로.
  const ms = raw < 1e12 ? raw * 1000 : raw;
  const d = new Date(ms);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

/** 성공 응답(data_file)에서 회의록 원자료를 뽑는다. notes_list가 비면 실패. */
function parseShareResponse(
  json: Record<string, unknown>,
): { ok: true; note: PlaudNoteImport } | { ok: false; error: string } {
  // 성공 응답의 data_file은 **최상위** 키다(2026-07-15 실측 — -302 응답만 data.domains 형태).
  // 방어적으로 data 아래 중첩도 함께 본다.
  const dataFile = asObject(json.data_file) ?? asObject(asObject(json.data)?.data_file);
  const notes = Array.isArray(dataFile?.notes_list) ? dataFile!.notes_list : [];
  if (notes.length === 0) {
    return { ok: false, error: "요약이 없는 녹음입니다. Plaud에서 요약을 먼저 생성해 주세요." };
  }
  const first = asObject(notes[0]);
  const content = typeof first?.data_content === "string" ? first.data_content : "";
  if (!content.trim()) {
    return { ok: false, error: "요약이 없는 녹음입니다. Plaud에서 요약을 먼저 생성해 주세요." };
  }
  const dataTitle = typeof first?.data_title === "string" ? first.data_title.trim() : "";
  const filename = typeof dataFile?.filename === "string" ? dataFile.filename.trim() : "";
  const title = (dataTitle || filename || "Plaud 회의록").slice(0, 200);
  const fileName = (dataTitle ? `${dataTitle}.md` : filename || "plaud-note.md").slice(0, 200);
  return {
    ok: true,
    note: {
      title,
      markdownBody: content,
      meetingAt: startTimeToIso(dataFile?.start_time),
      fileName,
    },
  };
}

/**
 * 공유 링크에서 회의록을 가져온다. 실패는 구체 메시지로 반환(throw 안 함).
 * 흐름: shareId 추출 → api.plaud.ai 조회 → status -302면 준 도메인(검증 후) 1회 재요청 → data_file 파싱.
 */
export async function fetchPlaudShare(
  input: string,
): Promise<{ ok: true; note: PlaudNoteImport } | { ok: false; error: string }> {
  const shareId = extractPlaudShareId(input);
  if (!shareId) {
    return { ok: false, error: "Plaud 공유 링크 형식이 아닙니다 (예: https://web.plaud.ai/s/pub_...)" };
  }
  const path = `/share/access/${shareId}`;

  try {
    let json = await getJson(`https://${PRIMARY_HOST}${path}`);
    let status = typeof json.status === "number" ? json.status : NaN;

    // 지역 리다이렉트: -302 + data.domains.api 로 1회 재요청(도메인 검증 필수).
    if (status === -302) {
      const domains = asObject(asObject(json.data)?.domains);
      const base = safePlaudBase(domains?.api);
      if (!base) {
        return { ok: false, error: "Plaud 서버 응답을 확인할 수 없습니다 (지역 리다이렉트 도메인 오류)" };
      }
      json = await getJson(`${base}${path}`);
      status = typeof json.status === "number" ? json.status : NaN;
    }

    if (status !== 0) {
      return {
        ok: false,
        error: "Plaud 링크에 접근할 수 없습니다. 공유가 해제됐거나 링크가 잘못됐을 수 있습니다.",
      };
    }
    return parseShareResponse(json);
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";
    return {
      ok: false,
      error: aborted
        ? "Plaud 서버 응답이 지연됩니다. 잠시 후 다시 시도해 주세요."
        : "Plaud 링크를 불러오지 못했습니다. 네트워크 또는 링크를 확인해 주세요.",
    };
  }
}
