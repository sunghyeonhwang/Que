import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { rankForUser } from "@que/core";
import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import { RosterProvider, type RosterUser } from "@/components/app/roster-provider";
import { getNoteSummary } from "@/lib/notes-summary";
import { getAlerts } from "@/lib/alerts-data";
import { getClientFilter, getClientOptions } from "@/lib/client-filter";
import { Brand } from "@/components/app/brand";
import { ClientSwitcher } from "@/components/app/client-switcher";
import { SidebarNav } from "@/components/app/sidebar-nav";
import { SidebarRail } from "@/components/app/sidebar-rail";
import { UserSwitcher } from "@/components/app/user-switcher";
import { FullscreenButton } from "@/components/app/fullscreen-button";
import { ThemeToggle } from "@/components/app/theme-toggle";
import { MobileNav } from "@/components/app/mobile-nav";
import { GlobalSearch } from "@/components/app/global-search";
import { CommandPalette } from "@/components/app/command-palette";
import { KeyboardShortcuts } from "@/components/app/keyboard-shortcuts";
import { NotificationsBell } from "@/components/app/notifications-bell";
import { AddTaskDialog } from "@/components/app/add-task-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

// App Shell (재설계).
// - xl 이상: 좌측 고정 풀 사이드바(로고+워드마크+클라이언트 스위처+라벨 메뉴)
// - lg~xl(태블릿 가로): 아이콘 전용 축소 레일(72px, 라벨은 Tooltip). 클라이언트 스위처는 상단바로 이동
// - lg 미만(태블릿 세로): 상단바에 햄버거(Sheet 내비) + 컴팩트 로고 + 클라이언트 스위처
// 뷰포트 고정 높이(h-dvh) + main 내부 스크롤. 페이지 전체 레이아웃을 깨지 않는다.
export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await getCurrentUser();
  // 임시 비밀번호 상태면 앱을 열기 전에 비밀번호 변경을 강제한다(격리 화면).
  const session = await auth();
  if (session?.user?.mustChangePassword) redirect("/change-password");
  const rank = rankForUser(user);

  // 사이드바 뱃지 실데이터 — 확인필요 = 열람 권한 스코프의 '확인 필요' Action 수(getNoteSummary).
  const noteSummary = await getNoteSummary(user);
  const menuBadges: Record<string, number> = { "/meeting-notes": noteSummary.needsReview };
  // 상단바 알림 — 운영 신호(문제/기한초과/확인필요/결제) 실데이터.
  const alerts = await getAlerts(user);
  const isAdmin = user.role === "admin";
  // 클라이언트 스위처 데이터 — 데스크톱은 사이드바 상단, 모바일(사이드바 숨김)은 상단바에 렌더.
  // getClientOptions/getClientFilter는 cache()라 두 번 호출해도 로드는 1회.
  const clientOptions = await getClientOptions();
  const clientFilter = await getClientFilter();
  // 헤더 다크 토글 초기 아이콘 — 쿠키의 theme으로 SSR 결정(깜빡임 방지).
  const initialTheme = (await cookies()).get("theme")?.value === "dark" ? "dark" : "light";

  // 담당자/참석자 선택 명단 — 현재 재직자(active)만. 클라이언트 폼이 useRoster()로 공유해서 쓴다.
  const db = await getDb();
  const roster: RosterUser[] = db.users
    .filter((u) => u.active !== false)
    .map((u) => ({ id: u.id, name: u.name, avatarColor: u.avatarColor, role: u.role }));

  return (
    <RosterProvider roster={roster}>
    <div className="flex h-dvh w-full overflow-hidden bg-[var(--que-bg)] text-[var(--que-text)]">
      <CommandPalette />
      <KeyboardShortcuts />
      {/* 태블릿 가로(lg~xl): 아이콘 전용 축소 레일 — 본문 가용폭 확보(보드뷰 컬럼 수 유지) */}
      <aside className="hidden w-[72px] shrink-0 flex-col border-r border-[var(--que-border)] bg-[var(--que-bg)] lg:flex xl:hidden">
        <div className="flex h-[72px] shrink-0 items-center justify-center border-b border-[var(--que-border)]">
          <Brand compact />
        </div>
        <ScrollArea className="min-h-0 flex-1 px-2 py-4">
          <SidebarRail badges={menuBadges} isAdmin={isAdmin} />
        </ScrollArea>
      </aside>

      {/* xl 이상: 풀 사이드바(로고+클라이언트 스위처+라벨 메뉴) */}
      <aside className="hidden w-[236px] shrink-0 flex-col border-r border-[var(--que-border)] bg-[var(--que-bg)] xl:flex">
        <div className="flex h-[72px] shrink-0 items-center justify-center border-b border-[var(--que-border)] px-5">
          <Brand />
        </div>
        <ScrollArea className="min-h-0 flex-1 px-4 py-4">
          {clientOptions.length > 0 && (
            <div className="mb-3 [&_button]:w-full [&_button]:justify-between">
              <ClientSwitcher clients={clientOptions} current={clientFilter} />
            </div>
          )}
          <SidebarNav badges={menuBadges} isAdmin={isAdmin} />
        </ScrollArea>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-[72px] shrink-0 items-center gap-2 border-b border-[var(--que-border)] bg-[var(--que-bg)] px-3 sm:gap-4 sm:px-5 lg:px-6">
          <div className="lg:hidden">
            <MobileNav badges={menuBadges} isAdmin={isAdmin} />
          </div>
          <div className="lg:hidden">
            <Brand compact />
          </div>

          {/* 풀 사이드바가 없는 구간(축소 레일 lg~xl · 모바일 <lg)에서는 상단바에 클라이언트 스위처 노출 */}
          <div className="xl:hidden">
            <ClientSwitcher clients={clientOptions} current={clientFilter} />
          </div>

          <div className="hidden w-full max-w-[440px] flex-1 sm:block">
            <GlobalSearch />
          </div>

          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            <AddTaskDialog currentUserId={user.id} />
            <NotificationsBell alerts={alerts} />
            <UserSwitcher current={user} rank={rank} />
            <FullscreenButton />
            <ThemeToggle initialTheme={initialTheme} />
          </div>
        </header>

        <main className="min-h-0 min-w-0 flex-1 overflow-y-auto bg-[var(--que-canvas)] p-4 md:p-5 xl:p-6">
          {children}
        </main>
      </div>
    </div>
    </RosterProvider>
  );
}
