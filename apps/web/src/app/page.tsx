import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";

// 역할별 기본 진입점: 팀원 → 오늘, 관리자/프로젝트 담당자 → Now.
export default async function RootPage() {
  const user = await getCurrentUser();
  redirect(user.role === "admin" ? "/now" : "/today");
}
