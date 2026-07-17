import { LinkTabs } from "@/components/app/link-tabs";

/** 회의록 메뉴 탭 — 회의록(/meeting-notes)·Action(/action)·결정(/meeting-notes?tab=decisions)을 오간다.
 *  회의록/결정은 같은 라우트의 ?tab= 분기, Action은 별도 라우트다(명세 B-4). */
export function NoteTabs({ active }: { active: "notes" | "action" | "decisions" }) {
  return (
    <LinkTabs
      label="회의록 탭 전환"
      active={active}
      tabs={[
        { key: "notes", label: "회의록", href: "/meeting-notes" },
        { key: "action", label: "Action", href: "/action" },
        { key: "decisions", label: "결정", href: "/meeting-notes?tab=decisions" },
      ]}
    />
  );
}
