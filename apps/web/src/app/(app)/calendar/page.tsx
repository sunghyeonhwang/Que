import { PageHeader } from "@/components/app/page-header";

export default function CalendarPage() {
  return (
    <div>
      <PageHeader
        title="캘린더"
        subtitle="회사 일정, 작업, 마일스톤을 한 시간축에서 — 기본형/전체 멤버/타임라인 뷰 전환"
      />
      <p className="text-sm text-muted-foreground">
        Phase 3에서 구현: 뷰 스위처(기본형/전체 멤버/타임라인), 기간 스위처(일간/주간/월간), 드래그 이동, 변경 로그.
      </p>
    </div>
  );
}
