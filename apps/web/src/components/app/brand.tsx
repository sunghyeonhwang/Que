import Link from "next/link";

/** GRIFF 로고. compact=아이콘만(logo-mark), 그 외=아이콘+워드마크(logo-full). 상단바/사이드바 공용.
 *  로고 SVG는 단색 검정이라 다크모드에선 dark:invert로 흰색 반전(라이트=검정·다크=흰). */
export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link
      href="/home"
      aria-label="GRIFF 홈"
      className="flex items-center rounded-lg focus-visible:outline-2 focus-visible:outline-[var(--que-brand)]"
    >
      {compact ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src="/logo-mark.svg" alt="GRIFF" className="h-8 w-auto dark:invert" />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src="/logo-full.svg" alt="GRIFF" className="h-[26px] w-auto dark:invert" />
      )}
    </Link>
  );
}
