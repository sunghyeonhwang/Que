import { auth } from "@/auth";
import { loadReadOnlyDb } from "@/lib/db";
import { dateKeyOfIso } from "@/lib/daily-data";

// 세무회계용 결제내역 CSV 다운로드 — 관리자 전용, 같은 출처(브라우저 세션) 다운로드.
//
// ── 보안 근거 ────────────────────────────────────────────────────────────────
// - Auth.js 세션(auth())으로만 사용자를 확정한다(PAT withApi 경로 아님 — 사람이 브라우저에서 내려받는다).
//   admin이 아니면 403. same-origin 링크 내비게이션(SameSite=Lax GET)이라 CORS·CSRF 토큰 불요.
// - 계좌번호 원본을 포함한다: 세무 증빙(지급 명세)에 계좌가 필요하고, 이 라우트는 admin에게만 열린다
//   (화면 목록의 마스킹과 달리 CSV는 세무 목적의 인가된 반출이다).
// 대상: 완료(done)된 결제 중 완료일(lastChangedAt)이 [from, to) 기간에 든 건(세무=지급 완료 기준, 취소 제외).

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** ISO → KST 날짜(YYYY-MM-DD). 비어있으면 "". */
function isoDate(iso?: string): string {
  return iso ? dateKeyOfIso(iso) : "";
}

/** CSV 필드 이스케이프 — 콤마·따옴표·개행은 따옴표 감싸기 + 내부 따옴표 2배.
 *  수식 인젝션 방어(글래도스 게이트): `= + - @` 탭·CR로 시작하는 셀은 엑셀이 수식으로 실행하므로
 *  작은따옴표(')를 프리픽스해 텍스트로 강등한다 — 제목·요청자 등 사용자 입력이 그대로 나가는 반출 표면. */
function csvEscape(value: string): string {
  const defused = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(defused) ? `"${defused.replace(/"/g, '""')}"` : defused;
}

export async function GET(request: Request): Promise<Response> {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return new Response("Unauthorized", { status: 401 });

  const db = await loadReadOnlyDb();
  const actor = db.users.find((u) => u.id === id);
  if (!actor || actor.active === false) {
    return new Response("Unauthorized", { status: 401 });
  }
  if (actor.role !== "admin") return new Response("Forbidden", { status: 403 });

  const url = new URL(request.url);
  const from = url.searchParams.get("from") ?? "";
  const to = url.searchParams.get("to") ?? "";
  const label = url.searchParams.get("label") ?? "";
  if (!DATE_RE.test(from) || !DATE_RE.test(to) || from >= to) {
    return new Response("Bad Request: from/to 형식(YYYY-MM-DD)·범위를 확인하세요.", {
      status: 400,
    });
  }

  const userById = new Map(db.users.map((u) => [u.id, u]));
  const rows = db.paymentRequests
    .filter((p) => {
      if (p.status !== "done" || !p.lastChangedAt) return false;
      const key = dateKeyOfIso(p.lastChangedAt);
      return key >= from && key < to; // [from, to) — to는 다음 기간 시작(배타)
    })
    .sort((a, b) => (b.lastChangedAt ?? "").localeCompare(a.lastChangedAt ?? ""));

  const header = [
    "완료일",
    "제목",
    "분류",
    "금액",
    "요청자",
    "입금받을 곳",
    "은행",
    "계좌번호",
    "마감일",
    "등록일",
  ];
  const body = rows.map((p) => [
    isoDate(p.lastChangedAt),
    p.title,
    p.category,
    String(p.amount),
    userById.get(p.requesterId)?.name ?? p.requesterId,
    p.recipientName ?? "",
    p.bankName,
    p.accountNumber,
    isoDate(p.dueAt),
    isoDate(p.createdAt),
  ]);

  // UTF-8 BOM(엑셀 한글 깨짐 방지) + CRLF 줄바꿈.
  const csv =
    "\uFEFF" +
    [header, ...body].map((r) => r.map(csvEscape).join(",")).join("\r\n") +
    "\r\n";

  const safeLabel = /^[\w-]+$/.test(label) ? label : "export";
  const filename = `결제내역_${safeLabel}.csv`;
  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      // RFC 5987 — 한글 파일명은 filename*로, 구형 폴백은 ASCII filename으로.
      "Content-Disposition": `attachment; filename="payments_${safeLabel}.csv"; filename*=UTF-8''${encodeURIComponent(
        filename,
      )}`,
      "Cache-Control": "no-store",
    },
  });
}
