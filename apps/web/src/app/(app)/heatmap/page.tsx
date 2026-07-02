import { PageHeader } from "@/components/app/page-header";

export default function HeatmapPage() {
  return (
    <div>
      <PageHeader title="히트맵" subtitle="멤버별 작업량 편차 — 평가가 아니라 배분 조정용" />
      <p className="text-sm text-muted-foreground">
        Phase 5에서 구현: 멤버×요일 작업량 히트맵, 강도 범례, 총 작업량 그래프, 과부하/여유 요약.
      </p>
    </div>
  );
}
