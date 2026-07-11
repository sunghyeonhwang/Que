"use client";

import { useCallback, useEffect, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  CreditCard,
  FileText,
  HandHelping,
  ListChecks,
} from "lucide-react";
import { createMeetingMinutesAction } from "@/app/(app)/meeting-notes/actions";
import { MeetingCommand } from "@/components/daily/meeting-command";
import { MilestoneDecision } from "@/components/daily/milestone-decision";
import { Button, buttonVariants } from "@/components/ui/button";
import { reportError } from "@/lib/report-error";
import { cn } from "@/lib/utils";

// 주간 통합 회의 진행 모드(기획 §1·§1-f) — 5섹션 스텝퍼. URL ?step=1~5 구동(뒤로가기 자연).
// 큰 타이포(회의실 TV 가독). 진행 컨트롤(회의록 저장)은 admin만. 데이터는 서버(buildWeeklyAgenda 등)에서
// 받아 조회 렌더하고, 마일스톤 결정·신규 등록만 core mutation을 경유한다(신규 실행 경로 없음).

export interface AgendaMilestoneView {
  id: string;
  title: string;
  projectName: string;
  dueDateKey: string;
  risk: string;
  progress: number;
  doneCount: number;
  totalCount: number;
}

export interface MilestoneAgendaView extends AgendaMilestoneView {
  blockedCount: number;
  blockedTitles: string[];
  canManage: boolean;
}

export interface MeetingModeProps {
  date: string;
  isAdmin: boolean;
  lastWeek: {
    completed: number;
    cancelled: number;
    adherenceLabel: string;
    resolutionLabel: string;
    blockedNow: number;
  } | null;
  thisWeek: {
    range: { start: string; end: string };
    dueMilestones: AgendaMilestoneView[];
    overloadCount: number;
    cautionCount: number;
    loadTop: { name: string; ratio: number | null; openTasks: number }[];
  };
  milestoneAgenda: MilestoneAgendaView[];
  decisions: { kind: "action" | "payment" | "help"; label: string; detail: string }[];
  teamRound: {
    userId: string;
    name: string;
    recentFocus?: string;
    submittedToday: boolean;
    blockedCount: number;
  }[];
  todayDecisionCount: number;
}

const STEPS = [
  { n: 1, label: "지난주 요약" },
  { n: 2, label: "이번 주 조망" },
  { n: 3, label: "마일스톤 안건" },
  { n: 4, label: "결정 필요" },
  { n: 5, label: "팀 라운드" },
] as const;

/** 위험 라벨 → 의미색(green=정상, amber=주의, red=지연). */
function riskClass(risk: string): string {
  if (risk === "지연") return "bg-[var(--que-error-bg)] text-[var(--que-error)]";
  if (risk === "주의") return "bg-[var(--que-warning-bg)] text-[var(--que-warning)]";
  return "bg-[var(--que-success-bg)] text-[var(--que-success)]";
}

const DECISION_LINK: Record<string, { href: string; icon: typeof ListChecks }> = {
  action: { href: "/action", icon: ListChecks },
  payment: { href: "/payments", icon: CreditCard },
  help: { href: "/today", icon: HandHelping },
};

export function MeetingMode(props: MeetingModeProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const step = Math.min(5, Math.max(1, Number(searchParams.get("step")) || 1));
  const memberIdx = Math.min(
    Math.max(0, props.teamRound.length - 1),
    Math.max(0, Number(searchParams.get("member")) || 0),
  );

  const goStep = useCallback(
    (n: number, member?: number) => {
      const sp = new URLSearchParams(searchParams.toString());
      sp.set("step", String(n));
      if (n === 5) sp.set("member", String(member ?? 0));
      else sp.delete("member");
      router.push(`${pathname}?${sp.toString()}`);
    },
    [pathname, router, searchParams],
  );

  const goMember = useCallback(
    (idx: number) => {
      const clamped = Math.min(props.teamRound.length - 1, Math.max(0, idx));
      const sp = new URLSearchParams(searchParams.toString());
      sp.set("step", "5");
      sp.set("member", String(clamped));
      router.push(`${pathname}?${sp.toString()}`);
    },
    [pathname, router, searchParams, props.teamRound.length],
  );

  // ⑸ 팀 라운드에서 스페이스로 다음 사람 호명(입력 필드 포커스 중이 아닐 때만).
  useEffect(() => {
    if (step !== 5) return;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName)) return;
      if (e.code === "Space") {
        e.preventDefault();
        if (memberIdx < props.teamRound.length - 1) goMember(memberIdx + 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step, memberIdx, props.teamRound.length, goMember]);

  return (
    <div className="flex min-h-full flex-col gap-4">
      {/* 스텝퍼 */}
      <nav aria-label="회의 섹션" className="flex flex-wrap gap-2">
        {STEPS.map((s) => (
          <button
            key={s.n}
            type="button"
            aria-current={step === s.n ? "step" : undefined}
            onClick={() => goStep(s.n)}
            className={cn(
              "flex h-11 items-center gap-2 rounded-lg border px-3 text-sm font-medium transition-colors",
              step === s.n
                ? "border-[var(--que-brand)] bg-[var(--que-brand-subtle)] text-[var(--que-brand)]"
                : "border-[var(--que-border)] text-[var(--que-text-secondary)] hover:bg-[var(--que-bg-muted)]",
            )}
          >
            <span
              className={cn(
                "grid size-6 place-items-center rounded-full text-xs tabular-nums",
                step === s.n
                  ? "bg-[var(--que-brand)] text-[var(--que-on-brand)]"
                  : "bg-[var(--que-bg-muted)] text-[var(--que-text-tertiary)]",
              )}
            >
              {s.n}
            </span>
            <span className="hidden sm:inline">{s.label}</span>
          </button>
        ))}
      </nav>

      {/* 섹션 본체 — 큰 타이포 */}
      <div className="flex-1">
        {step === 1 && <LastWeekSection lastWeek={props.lastWeek} />}
        {step === 2 && <ThisWeekSection thisWeek={props.thisWeek} />}
        {step === 3 && <MilestoneAgendaSection items={props.milestoneAgenda} />}
        {step === 4 && <DecisionsSection decisions={props.decisions} />}
        {step === 5 && (
          <TeamRoundSection
            members={props.teamRound}
            idx={memberIdx}
            onPrev={() => goMember(memberIdx - 1)}
            onNext={() => goMember(memberIdx + 1)}
          />
        )}
      </div>

      {/* 섹션 이동 */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          className="h-11"
          disabled={step === 1}
          onClick={() => goStep(step - 1)}
        >
          <ArrowLeft className="size-4" aria-hidden />
          이전 섹션
        </Button>
        <Button
          variant="outline"
          className="h-11"
          disabled={step === 5}
          onClick={() => goStep(step + 1)}
        >
          다음 섹션
          <ArrowRight className="size-4" aria-hidden />
        </Button>
      </div>

      {/* LLM 액션 콘솔 — 회의 중 신규 등록 */}
      <MeetingCommand />

      {/* 하단 고정 바 — 오늘 결정 수 + 회의록 저장(admin) */}
      <BottomBar
        date={props.date}
        decisionCount={props.todayDecisionCount}
        isAdmin={props.isAdmin}
      />
    </div>
  );
}

/** ⑴ 지난주 요약 — KPI 카드. */
function LastWeekSection({ lastWeek }: { lastWeek: MeetingModeProps["lastWeek"] }) {
  if (!lastWeek) {
    return (
      <SectionShell title="지난주 요약">
        <p className="text-lg text-[var(--que-text-tertiary)]">집계 없음</p>
      </SectionShell>
    );
  }
  const kpis = [
    { label: "완료", value: String(lastWeek.completed), tone: "success" as const },
    { label: "기한 준수율", value: lastWeek.adherenceLabel, tone: "neutral" as const },
    { label: "병목 해소", value: lastWeek.resolutionLabel, tone: "neutral" as const },
    { label: "현재 막힘", value: String(lastWeek.blockedNow), tone: lastWeek.blockedNow > 0 ? ("error" as const) : ("neutral" as const) },
  ];
  return (
    <SectionShell title="지난주 요약">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-xl border border-[var(--que-border)] bg-[var(--que-bg)] p-5">
            <p className="text-sm text-[var(--que-text-tertiary)]">{k.label}</p>
            <p
              className={cn(
                "mt-1 text-4xl font-bold tabular-nums",
                k.tone === "success" && "text-[var(--que-success)]",
                k.tone === "error" && "text-[var(--que-error)]",
                k.tone === "neutral" && "text-[var(--que-text)]",
              )}
            >
              {k.value}
            </p>
          </div>
        ))}
      </div>
    </SectionShell>
  );
}

/** ⑵ 이번 주 조망 — 마감 마일스톤 + 부하 경고. */
function ThisWeekSection({ thisWeek }: { thisWeek: MeetingModeProps["thisWeek"] }) {
  return (
    <SectionShell
      title="이번 주 조망"
      subtitle={`${thisWeek.range.start} ~ ${thisWeek.range.end}`}
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <h3 className="mb-2 text-base font-semibold text-[var(--que-text)]">이번 주 마감 마일스톤</h3>
          {thisWeek.dueMilestones.length === 0 ? (
            <p className="text-[var(--que-text-tertiary)]">이번 주 마감 마일스톤이 없습니다.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {thisWeek.dueMilestones.map((m) => (
                <li
                  key={m.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-[var(--que-border)] bg-[var(--que-bg)] p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-base font-semibold text-[var(--que-text)]">{m.title}</p>
                    <p className="text-sm text-[var(--que-text-tertiary)]">
                      {m.projectName} · 마감 {m.dueDateKey}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-sm tabular-nums text-[var(--que-text-secondary)]">{m.progress}%</span>
                    <span className={cn("rounded-md px-2 py-0.5 text-xs font-semibold", riskClass(m.risk))}>
                      {m.risk}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <h3 className="mb-2 text-base font-semibold text-[var(--que-text)]">
            부하 경고
            <span className="ml-2 text-sm font-normal text-[var(--que-text-tertiary)]">
              과부하 {thisWeek.overloadCount} · 주의 {thisWeek.cautionCount}
            </span>
          </h3>
          <ul className="flex flex-col gap-2">
            {thisWeek.loadTop.map((r) => {
              const overload = (r.ratio ?? 0) > 100;
              const caution = !overload && (r.ratio ?? 0) >= 85;
              return (
                <li
                  key={r.name}
                  className={cn(
                    "flex items-center justify-between gap-3 rounded-lg border p-3",
                    overload
                      ? "border-[var(--que-error)]/40 bg-[var(--que-error-bg)]"
                      : caution
                        ? "border-[var(--que-warning)]/40 bg-[var(--que-warning-bg)]"
                        : "border-[var(--que-border)] bg-[var(--que-bg)]",
                  )}
                >
                  <span className="font-medium text-[var(--que-text)]">{r.name}</span>
                  <span className="flex items-center gap-3 text-sm tabular-nums text-[var(--que-text-secondary)]">
                    <span>진행 {r.openTasks}건</span>
                    <span
                      className={cn(
                        "text-lg font-bold",
                        overload && "text-[var(--que-error)]",
                        caution && "text-[var(--que-warning)]",
                      )}
                    >
                      {r.ratio == null ? "-" : `${r.ratio}%`}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </SectionShell>
  );
}

/** ⑶ 마일스톤 안건 — 결정 컨트롤. */
function MilestoneAgendaSection({ items }: { items: MilestoneAgendaView[] }) {
  return (
    <SectionShell title="마일스톤 안건">
      {items.length === 0 ? (
        <p className="text-[var(--que-text-tertiary)]">처리할 마일스톤 안건이 없습니다.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((m) => (
            <li key={m.id} className="rounded-xl border border-[var(--que-border)] bg-[var(--que-bg)] p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <p className="text-lg font-semibold text-[var(--que-text)]">
                  {m.title}
                  <span className="ml-2 text-sm font-normal text-[var(--que-text-tertiary)]">
                    {m.projectName}
                  </span>
                </p>
                <div className="flex items-center gap-2">
                  <span className="text-sm tabular-nums text-[var(--que-text-secondary)]">
                    마감 {m.dueDateKey} · {m.progress}% ({m.doneCount}/{m.totalCount})
                  </span>
                  <span className={cn("rounded-md px-2 py-0.5 text-xs font-semibold", riskClass(m.risk))}>
                    {m.risk}
                  </span>
                </div>
              </div>
              {m.blockedCount > 0 && (
                <p className="mt-1 text-sm text-[var(--que-error)]">
                  막힘 {m.blockedCount}건
                  {m.blockedTitles.length > 0 && ` — ${m.blockedTitles.join(", ")}`}
                </p>
              )}
              <div className="mt-3">
                <MilestoneDecision milestoneId={m.id} canManage={m.canManage} holdLabel="주의로" />
              </div>
            </li>
          ))}
        </ul>
      )}
    </SectionShell>
  );
}

/** ⑷ 결정 필요 — 미배정 Action·결제 대기·미응답 도움 요청 + 딥링크. */
function DecisionsSection({ decisions }: { decisions: MeetingModeProps["decisions"] }) {
  return (
    <SectionShell title="결정 필요">
      {decisions.length === 0 ? (
        <p className="text-[var(--que-text-tertiary)]">결정을 기다리는 안건이 없습니다.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {decisions.map((d, i) => {
            const link = DECISION_LINK[d.kind];
            const Icon = link.icon;
            return (
              <li
                key={`${d.kind}-${i}`}
                className="flex items-center justify-between gap-3 rounded-lg border border-[var(--que-border)] bg-[var(--que-bg)] p-3"
              >
                <div className="min-w-0">
                  <span className="rounded-md bg-[var(--que-bg-muted)] px-2 py-0.5 text-xs font-medium text-[var(--que-text-secondary)]">
                    {d.label}
                  </span>
                  <p className="mt-1 text-base text-[var(--que-text)]">{d.detail}</p>
                </div>
                <Link
                  href={link.href}
                  className={cn(buttonVariants({ variant: "outline" }), "h-10 shrink-0")}
                >
                  <Icon className="size-4" aria-hidden />
                  처리
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </SectionShell>
  );
}

/** ⑸ 팀 라운드 — 한 사람씩 크게. 스페이스/버튼으로 다음. */
function TeamRoundSection({
  members,
  idx,
  onPrev,
  onNext,
}: {
  members: MeetingModeProps["teamRound"];
  idx: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  if (members.length === 0) {
    return (
      <SectionShell title="팀 라운드">
        <p className="text-[var(--que-text-tertiary)]">호명할 팀원이 없습니다.</p>
      </SectionShell>
    );
  }
  const m = members[idx];
  return (
    <SectionShell title="팀 라운드" subtitle={`막힘 있는 사람 우선 · ${idx + 1}/${members.length}`}>
      <div className="rounded-2xl border border-[var(--que-border)] bg-[var(--que-bg)] p-6">
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-3xl font-bold text-[var(--que-text)]">{m.name}</p>
          {m.blockedCount > 0 && (
            <span className="rounded-md bg-[var(--que-error-bg)] px-2 py-1 text-sm font-semibold text-[var(--que-error)]">
              막힘 {m.blockedCount}건
            </span>
          )}
          {!m.submittedToday && (
            <span className="rounded-md bg-[var(--que-warning-bg)] px-2 py-1 text-sm font-semibold text-[var(--que-warning)]">
              오늘 미제출
            </span>
          )}
        </div>
        <div className="mt-4">
          <p className="text-sm text-[var(--que-text-tertiary)]">최근 스탠드업 포커스</p>
          <p className="mt-1 text-2xl leading-snug text-[var(--que-text)]">
            {m.recentFocus ?? "기록 없음 — 오늘 한마디를 받아 주세요."}
          </p>
        </div>
        <p className="mt-4 text-sm text-[var(--que-text-tertiary)]">
          체크인 입력은 데일리 화면에서 진행합니다.{" "}
          <Link href="/daily" className="font-medium text-[var(--que-brand)] underline-offset-2 hover:underline">
            데일리로 이동
          </Link>
        </p>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <Button variant="outline" className="h-11" disabled={idx === 0} onClick={onPrev}>
          <ArrowLeft className="size-4" aria-hidden />
          이전 사람
        </Button>
        <span className="text-sm text-[var(--que-text-tertiary)]">스페이스로 다음 사람 호명</span>
        <Button className="h-11" disabled={idx >= members.length - 1} onClick={onNext}>
          다음 사람
          <ArrowRight className="size-4" aria-hidden />
        </Button>
      </div>
    </SectionShell>
  );
}

function SectionShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-label={title}>
      <div className="mb-4">
        <h2 className="text-2xl font-bold tracking-tight text-[var(--que-text)]">{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-[var(--que-text-tertiary)]">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

function BottomBar({
  date,
  decisionCount,
  isAdmin,
}: {
  date: string;
  decisionCount: number;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const save = () => {
    startTransition(async () => {
      try {
        const result = await createMeetingMinutesAction("weekly");
        if (result.ok) {
          toast.success("주간 회의록 초안이 저장됐습니다.", {
            action: { label: "회의록 열기", onClick: () => router.push("/meeting-notes") },
          });
          router.refresh();
        } else {
          toast.error(result.error);
        }
      } catch (error) {
        reportError(error, { source: "server-action" });
        toast.error("회의록 저장 중 오류가 발생했습니다.");
      }
    });
  };

  return (
    <div className="sticky bottom-0 -mx-4 -mb-4 flex items-center justify-between gap-3 border-t border-[var(--que-border)] bg-[var(--que-bg)] px-4 py-3 md:-mx-5 md:-mb-5 md:px-5 xl:-mx-6 xl:-mb-6 xl:px-6">
      <p className="text-sm text-[var(--que-text-secondary)]">
        {date} · 오늘 결정 <span className="font-semibold tabular-nums text-[var(--que-text)]">{decisionCount}</span>건
      </p>
      {isAdmin && (
        <Button className="h-11" disabled={pending} onClick={save}>
          <FileText className="size-4" aria-hidden />
          {pending ? "저장 중…" : "회의록 저장"}
        </Button>
      )}
    </div>
  );
}
