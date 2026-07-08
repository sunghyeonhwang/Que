import { z } from "zod";
import { verifyCredentials } from "@/lib/auth/verify";
import { issuePat } from "@/lib/auth/tokens";

// D-1 · 모바일 로그인 엔드포인트(DayBlocks 앱). PAT 인증 제외 = 공개 로그인 표면.
// email+password를 받아 verifyCredentials(잠금·브루트포스 방어 내장)로 검증하고,
// 성공 시 라벨 'mobile'의 PAT를 발급해 반환한다. 이후 앱은 이 PAT로 Que REST API를 호출한다.
//
// ⚠️ 보안: credential을 받는 새 표면이므로 반드시 verifyCredentials(users 테이블 잠금 카운터)를 경유한다.
//   실패는 계정 존재 여부를 누설하지 않는 일반 메시지로만 응답한다. CORS는 proxy.ts가 커버.

const bodySchema = z.object({
  email: z.string().min(1).max(254),
  password: z.string().min(1).max(200),
});

const GENERIC_FAIL = "이메일 또는 비밀번호가 올바르지 않습니다.";

function fail(status: number, message: string): Response {
  return Response.json({ error: { message } }, { status });
}

export async function POST(request: Request) {
  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch {
    // 형식 오류도 계정 정보를 누설하지 않도록 일반 메시지로 통일.
    return fail(400, GENERIC_FAIL);
  }

  // 잠금·브루트포스 방어는 verifyCredentials 내부(users 테이블 카운터)에서 강제된다.
  const user = await verifyCredentials(body.email, body.password);
  // 실패(없음/비번틀림/비활성/잠금)는 전부 동일한 일반 메시지 — 계정 존재 여부 누설 금지.
  if (!user) return fail(401, GENERIC_FAIL);

  // 임시 비밀번호 상태면 발급 거부 — 웹에서 먼저 변경하도록 안내(모바일엔 변경 UX 없음).
  if (user.mustChangePassword) {
    return fail(403, "웹에서 비밀번호를 먼저 변경하세요.");
  }

  const issued = await issuePat({ userId: user.id, label: "mobile" });
  if (!issued.ok) {
    return fail(500, issued.error);
  }

  // 토큰 만료 없음(현행 PAT과 동일). 최소 프로필만 반환(민감 필드 제외).
  return Response.json({
    token: issued.token,
    user: { id: user.id, name: user.name, role: user.role },
  });
}
