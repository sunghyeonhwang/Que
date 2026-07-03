import { getCurrentUser } from "@/lib/current-user";
import { PageHeader } from "@/components/app/page-header";

export const dynamic = "force-dynamic";

// 홈 — 신규 플레이스홀더. 실제 디자인은 추후 제공.
export default async function HomePage() {
  await getCurrentUser();

  return (
    <div>
      <PageHeader title="홈" subtitle="워크스페이스 요약 화면입니다." />
      <div className="flex min-h-[240px] items-center justify-center rounded-xl border border-dashed border-[var(--que-border)] bg-[var(--que-bg-muted)] text-sm text-[var(--que-text-tertiary)]">
        준비 중입니다.
      </div>
    </div>
  );
}
