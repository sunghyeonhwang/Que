import { LinkTabs } from "@/components/app/link-tabs";

/** 작업 목록 메뉴 탭 — 오늘(/today)과 Now(/now)를 오간다. */
export function TaskTabs({ active }: { active: "today" | "now" }) {
  return (
    <LinkTabs
      label="작업 목록 탭 전환"
      active={active}
      tabs={[
        { key: "today", label: "오늘", href: "/today" },
        { key: "now", label: "Now", href: "/now" },
      ]}
    />
  );
}
