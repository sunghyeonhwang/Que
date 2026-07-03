import { redirect } from "next/navigation";

// 구 캘린더 화면은 재설계로 은퇴 — 일정(/schedule)이 대체한다(HANDOFF 51).
// 라우트는 리다이렉트로만 유지(직접 URL/북마크 보호). calendar/actions.ts의
// moveTaskToDateAction은 오늘·팀현황 화면에서 여전히 LIVE라 파일은 남겨둔다.
export default function CalendarRedirect() {
  redirect("/schedule");
}
