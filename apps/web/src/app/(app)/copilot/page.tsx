import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/current-user";
import { CopilotPageClient } from "./copilot-page-client";

// Que Copilot 풀 페이지. ⌘K 팔레트 채팅이 좁아 별도 메뉴/화면으로 승격한 LLM 채팅 스타일.
// 조회 답변은 실데이터 도구 결과로만, 쓰기는 확인 카드(draft) → 사람이 [실행]을 눌러야 core mutation이 돈다.
// 대화는 세션 로컬(저장 안 함 — 기록되는 것은 확정 실행뿐, 기존 계약 유지).
export const metadata: Metadata = { title: "Copilot" };

export const dynamic = "force-dynamic";

export default async function CopilotPage() {
  // 세션 강제(다른 화면과 동일 — 로그인 사용자만 접근). 반환값은 사용하지 않지만 인증 게이트로 호출한다.
  await getCurrentUser();
  return <CopilotPageClient />;
}
