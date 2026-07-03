import { LinkTabs } from "@/components/app/link-tabs";

/** 회의록 메뉴 탭 — 회의록(/meeting-notes)과 Action(/action)을 오간다. */
export function NoteTabs({ active }: { active: "notes" | "action" }) {
  return (
    <LinkTabs
      label="회의록 탭 전환"
      active={active}
      tabs={[
        { key: "notes", label: "회의록", href: "/meeting-notes" },
        { key: "action", label: "Action", href: "/action" },
      ]}
    />
  );
}
