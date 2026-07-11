import Link from "next/link";
import { ShieldAlert } from "lucide-react";

// 로그인은 했지만 관리자·대표(role=admin)가 아닌 사용자를 위한 안내 화면.
// 통합 간트는 회의실 화면 용도라 관리자·대표로 접근을 제한한다(일반 팀원은 que 간트로 충분).
export function GanttDenied({ name }: { name: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
      <ShieldAlert className="size-12 text-[var(--que-text-tertiary)]" aria-hidden />
      <div className="flex flex-col gap-1.5">
        <p className="text-lg font-semibold text-[var(--que-text)]">접근 권한이 없습니다</p>
        <p className="max-w-md text-sm text-[var(--que-text-secondary)]">
          통합 간트는 관리자·대표만 볼 수 있는 회의용 화면입니다. {name}님의 작업과 일정은 Que
          기본 화면에서 확인하세요.
        </p>
      </div>
      <Link
        href="/home"
        className="flex h-10 items-center rounded-lg border border-[var(--que-border)] bg-[var(--que-bg)] px-4 text-sm font-medium text-[var(--que-text)] transition-colors hover:bg-[var(--que-bg-muted)]"
      >
        Que 홈으로
      </Link>
    </div>
  );
}
