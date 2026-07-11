"use client";

import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { CopilotChat } from "@/components/app/copilot-chat";

/**
 * /copilot 풀 페이지 클라이언트 셸.
 * - 앱 셸 main(고정 높이) 안에서 h-full로 뷰포트를 채우고, 대화 영역만 내부 스크롤한다(페이지 스크롤 없음).
 * - CopilotChat variant="page"를 마운트한다(빈 시작 화면·중앙 max-w-3xl·헤더/Esc 없음).
 * - onNavigate는 router.push — 출처 칩 이동 시 채팅을 벗어나되 뒤로가기로 되돌아올 수 있다(새 탭 아님).
 * - 대화는 세션 로컬 유지(저장 안 함 — 기존 계약).
 */
export function CopilotPageClient() {
  const router = useRouter();
  return (
    <div className="flex h-full flex-col">
      {/* 얇은 헤더 — 채팅 앱 스타일로 화면 대부분을 대화가 채운다. */}
      <div className="flex shrink-0 items-center gap-2 border-b border-[var(--que-border)] pb-3">
        <span
          className="flex size-8 items-center justify-center rounded-lg bg-[var(--que-brand-subtle)] text-[var(--que-brand)]"
          aria-hidden
        >
          <Sparkles className="size-4" />
        </span>
        <div className="flex min-w-0 flex-col">
          <h1 className="text-sm font-semibold text-[var(--que-text)]">Copilot</h1>
          <p className="truncate text-xs text-[var(--que-text-tertiary)]">
            실제 데이터로 답하고, 변경은 확인 후에만 실행합니다.
          </p>
        </div>
      </div>

      {/* 대화 영역 — 남은 높이를 모두 차지, 내부만 스크롤. */}
      <div className="min-h-0 flex-1">
        <CopilotChat variant="page" onNavigate={(href) => router.push(href)} />
      </div>
    </div>
  );
}
