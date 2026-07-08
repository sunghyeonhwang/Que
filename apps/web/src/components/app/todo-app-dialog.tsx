"use client";

import { useCallback, useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Check, Copy, ExternalLink, Smartphone } from "lucide-react";
import { OPEN_TODO_APP_EVENT } from "@/lib/menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

/** DayBlocks(모바일 TODO 앱) 접속 주소. 배포 도메인이 바뀌면 env로 덮어쓴다. */
const TODO_APP_URL = process.env.NEXT_PUBLIC_TODO_APP_URL ?? "https://todo.griff.co.kr";

/**
 * 'TODO 앱' 메뉴를 누르면 뜨는 QR 접속 모달. 앱 셸에 전역 1회 마운트한다.
 *
 * 열림 신호는 **전역 이벤트(OPEN_TODO_APP_EVENT)**다. 사이드바·축소 레일·모바일 시트의 '#todo-app'
 * 메뉴가 링크가 아니라 버튼으로 렌더돼 이 이벤트를 쏜다 — 라우팅을 안 하므로 현재 경로·쿼리
 * (예: /projects?project=all) 상태를 그대로 유지한 채 모달만 뜬다.
 */
export function TodoAppDialog() {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const openDialog = () => setOpen(true);
    window.addEventListener(OPEN_TODO_APP_EVENT, openDialog);
    return () => window.removeEventListener(OPEN_TODO_APP_EVENT, openDialog);
  }, []);

  const onOpenChange = useCallback((next: boolean) => {
    setOpen(next);
    if (!next) setCopied(false);
  }, []);

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(TODO_APP_URL);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // 클립보드 접근 불가 환경 — 주소가 화면에 그대로 보이므로 무시한다.
    }
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xs">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Smartphone className="size-4 text-[var(--que-brand)]" aria-hidden />
            TODO 앱 (DayBlocks)
          </DialogTitle>
          <DialogDescription>
            휴대폰 카메라로 QR을 스캔하면 모바일 하루 계획 앱이 열립니다. Que 계정으로 로그인하면
            내 작업이 그대로 이어집니다.
          </DialogDescription>
        </DialogHeader>

        {/* QR은 스캔 대비를 위해 다크모드에서도 항상 흰 배경 위에 검정으로 렌더한다. */}
        <div className="flex justify-center">
          <div className="rounded-lg bg-white p-4">
            <QRCodeSVG
              value={TODO_APP_URL}
              size={192}
              level="M"
              marginSize={0}
              fgColor="#0a0a0a"
              bgColor="#ffffff"
              aria-label={`${TODO_APP_URL} 접속 QR 코드`}
            />
          </div>
        </div>

        {/* 터치 타깃 40px 이상(CLAUDE.md 화면 원칙). 주소 박스도 같은 높이로 정렬. */}
        <div className="flex items-center gap-2">
          <code className="flex h-10 min-w-0 flex-1 items-center truncate rounded-md bg-[var(--que-bg-muted)] px-3 text-xs text-[var(--que-text-secondary)]">
            {TODO_APP_URL}
          </code>
          <Button
            variant="outline"
            size="icon"
            className="size-10 shrink-0"
            onClick={copy}
            aria-label={copied ? "복사됨" : "주소 복사"}
          >
            {copied ? (
              <Check className="size-4 text-[var(--que-success)]" aria-hidden />
            ) : (
              <Copy className="size-4" aria-hidden />
            )}
          </Button>
          {/* anchor로 렌더 — 링크 시맨틱. base-ui에 네이티브 button이 아님을 알린다. */}
          <Button
            variant="outline"
            size="icon"
            className="size-10 shrink-0"
            nativeButton={false}
            render={<a href={TODO_APP_URL} target="_blank" rel="noopener noreferrer" />}
            aria-label="브라우저에서 열기"
          >
            <ExternalLink className="size-4" aria-hidden />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
