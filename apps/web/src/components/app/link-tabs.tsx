import Link from "next/link";
import { cn } from "@/lib/utils";

export interface LinkTab {
  key: string;
  label: string;
  href: string;
}

/** URL 기반 Link 탭 nav. 병합 메뉴(작업 목록·회의록)에서 두 라우트를 오갈 때 쓴다.
 *  캘린더 ViewSwitcher와 같은 시각 패턴 — 현재 탭은 primary로 강조한다. */
export function LinkTabs({
  label,
  tabs,
  active,
}: {
  label: string;
  tabs: LinkTab[];
  active: string;
}) {
  return (
    <nav aria-label={label} className="mb-4 flex w-fit rounded-lg border p-0.5">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          aria-current={active === tab.key ? "page" : undefined}
          className={cn(
            "flex h-10 items-center rounded-md px-4 text-sm font-medium transition-colors",
            active === tab.key
              ? "bg-primary text-primary-foreground"
              : "hover:bg-accent",
          )}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
