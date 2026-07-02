import Link from "next/link";
import { getCurrentUser } from "@/lib/current-user";
import { SidebarNav } from "@/components/app/sidebar-nav";
import { UserSwitcher } from "@/components/app/user-switcher";
import { MobileNav } from "@/components/app/mobile-nav";
import { ScrollArea } from "@/components/ui/scroll-area";

// App Shell.
// - lg 이상(태블릿 가로~FHD): 좌측 고정 사이드바, 본문 min-w-0
// - lg 미만(태블릿 세로): 상단 헤더 + Sheet 내비게이션
export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await getCurrentUser();

  return (
    <div className="flex min-h-dvh w-full">
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground lg:flex">
        <div className="flex items-center gap-2 px-4 py-4">
          <Brand />
        </div>
        <ScrollArea className="min-h-0 flex-1 px-3">
          <SidebarNav />
        </ScrollArea>
        <div className="border-t p-3">
          <UserSwitcher current={user} />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex h-14 items-center gap-2 border-b bg-background px-3 lg:hidden">
          <MobileNav />
          <Brand />
          <div className="ml-auto w-40">
            <UserSwitcher current={user} />
          </div>
        </header>
        <main className="min-w-0 flex-1 p-4 md:p-5 xl:p-6">{children}</main>
      </div>
    </div>
  );
}

function Brand() {
  return (
    <Link href="/" className="flex items-center gap-2" aria-label="Que 홈">
      <span className="flex size-8 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
        Q
      </span>
      <span className="text-base font-semibold tracking-tight">Que</span>
    </Link>
  );
}
