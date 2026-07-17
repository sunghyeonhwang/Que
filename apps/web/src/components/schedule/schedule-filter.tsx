"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SlidersHorizontal } from "lucide-react";
import type { Task } from "@que/core";
import type { ScheduleKind } from "@/lib/calendar-data";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel } from "@/components/ui/field";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ScheduleMember } from "./create-schedule-dialog";

const ANY = "__any__";
const PRIORITY_ITEMS: Record<string, string> = {
  [ANY]: "전체",
  high: "높음",
  normal: "보통",
  low: "낮음",
};
const PRIORITY_ORDER: (Task["priority"] | typeof ANY)[] = [ANY, "high", "normal", "low"];

// 일정 종류 4키(표시 토글). 서버 filterScheduleItems·page 파싱과 키 계약을 맞춘다
// (task·meeting·external·milestone). **타입**은 calendar-data의 ScheduleKind로 단일화한다(type import=번들 0).
// 반면 **상수 배열**(SCHEDULE_KINDS)은 값 import 시 calendar-data → getDb(서버 DB 모듈)까지
// 클라 번들로 끌려오므로 여기 로컬로 유지한다(순서·라벨 로컬 소유).
const KIND_ORDER: ScheduleKind[] = ["task", "meeting", "external", "milestone"];
const KIND_LABELS: Record<ScheduleKind, string> = {
  task: "작업",
  meeting: "회의",
  external: "외부 캘린더",
  milestone: "마일스톤",
};

/** 콤마 구분 파라미터를 화이트리스트로 걸러 배열로. */
function parseCsv(value: string | null, valid: (v: string) => boolean): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((s) => s.trim())
    .filter((v) => v.length > 0 && valid(v));
}

/** 담당자·표시 필터 기억 쿠키(JSON {owner?, hide?}, 1년). 우선순위·키워드는 일회성 탐색이라 기억 안 함. */
const FILTERS_COOKIE = "que_schedule_filters";
const FILTERS_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1년

/**
 * ?priority · ?q · ?owner · ?hide 로 서버 필터를 세팅/해제하는 팝오버.
 * range/date는 pushParams로 보존한다. 담당자·표시 종류는 신규(2026-07-15).
 * 담당자·표시의 현재 적용값(뱃지·폼 초기값)은 URL이 아니라 prop(appliedOwner·appliedHide)에서 읽는다
 * — 쿠키 폴백까지 반영된 최종값이라야 폴백 시에도 뱃지가 켜진다. 우선순위·키워드는 URL 그대로.
 */
export function ScheduleFilter({
  members,
  currentUserId,
  appliedOwner,
  appliedHide,
}: {
  members: ScheduleMember[];
  currentUserId: string;
  appliedOwner?: string;
  appliedHide?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const memberIds = new Set(members.map((m) => m.id));
  const kindKeys = new Set<string>(KIND_ORDER);

  const urlPriority = searchParams.get("priority") ?? "";
  const urlKeyword = searchParams.get("q") ?? "";
  // 담당자·표시는 prop(최종 적용값) 기준 — 쿠키 폴백 시에도 뱃지·폼이 켜지게.
  const urlOwners = parseCsv(appliedOwner ?? null, (v) => memberIds.has(v));
  const urlHide = parseCsv(appliedHide ?? null, (v) => kindKeys.has(v)) as ScheduleKind[];
  const activeCount =
    (urlPriority ? 1 : 0) +
    (urlKeyword.trim() ? 1 : 0) +
    (urlOwners.length > 0 ? 1 : 0) +
    (urlHide.length > 0 ? 1 : 0);

  const [open, setOpen] = useState(false);
  const [priority, setPriority] = useState<string>(urlPriority || ANY);
  const [keyword, setKeyword] = useState(urlKeyword);
  const [owners, setOwners] = useState<Set<string>>(new Set(urlOwners));
  // hidden = 표시 토글에서 해제된 종류(체크 해제 = 숨김).
  const [hidden, setHidden] = useState<Set<ScheduleKind>>(new Set(urlHide));

  // 팝오버를 열 때 URL의 현재 필터로 폼을 동기화한다(effect 대신 오픈 핸들러에서 — 캐스케이드 렌더 회피).
  const onOpenChange = (next: boolean) => {
    if (next) {
      setPriority(urlPriority || ANY);
      setKeyword(urlKeyword);
      setOwners(new Set(urlOwners));
      setHidden(new Set(urlHide));
    }
    setOpen(next);
  };

  const pushParams = (mutate: (p: URLSearchParams) => void) => {
    const params = new URLSearchParams(searchParams.toString());
    mutate(params);
    router.push(`/schedule?${params.toString()}`);
  };

  // 담당자·표시만 쿠키에 기억한다. 둘 다 비면 쿠키를 지운다(max-age=0).
  const writeFiltersCookie = (owner: string, hide: string) => {
    if (!owner && !hide) {
      document.cookie = `${FILTERS_COOKIE}=; path=/; max-age=0; samesite=lax`;
      return;
    }
    const payload: { owner?: string; hide?: string } = {};
    if (owner) payload.owner = owner;
    if (hide) payload.hide = hide;
    document.cookie = `${FILTERS_COOKIE}=${encodeURIComponent(
      JSON.stringify(payload),
    )}; path=/; max-age=${FILTERS_COOKIE_MAX_AGE}; samesite=lax`;
  };

  // 표시 종류 토글 — 체크 해제 시 hidden에 추가(숨김), 체크 시 제거(표시).
  const toggleKind = (kind: ScheduleKind, show: boolean) => {
    setHidden((prev) => {
      const next = new Set(prev);
      if (show) next.delete(kind);
      else next.add(kind);
      return next;
    });
  };

  // 담당자 개별 토글.
  const toggleOwner = (id: string, on: boolean) => {
    setOwners((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const apply = () => {
    // 담당자: 선택된 id만 콤마로. 없으면 전체.
    const ownerCsv = [...owners].filter((id) => memberIds.has(id)).join(",");
    // 표시: 숨긴 종류만 콤마로. 없으면 전부 표시.
    const hideCsv = KIND_ORDER.filter((k) => hidden.has(k)).join(",");
    pushParams((p) => {
      if (priority && priority !== ANY) p.set("priority", priority);
      else p.delete("priority");
      const kw = keyword.trim();
      if (kw) p.set("q", kw);
      else p.delete("q");
      if (ownerCsv) p.set("owner", ownerCsv);
      else p.delete("owner");
      if (hideCsv) p.set("hide", hideCsv);
      else p.delete("hide");
    });
    // 담당자·표시만 기억(우선순위·키워드 제외).
    writeFiltersCookie(ownerCsv, hideCsv);
    setOpen(false);
  };

  const reset = () => {
    setPriority(ANY);
    setKeyword("");
    setOwners(new Set());
    setHidden(new Set());
    pushParams((p) => {
      p.delete("priority");
      p.delete("q");
      p.delete("owner");
      p.delete("hide");
    });
    // 기억된 담당자·표시 필터도 함께 삭제.
    writeFiltersCookie("", "");
    setOpen(false);
  };

  const nothingSet =
    priority === ANY && !keyword.trim() && owners.size === 0 && hidden.size === 0;

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            aria-label={activeCount > 0 ? `필터 (${activeCount}개 적용됨)` : "필터"}
            className="relative size-10 rounded-lg border-[var(--que-border)] p-0"
          />
        }
      >
        <SlidersHorizontal className="size-4" aria-hidden />
        {activeCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 flex size-4 items-center justify-center rounded-full bg-[var(--que-brand)] text-[10px] font-semibold text-[var(--que-on-brand)] tabular-nums">
            {activeCount}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="flex max-h-[min(32rem,80vh)] w-80 flex-col gap-0 p-0">
        <div className="shrink-0 border-b border-[var(--que-border)] px-3.5 py-3">
          <p className="text-sm font-semibold text-[var(--que-text)]">필터</p>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-3.5">
          {/* 표시 — 일정 종류 4종 개별 on/off(기본 전부 표시). */}
          <Field>
            <FieldLabel>표시</FieldLabel>
            <div className="flex flex-col gap-0.5">
              {KIND_ORDER.map((kind) => (
                <label
                  key={kind}
                  className="flex min-h-10 cursor-pointer items-center gap-2.5 rounded-md px-1.5 text-sm text-[var(--que-text)] hover:bg-[var(--que-bg-muted)]"
                >
                  <Checkbox
                    checked={!hidden.has(kind)}
                    onCheckedChange={(v) => toggleKind(kind, v === true)}
                  />
                  {KIND_LABELS[kind]}
                </label>
              ))}
            </div>
          </Field>

          {/* 담당자 — 멤버별 다중선택(기본 전체). 상단 빠른 버튼 2개. */}
          <Field>
            <FieldLabel>담당자</FieldLabel>
            <div className="flex gap-1.5">
              <Button
                type="button"
                variant="outline"
                className="h-9 flex-1 border-[var(--que-border)] px-2 text-xs font-medium"
                aria-pressed={owners.size === 0}
                onClick={() => setOwners(new Set())}
              >
                전체
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-9 flex-1 border-[var(--que-border)] px-2 text-xs font-medium"
                aria-pressed={owners.size === 1 && owners.has(currentUserId)}
                onClick={() => setOwners(new Set([currentUserId]))}
              >
                내 것만
              </Button>
            </div>
            <div className="mt-1 flex max-h-56 flex-col gap-0.5 overflow-y-auto">
              {members.map((m) => (
                <label
                  key={m.id}
                  className="flex min-h-10 cursor-pointer items-center gap-2.5 rounded-md px-1.5 text-sm text-[var(--que-text)] hover:bg-[var(--que-bg-muted)]"
                >
                  <Checkbox
                    checked={owners.has(m.id)}
                    onCheckedChange={(v) => toggleOwner(m.id, v === true)}
                  />
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: m.avatarColor }}
                    aria-hidden
                  />
                  <span className="truncate">{m.name}</span>
                </label>
              ))}
            </div>
          </Field>

          {/* 우선순위 — 기존 유지. */}
          <Field>
            <FieldLabel>우선순위</FieldLabel>
            <Select
              items={PRIORITY_ITEMS}
              value={priority}
              onValueChange={(v) => setPriority((v as string) ?? ANY)}
            >
              <SelectTrigger aria-label="우선순위 선택" className="h-10 min-h-10 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRIORITY_ORDER.map((p) => (
                  <SelectItem key={p} value={p}>
                    {PRIORITY_ITEMS[p]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-[var(--que-text-tertiary)]">
              작업 우선순위 기준입니다. 켜면 우선순위가 없는 일정(미팅)은 제외됩니다.
            </p>
          </Field>

          {/* 키워드 — 기존 유지. */}
          <Field>
            <FieldLabel htmlFor="filter-keyword">키워드</FieldLabel>
            <Input
              id="filter-keyword"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") apply();
              }}
              placeholder="제목으로 검색"
              className="h-10"
            />
          </Field>
        </div>

        <div className="flex shrink-0 items-center justify-between gap-2 border-t border-[var(--que-border)] p-2.5">
          <Button
            variant="ghost"
            className="h-10"
            onClick={reset}
            disabled={activeCount === 0 && nothingSet}
          >
            초기화
          </Button>
          <Button
            className="h-10 bg-[var(--que-brand)] px-4 text-[var(--que-on-brand)] hover:bg-[var(--que-brand-hover)]"
            onClick={apply}
          >
            적용
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
