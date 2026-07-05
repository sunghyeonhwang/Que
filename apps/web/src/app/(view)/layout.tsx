import type { Metadata } from "next";

// 공개 읽기전용 현황판 셸.
// - (app) 밖에 두어 auth()/getCurrentUser()를 절대 호출하지 않는다 → 로그인 없이 공개.
// - 디스플레이(대형 화면) 상시 노출용 풀스크린. 밝은 배경, h-dvh, 내부에서 frontend가 채운다.
// - noindex는 proxy(X-Robots-Tag) + 이 metadata robots로 이중 차단.

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  title: "현황판",
};

export default function ViewLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden bg-white text-neutral-900">
      {children}
    </div>
  );
}
