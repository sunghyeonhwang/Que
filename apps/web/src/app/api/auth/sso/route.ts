import { auth } from "@/auth";
import { issuePat, revokePatsByLabel } from "@/lib/auth/tokens";
import { loadReadOnlyDb } from "@/lib/db";

// 브라우저 세션 → PAT 교환 SSO. que.griff.co.kr에 로그인한 사용자가 todo.griff.co.kr(DayBlocks,
// 정적 SPA)을 열면, todo가 credentials:'include'로 이 엔드포인트를 호출해 Que PAT를 받아 계정을 연결한다.
//
// ── 보안 근거 ────────────────────────────────────────────────────────────────
// (1) 이 엔드포인트는 Auth.js 세션 쿠키로만 사용자를 확정한다(자격 증명을 받지 않는다).
//     Que 세션 쿠키는 SameSite=Lax라 cross-site fetch/XHR에는 실리지 않는다 — 단 cross-site
//     top-level GET "내비게이션"에는 실리므로(Lax의 예외), 아래에서 Sec-Fetch-Mode로 내비게이션을
//     거부해 그 잔여 표면(외부 유도 방문 시 rotate 발생·본인 탭에 토큰 노출)까지 닫는다.
//     같은 사이트(*.griff.co.kr)의 fetch만 통과 → CSRF 토큰 없이도 안전하다(글래도스 권고 반영).
// (2) 응답 본문(=PAT)을 JS로 읽을 수 있는 origin은 CORS 화이트리스트(cors.ts)로 제한된다.
//     proxy.ts가 /api/auth/sso 응답에 ACAO(에코, 와일드카드 금지)+ACA-Credentials:true를 붙인다.
// (3) 상태 변화는 PAT rotate 하나뿐이다(멱등에 가까움 — 기존 sso 토큰 폐기 후 새로 1개 발급).
// (4) 세션 쿠키의 Domain을 *.griff.co.kr로 넓히지 않는다. 그게 이 설계의 핵심 — todo는 쿠키를
//     직접 볼 필요가 없고, 오직 이 교환창을 통해 자기 몫의 PAT만 받는다.
//
// CORS/프리플라이트 헤더는 proxy.ts가 전담한다(여기서 손대지 않는다). OPTIONS도 proxy가 응답한다.

const SSO_LABEL = "sso-dayblocks";

// 토큰 응답은 어떤 캐시에도 남기지 않는다(토큰 엔드포인트 표준 위생).
const NO_STORE = { "Cache-Control": "no-store" };

function fail(status: number, message: string): Response {
  return Response.json({ error: message }, { status, headers: NO_STORE });
}

export async function GET(request: Request) {
  // 브라우저 내비게이션(주소창/링크로 직접 방문)은 거부 — 이 엔드포인트는 same-site fetch 전용.
  // 모던 브라우저는 Sec-Fetch-Mode를 항상 보내며(fetch는 "cors"), 헤더가 없는 구형/비브라우저
  // 클라이언트는 쿠키 세션도 없어 401로 떨어진다.
  const fetchMode = request.headers.get("sec-fetch-mode");
  if (fetchMode === "navigate") return fail(403, "이 주소는 직접 열 수 없습니다.");

  const session = await auth();
  const id = session?.user?.id;
  // 미로그인/세션 무효 → 401. todo는 이 신호로 "Que 로그인 필요" 안내를 띄운다.
  if (!id) return fail(401, "로그인이 필요합니다.");

  // 세션은 최대 7일 유지되므로 role·active는 세션값이 아니라 DB(현재값)를 신뢰한다.
  // loadReadOnlyDb: 스케줄러/persist 없는 순수 읽기 — 세션 교환이 DB 쓰기를 유발하지 않는다.
  const db = await loadReadOnlyDb();
  const user = db.users.find((u) => u.id === id);
  // 세션이 남아 있어도 계정이 삭제/비활성이면 발급 거부(로그인 게이트와 동일 기준).
  if (!user || user.active === false) return fail(401, "로그인이 필요합니다.");

  // rotate: 발급 전 같은 라벨의 기존 토큰을 모두 폐기해 누적을 막는다(재방문마다 1개로 수렴).
  await revokePatsByLabel({ userId: id, label: SSO_LABEL });

  const issued = await issuePat({ userId: id, label: SSO_LABEL });
  if (!issued.ok) return fail(500, issued.error);

  // 최소 프로필만 반환(민감 필드 제외) — role은 DB 현재값.
  return Response.json(
    {
      token: issued.token,
      user: { id: user.id, name: user.name, role: user.role },
    },
    { headers: NO_STORE },
  );
}
