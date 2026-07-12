import type { Metadata } from "next";

import { MotionProvider } from "@/components/app/motion-provider";

// 회의용 통합 간트 셸(gant.griff.co.kr).
// - (app) 밖에 두어 앱 사이드바·상단바 없이 전체 폭으로 렌더한다(회의실 TV 조망용).
//   단 view(공개)와 달리 인증이 필요하므로, 페이지 자체가 getCurrentUser로 게이트를 건다.
// - h-dvh 고정 + 내부 스크롤(간트 그리드). 페이지 전체 레이아웃을 깨지 않는다.
// - noindex는 proxy(X-Robots-Tag) + 이 metadata robots로 이중 차단.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
  title: "통합 간트",
};

export default function GanttShellLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <MotionProvider>
      <div className="flex h-dvh w-full flex-col overflow-hidden bg-[var(--que-canvas)] text-[var(--que-text)]">
        {children}
      </div>
    </MotionProvider>
  );
}
