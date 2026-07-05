import type { Metadata } from "next";
import { Suspense } from "react";
import { loadReadOnlyDb } from "@/lib/db";
import { SlideshowController } from "@/components/view/slideshow-controller";
import { ViewSettings } from "@/components/view/view-settings";

// 공개 읽기전용 현황판 셸.
// - (app) 밖에 두어 auth()/getCurrentUser()를 절대 호출하지 않는다 → 로그인 없이 공개.
// - 디스플레이(대형 화면) 상시 노출용 풀스크린. 밝은 배경, h-dvh, 내부에서 frontend가 채운다.
// - noindex는 proxy(X-Robots-Tag) + 이 metadata robots로 이중 차단.
// - SlideshowController를 여기(레이아웃)에 두어 view↔board 소프트 내비 간 언마운트되지 않게 한다
//   → 슬라이드쇼 타이머/URL 상태가 페이지 전환에도 지속(무상태 재-arm은 URL만 보고 재개).
//   boardPages는 서버에서 팀원 수로 계산(2명/페이지)해 주입한다.

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  title: "현황판",
};

export default async function ViewLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const db = await loadReadOnlyDb();
  const boardPages = Math.max(1, Math.ceil(db.users.length / 2));

  return (
    // 현황판 전체를 SUIT로 통일한다. 라틴/한글 혼용(--font-sans는 라틴=Inter Tight 우선)을
    // 쓰지 않고, 앱이 루트에서 이미 로드한 --font-suit(next/font/local, preload) 변수를 그대로
    // 재사용해 새 @font-face 없이 벽 디스플레이 타이포를 단일 폰트로 맞춘다.
    <div
      className="relative flex h-dvh w-full flex-col overflow-hidden bg-white text-neutral-900"
      style={{ fontFamily: "var(--font-suit), sans-serif" }}
    >
      {children}
      {/* useSearchParams 사용 → prerender 시 Suspense 경계 필요(빌드 안전). */}
      <Suspense fallback={null}>
        <SlideshowController boardPages={boardPages} />
      </Suspense>
      <ViewSettings />
    </div>
  );
}
