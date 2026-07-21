import type { Metadata, Viewport } from "next";
import { Inter_Tight, Noto_Sans_KR, Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import { cookies } from "next/headers";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

// 폰트 = 라틴/한글 별도 선택(설정 > 모양). 기본: 한글 SUIT · 라틴 Inter Tight.
// 각 폰트를 CSS 변수로 등록하고, globals.css가 html[data-ko]/[data-latin]로 활성 폰트를 고른다.
// 기본 2종만 preload=true, 대체 폰트는 preload=false(선택 시에만 다운로드 → 초기 무게 최소).
const interTight = Inter_Tight({
  variable: "--font-inter-tight",
  subsets: ["latin"],
  display: "swap",
});
const suit = localFont({
  src: "../fonts/SUIT-Variable.woff2",
  variable: "--font-suit",
  weight: "100 900",
  display: "swap",
});
const pretendard = localFont({
  src: "../fonts/PretendardVariable.woff2",
  variable: "--font-pretendard",
  weight: "45 920",
  display: "swap",
  preload: false,
});
const notoSansKr = Noto_Sans_KR({
  variable: "--font-noto-kr",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
  preload: false,
});
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// 파비콘·애플 아이콘·OG/트위터 썸네일은 같은 폴더의 파일 규약(icon.png·apple-icon.png·
// opengraph-image.png·twitter-image.png — 2026-07-21 사용자 제공 브랜드 자산)이 자동 주입한다.
// metadataBase는 공유 썸네일 절대 URL의 기준 — 다중 도메인(view/gant/font 호스트 라우팅)에서도
// 브랜드 대표 도메인으로 고정한다.
export const metadata: Metadata = {
  metadataBase: new URL("https://que.griff.co.kr"),
  title: "Que",
  description: "캘린더 UI를 가진 팀 작업 상태 관리 도구",
  openGraph: {
    title: "Que — GRIFF 팀 작업 상태 관리",
    description: "캘린더 UI를 가진 팀 작업 상태 관리 도구",
    siteName: "Que",
    type: "website",
  },
};

// 모바일 키보드 대응 — interactiveWidget=resizes-content로 키보드가 뜨면 뷰포트(및 dvh)가 줄어들어
// Copilot·데일리 등 하단 고정 입력창이 키보드 위로 보인다. width/initialScale은 Next 기본값을 유지한다.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  interactiveWidget: "resizes-content",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // 폰트·테마·밀도 선택을 쿠키에서 읽어 SSR로 html 속성에 심는다(첫 프레임 깜빡임 없음).
  const cookieStore = await cookies();
  const fontKo = cookieStore.get("font-ko")?.value;
  const fontLatin = cookieStore.get("font-latin")?.value;
  const theme = cookieStore.get("theme")?.value;
  const density = cookieStore.get("density")?.value;
  const isDark = theme === "dark";

  return (
    <html
      lang="ko"
      data-ko={fontKo}
      data-latin={fontLatin}
      data-density={density}
      className={`${interTight.variable} ${suit.variable} ${pretendard.variable} ${notoSansKr.variable} ${geistMono.variable} h-full antialiased${isDark ? " dark" : ""}`}
    >
      <body className="min-h-full flex flex-col">
        <TooltipProvider>{children}</TooltipProvider>
        <Toaster />
      </body>
    </html>
  );
}
