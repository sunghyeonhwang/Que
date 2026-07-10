import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

// 로그인 후 랜딩은 전 역할 공통 /home(2026-07-11 사용자 결정 — 기존 역할별 진입 폐기).
export default function RootPage() {
  redirect("/home");
}
