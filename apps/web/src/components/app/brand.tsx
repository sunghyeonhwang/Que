import Link from "next/link";

/** GRIFF 로고 — Q 마크(gradient) + 워드마크. 상단바/사이드바 공용. */
export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link
      href="/home"
      aria-label="GRIFF 홈"
      className="flex items-center gap-2 rounded-lg focus-visible:outline-2 focus-visible:outline-[var(--que-brand)]"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/auth/logo.svg" alt="" className="size-[34px]" />
      {!compact && (
        <span className="text-[22px] font-semibold tracking-[0.02em] text-[var(--que-text)]">
          GRIFF
        </span>
      )}
    </Link>
  );
}
