"use client";

import { useState } from "react";
import { Plus, Target } from "lucide-react";
import type { OkrObjectiveView } from "@/lib/okr-data";
import { PeriodSelect } from "@/components/performance/period-select";
import { Button } from "@/components/ui/button";
import { ObjectiveCard } from "./objective-card";
import { CreateObjectiveDialog } from "./create-objective-dialog";

/** 소유자 Select·아바타 색 해석용 경량 멤버(직렬화 가능). */
export interface OkrMember {
  id: string;
  name: string;
  avatarColor: string;
}

/** 분기 라벨 — "2026-Q3" → "2026년 3분기". */
export function periodLabel(period: string): string {
  const m = /^(\d{4})-Q([1-4])$/.exec(period);
  if (!m) return period;
  return `${m[1]}년 ${m[2]}분기`;
}

/**
 * OKR 탭(기획 §4) — 분기 목표(Objective) + 월 핵심결과(KR) 트리.
 * 상단: 분기 선택(URL ?period=) + [목표 추가](admin). 본문: Objective 아코디언.
 * 회사 레벨 단일 계층이라 클라이언트 필터와 무관하게 전사를 본다. 권한은 서버가 계산해 내린다.
 */
export function OkrBoard({
  period,
  periods,
  objectives,
  canManageObjectives,
  members,
  currentMonth,
}: {
  period: string;
  periods: string[];
  objectives: OkrObjectiveView[];
  canManageObjectives: boolean;
  members: OkrMember[];
  currentMonth: string;
}) {
  const [createOpen, setCreateOpen] = useState(false);
  const memberById = new Map(members.map((m) => [m.id, m] as const));

  return (
    <section className="flex min-w-0 flex-col gap-4">
      {/* 교육형 설명 — 'OKR'을 처음 보는 팀원에게 개념을 안내(planning 탭 선례) */}
      <div className="rounded-xl border border-[var(--que-border)] bg-[var(--que-bg-muted)] p-4">
        <h2 className="flex items-center gap-2 text-base font-semibold text-[var(--que-text)]">
          <Target className="size-4 text-[var(--que-brand)]" aria-hidden />
          OKR이란
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-[var(--que-text-secondary)]">
          OKR은 <b className="font-medium text-[var(--que-text)]">분기 목표(Objective)</b>와 그
          목표를 이루기 위한 <b className="font-medium text-[var(--que-text)]">월 핵심결과(KR)</b>로
          구성됩니다. 목표는 &lsquo;무엇을 이룰 것인가&rsquo;를, 핵심결과는 &lsquo;그것을 어떻게
          측정할 것인가&rsquo;를 나타냅니다. 오늘 하는 작업을 핵심결과에 연결하면, 지금 하는 일이
          어떤 목표에 기여하는지 한눈에 드러납니다.
        </p>
      </div>

      {/* 상단 바 — 분기 선택 + 목표 추가(admin) */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-sm text-[var(--que-text-secondary)]">분기</span>
          <PeriodSelect
            param="period"
            value={period}
            ariaLabel="분기 선택"
            options={periods.map((p) => ({ value: p, label: periodLabel(p) }))}
          />
        </div>
        {canManageObjectives && (
          <Button
            className="h-10 gap-1.5 bg-[var(--que-brand)] text-[var(--que-on-brand)] hover:bg-[var(--que-brand-hover)]"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="size-4" aria-hidden />
            목표 추가
          </Button>
        )}
      </div>

      {objectives.length === 0 ? (
        <OkrEmptyState canManage={canManageObjectives} period={period} />
      ) : (
        <div className="flex flex-col gap-3">
          {objectives.map((o) => (
            <ObjectiveCard
              key={o.objective.id}
              view={o}
              members={members}
              memberById={memberById}
              currentMonth={currentMonth}
            />
          ))}
        </div>
      )}

      {canManageObjectives && (
        <CreateObjectiveDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          defaultPeriod={period}
          members={members}
        />
      )}
    </section>
  );
}

function OkrEmptyState({ canManage, period }: { canManage: boolean; period: string }) {
  return (
    <div className="rounded-xl border border-dashed border-[var(--que-border)] bg-[var(--que-bg)] py-10 text-center">
      <p className="text-sm font-medium text-[var(--que-text)]">
        {periodLabel(period)}에 등록된 목표가 없습니다.
      </p>
      <p className="mx-auto mt-1.5 max-w-md text-sm text-[var(--que-text-secondary)]">
        분기 목표(Objective)를 먼저 만들고, 그 안에 월 핵심결과(KR)를 추가하세요. 예를 들어
        &lsquo;여름 캠페인 성공&rsquo;이라는 목표 아래 &lsquo;7월 신규 가입 500건&rsquo; 같은
        핵심결과를 두는 방식입니다.
      </p>
      {canManage ? (
        <p className="mt-1.5 text-xs text-[var(--que-text-tertiary)]">
          오른쪽 위 <b className="font-medium text-[var(--que-text-secondary)]">목표 추가</b> 버튼으로
          시작할 수 있습니다.
        </p>
      ) : (
        <p className="mt-1.5 text-xs text-[var(--que-text-tertiary)]">
          목표는 관리자가 등록합니다.
        </p>
      )}
    </div>
  );
}
