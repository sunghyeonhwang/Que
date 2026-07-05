"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Building2, ChevronDown } from "lucide-react";
import { CLIENT_FILTER_COOKIE } from "@/lib/client-filter-cookie";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1년
/** 드롭다운 라디오에서 "전체 클라이언트"를 나타내는 sentinel(빈 clientId). */
const ALL = "__all__";

/**
 * 상단 클라이언트 전환 필터(조회 전용, 전원 사용 · 권한 무관).
 * - 선택은 쿠키(CLIENT_FILTER_COOKIE)에 저장되고, 서버 각 화면이 읽어 필터한다.
 * - 사용자 전환(UserSwitcher, 우측 아바타)과 달리 좌측 아이콘 버튼(Building2)으로 시각·의미 구분.
 * - clients가 비면 렌더하지 않는다.
 */
export function ClientSwitcher({
  clients,
  current,
}: {
  clients: { id: string; name: string }[];
  current?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (clients.length === 0) return null;

  const active = current ? clients.find((c) => c.id === current) : undefined;
  const label = active ? active.name : "전체 클라이언트";
  const isFiltered = Boolean(active);

  const onSelect = (value: string) => {
    if (value === ALL) {
      // 전체 보기 = 쿠키 삭제(max-age=0).
      document.cookie = `${CLIENT_FILTER_COOKIE}=; path=/; max-age=0; samesite=lax`;
    } else {
      document.cookie = `${CLIENT_FILTER_COOKIE}=${value}; path=/; max-age=${COOKIE_MAX_AGE}; samesite=lax`;
    }
    startTransition(() => router.refresh());
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="outline"
            disabled={pending}
            aria-label={`클라이언트 필터: ${label}`}
            className={
              isFiltered
                ? "h-10 gap-2 rounded-lg border-[var(--que-brand)] bg-[var(--que-brand-subtle)] px-2.5 font-medium text-[var(--que-brand)] sm:px-3"
                : "h-10 gap-2 rounded-lg border-[var(--que-border)] px-2.5 font-medium text-[var(--que-text-secondary)] sm:px-3"
            }
          />
        }
      >
        <Building2 className="size-4 shrink-0" aria-hidden />
        {/* 넓은 화면: 선택명 표시(truncate). 좁은 화면(<sm): 아이콘만, 필터 시 점으로 표시. */}
        <span className="hidden max-w-[9rem] truncate sm:inline">{label}</span>
        {isFiltered ? (
          <span
            className="size-1.5 shrink-0 rounded-full bg-[var(--que-brand)] sm:hidden"
            aria-hidden
          />
        ) : null}
        <ChevronDown
          className="hidden size-4 shrink-0 text-[var(--que-text-tertiary)] sm:inline"
          aria-hidden
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-60">
        {/* Base UI Menu.GroupLabel은 반드시 Group/RadioGroup 안에 있어야 한다(Radix→Base UI 전환 회귀).
            라벨·구분선을 RadioGroup 밖에 두면 드롭다운 여는 순간 MenuGroupContext 부재로 throw한다. */}
        <DropdownMenuRadioGroup value={current ?? ALL} onValueChange={onSelect}>
          <DropdownMenuLabel>클라이언트 필터</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuRadioItem value={ALL} className="h-10">
            전체 클라이언트
          </DropdownMenuRadioItem>
          {clients.map((c) => (
            <DropdownMenuRadioItem key={c.id} value={c.id} className="h-10">
              <span className="truncate">{c.name}</span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
