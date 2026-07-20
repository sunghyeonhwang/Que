"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  CircleHelp,
  Eye,
  Upload,
  XCircle,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ToneBadge, type BadgeTone } from "@/components/app/tone-badge";
import { cn } from "@/lib/utils";
import {
  executeScheduleImportAction,
  previewScheduleImportAction,
} from "@/app/(app)/import/actions";
import type {
  ImportPlan,
  ImportPlanEvent,
  ImportPlanMilestone,
  ImportPlanTask,
  ImportResult,
} from "@/lib/schedule-import";

// 일정 임포트 작업대 — 입력 → 미리보기(dry-run) → 확인 → 등록.
// 계획/실행 모두 서버 액션이 원본 YAML로 재수립하므로 여기선 텍스트만 보내고 결과를 그린다.
// 상태 색상 의미 고정(CLAUDE.md): green=완료, blue=예정/정보, amber=주의, red=문제, violet=응답대기.

const PLACEHOLDER = `# data/docs/que-import-template.md 양식을 채운 YAML을 붙여넣으세요
project:
  name: "예: acme-web 리뉴얼"
milestones:
  - title: "1차 런칭"
    due: "2026-08-15"
tasks:
  - title: "디자인 QA"
    assignee: "황성현"
    due: "2026-08-10"
events:
  - title: "킥오프 회의"
    date: "2026-07-28"
    start_time: "10:00"
    end_time: "11:00"`;

const KST = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** ISO(오프셋 포함) → KST 벽시계 "MM/DD HH:mm". 빈값/무효면 "—". */
function fmtDateTime(iso: string | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const p = Object.fromEntries(KST.formatToParts(d).map((x) => [x.type, x.value]));
  return `${p.month}/${p.day} ${p.hour}:${p.minute}`;
}

const STATUS_META: Record<ImportPlanTask["status"], { label: string; tone: BadgeTone }> = {
  scheduled: { label: "예정", tone: "blue" },
  in_progress: { label: "진행중", tone: "green" },
  done: { label: "완료", tone: "green" },
};

const PRIORITY_LABEL: Record<ImportPlanTask["priority"], string> = {
  high: "높음",
  normal: "보통",
  low: "낮음",
};

export function ImportWorkbench() {
  const [yamlText, setYamlText] = useState("");
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [mode, setMode] = useState<"preview" | "execute" | null>(null);
  const [pending, startTransition] = useTransition();

  const totalToCreate = useMemo(() => {
    if (!plan) return 0;
    const c = plan.counts;
    return c.clients + c.projects + c.milestones + c.tasks + c.events;
  }, [plan]);

  const canExecute = !!plan && plan.errors.length === 0 && totalToCreate > 0;

  const onChangeText = (value: string) => {
    setYamlText(value);
    // 입력이 바뀌면 이전 계획/결과는 무효 — 다시 미리보기해야 한다.
    if (plan) setPlan(null);
    if (result) setResult(null);
  };

  const runPreview = () => {
    setMode("preview");
    startTransition(async () => {
      const res = await previewScheduleImportAction(yamlText);
      if (res.ok) {
        setPlan(res.plan);
        setResult(null);
      } else {
        setPlan(null);
        toast.error(res.error);
      }
      setMode(null);
    });
  };

  const runExecute = () => {
    setMode("execute");
    startTransition(async () => {
      const res = await executeScheduleImportAction(yamlText);
      if (res.ok) {
        setResult(res.result);
        toast.success("일정을 등록했습니다.");
      } else {
        // 실패 시 미리보기는 유지하고 토스트로만 알린다.
        toast.error(res.error);
      }
      setMode(null);
    });
  };

  const reset = () => {
    setYamlText("");
    setPlan(null);
    setResult(null);
  };

  // ---- 등록 완료 결과 화면 ----
  if (result) {
    const { created, skipped } = result;
    const skippedTotal = skipped.milestones + skipped.tasks + skipped.events;
    return (
      <div className="flex max-w-2xl flex-col gap-4">
        <div className="rounded-xl border border-[var(--que-success)]/40 bg-[var(--que-success-bg)] p-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-5 text-[var(--que-success)]" aria-hidden />
            <h2 className="text-base font-semibold text-[var(--que-text)]">등록을 완료했습니다</h2>
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-3">
            <ResultStat label="클라이언트" value={created.clients} />
            <ResultStat label="프로젝트" value={created.projects} />
            <ResultStat label="마일스톤" value={created.milestones} />
            <ResultStat label="작업" value={created.tasks} />
            <ResultStat label="회의" value={created.events} />
          </dl>
          {skippedTotal > 0 && (
            <p className="mt-3 text-sm text-[var(--que-text-secondary)]">
              이미 있어 건너뛴 항목: 마일스톤 {skipped.milestones} · 작업 {skipped.tasks} · 회의{" "}
              {skipped.events}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link href="/projects" className={cn(buttonVariants(), "h-10")}>
            프로젝트 보기
            <ArrowRight className="size-4" aria-hidden />
          </Link>
          <Link href="/schedule" className={cn(buttonVariants({ variant: "outline" }), "h-10")}>
            일정 보기
            <ArrowRight className="size-4" aria-hidden />
          </Link>
          <Button variant="ghost" className="h-10" onClick={reset}>
            새 임포트
          </Button>
        </div>
      </div>
    );
  }

  // ---- 입력 + 미리보기 화면 ----
  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-2">
        <label htmlFor="import-yaml" className="text-sm font-semibold text-[var(--que-text)]">
          임포트 양식(YAML)
        </label>
        <Textarea
          id="import-yaml"
          value={yamlText}
          onChange={(e) => onChangeText(e.target.value)}
          placeholder={PLACEHOLDER}
          spellCheck={false}
          disabled={pending}
          className="min-h-72 resize-y font-mono text-xs leading-relaxed"
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button
            className="h-10"
            onClick={runPreview}
            disabled={!yamlText.trim() || pending}
          >
            <Eye className="size-4" aria-hidden />
            {pending && mode === "preview" ? "확인 중…" : "미리보기"}
          </Button>
          {plan && (
            <span className="text-sm text-[var(--que-text-tertiary)]">
              양식을 수정하면 다시 미리보기해야 합니다.
            </span>
          )}
        </div>
      </section>

      {plan && <PreviewPanel plan={plan} />}

      {plan && (
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--que-border)] bg-[var(--que-bg)] p-4 shadow-[var(--que-shadow-sm)]">
          <p className="text-sm text-[var(--que-text-secondary)]">
            <span className="font-medium text-[var(--que-text)]">생성될 항목:</span> 프로젝트{" "}
            {plan.counts.projects} · 마일스톤 {plan.counts.milestones} · 작업 {plan.counts.tasks} ·
            회의 {plan.counts.events}
            {plan.counts.clients > 0 && ` · 클라이언트 ${plan.counts.clients}`}
          </p>
          <Button
            className="h-10 bg-[var(--que-brand)] text-white hover:bg-[var(--que-brand-hover)]"
            onClick={runExecute}
            disabled={!canExecute || pending}
          >
            <Upload className="size-4" aria-hidden />
            {pending && mode === "execute" ? "등록 중…" : `${totalToCreate}건 등록`}
          </Button>
        </section>
      )}
    </div>
  );
}

function ResultStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <dt className="text-[var(--que-text-secondary)]">{label}</dt>
      <dd className="font-semibold tabular-nums text-[var(--que-text)]">{value}</dd>
    </div>
  );
}

function PreviewPanel({ plan }: { plan: ImportPlan }) {
  const hasErrors = plan.errors.length > 0;
  return (
    <div className="flex flex-col gap-4">
      {/* 차단 오류 — 있으면 등록 불가 */}
      {hasErrors && (
        <MessageList
          tone="red"
          icon={<XCircle className="size-4" aria-hidden />}
          title="등록하려면 먼저 해결하세요"
          items={plan.errors}
        />
      )}

      {/* 질문 — 응답대기(violet). 등록은 가능하나 확인 권장 */}
      {plan.questions.length > 0 && (
        <MessageList
          tone="violet"
          icon={<CircleHelp className="size-4" aria-hidden />}
          title="사람이 정해야 할 질문 — 등록은 가능하지만 확인 권장"
          items={plan.questions}
        />
      )}

      {/* 경고 — 주의(amber) */}
      {plan.warnings.length > 0 && (
        <MessageList
          tone="amber"
          icon={<AlertTriangle className="size-4" aria-hidden />}
          title="주의"
          items={plan.warnings}
        />
      )}

      {/* 클라이언트 · 프로젝트 카드 */}
      <div className="grid gap-3 sm:grid-cols-2">
        <EntityCard
          heading="클라이언트"
          name={plan.client.name ?? "클라이언트 없음 (사내)"}
          willCreate={plan.client.willCreate}
          muted={plan.client.name === null}
        />
        <EntityCard
          heading="프로젝트"
          name={plan.project.name || "—"}
          willCreate={plan.project.willCreate}
        />
      </div>

      {plan.milestones.length > 0 && <MilestoneTable rows={plan.milestones} />}
      {plan.tasks.length > 0 && <TaskTable rows={plan.tasks} />}
      {plan.events.length > 0 && <EventTable rows={plan.events} />}
    </div>
  );
}

function MessageList({
  tone,
  icon,
  title,
  items,
}: {
  tone: "red" | "amber" | "violet";
  icon: React.ReactNode;
  title: string;
  items: string[];
}) {
  const color =
    tone === "red"
      ? "var(--que-error)"
      : tone === "amber"
        ? "var(--que-warning)"
        : "var(--que-violet)";
  const bg =
    tone === "red"
      ? "var(--que-error-bg)"
      : tone === "amber"
        ? "var(--que-warning-bg)"
        : "var(--que-violet-bg)";
  return (
    <div
      role={tone === "red" ? "alert" : undefined}
      className="rounded-xl border p-4"
      style={{ borderColor: `color-mix(in oklch, ${color} 35%, transparent)`, background: bg }}
    >
      <div className="flex items-center gap-2" style={{ color }}>
        {icon}
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      <ul className="mt-2 flex list-disc flex-col gap-1 pl-6 text-sm text-[var(--que-text-secondary)]">
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function EntityCard({
  heading,
  name,
  willCreate,
  muted,
}: {
  heading: string;
  name: string;
  willCreate: boolean;
  muted?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--que-border)] bg-[var(--que-bg)] p-3 shadow-[var(--que-shadow-sm)]">
      <div className="min-w-0">
        <p className="text-xs text-[var(--que-text-tertiary)]">{heading}</p>
        <p
          className={
            muted
              ? "truncate text-sm font-medium text-[var(--que-text-secondary)]"
              : "truncate text-sm font-semibold text-[var(--que-text)]"
          }
        >
          {name}
        </p>
      </div>
      {willCreate ? (
        <ToneBadge tone="blue">새로 생성</ToneBadge>
      ) : (
        <ToneBadge tone="neutral">{muted ? "해당 없음" : "기존 연결"}</ToneBadge>
      )}
    </div>
  );
}

/** 목록이 길 때만(8행↑) 내부 스크롤 + sticky 헤더. 짧으면 그대로 흐른다. */
function TableShell({
  caption,
  count,
  head,
  children,
}: {
  caption: string;
  count: number;
  head: React.ReactNode;
  children: React.ReactNode;
}) {
  const scroll = count > 8;
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold text-[var(--que-text)]">
        {caption} <span className="font-normal text-[var(--que-text-tertiary)]">({count})</span>
      </h3>
      <div
        className={`rounded-xl border border-[var(--que-border)] ${
          scroll ? "max-h-80 overflow-auto" : "overflow-x-auto"
        }`}
      >
        <table className="w-full min-w-[560px] text-sm">
          <thead className="sticky top-0 z-10 bg-[var(--que-bg-muted)]">{head}</thead>
          <tbody>{children}</tbody>
        </table>
      </div>
    </section>
  );
}

const TH = "px-3 py-2 text-left font-medium text-[var(--que-text-secondary)] whitespace-nowrap";
const TD = "px-3 py-2 align-middle text-[var(--que-text)]";

function DuplicateBadge() {
  return <ToneBadge tone="neutral">중복 — 건너뜀</ToneBadge>;
}

function MilestoneTable({ rows }: { rows: ImportPlanMilestone[] }) {
  return (
    <TableShell
      caption="마일스톤"
      count={rows.length}
      head={
        <tr className="border-b border-[var(--que-border)] text-xs">
          <th className={TH}>제목</th>
          <th className={TH}>기한</th>
          <th className={TH}>상태</th>
        </tr>
      }
    >
      {rows.map((m, i) => (
        <tr
          key={i}
          className={`border-b border-[var(--que-border)] last:border-b-0 ${
            m.duplicate ? "opacity-50" : ""
          }`}
        >
          <td className={`${TD} max-w-[280px]`}>
            <span className="flex items-center gap-1.5 font-medium">
              <span className="truncate">{m.title}</span>
              {m.critical && <ToneBadge tone="amber">중요</ToneBadge>}
            </span>
          </td>
          <td className={`${TD} tabular-nums whitespace-nowrap text-[var(--que-text-secondary)]`}>
            {fmtDateTime(m.dueAt)}
          </td>
          <td className={TD}>{m.duplicate ? <DuplicateBadge /> : <ToneBadge tone="blue">생성 예정</ToneBadge>}</td>
        </tr>
      ))}
    </TableShell>
  );
}

function TaskTable({ rows }: { rows: ImportPlanTask[] }) {
  return (
    <TableShell
      caption="작업"
      count={rows.length}
      head={
        <tr className="border-b border-[var(--que-border)] text-xs">
          <th className={TH}>제목</th>
          <th className={TH}>기간</th>
          <th className={TH}>담당</th>
          <th className={TH}>우선순위</th>
          <th className={TH}>상태</th>
        </tr>
      }
    >
      {rows.map((t, i) => {
        const status = STATUS_META[t.status];
        return (
          <tr
            key={i}
            className={`border-b border-[var(--que-border)] last:border-b-0 ${
              t.duplicate ? "opacity-50" : ""
            }`}
          >
            <td className={`${TD} max-w-[240px]`}>
              <span className="block truncate font-medium">{t.title}</span>
              {t.dependsOn.length > 0 && (
                <span className="text-xs text-[var(--que-text-tertiary)]">
                  선행: {t.dependsOn.join(", ")}
                </span>
              )}
            </td>
            <td className={`${TD} tabular-nums whitespace-nowrap text-[var(--que-text-secondary)]`}>
              {fmtDateTime(t.startAt)} → {fmtDateTime(t.endAt)}
            </td>
            <td className={`${TD} whitespace-nowrap`}>
              {t.assignee ?? (
                <span className="text-[var(--que-text-tertiary)]">미지정(등록자)</span>
              )}
            </td>
            <td className={`${TD} whitespace-nowrap text-[var(--que-text-secondary)]`}>
              {PRIORITY_LABEL[t.priority]}
            </td>
            <td className={TD}>
              {t.duplicate ? <DuplicateBadge /> : <ToneBadge tone={status.tone}>{status.label}</ToneBadge>}
            </td>
          </tr>
        );
      })}
    </TableShell>
  );
}

function EventTable({ rows }: { rows: ImportPlanEvent[] }) {
  return (
    <TableShell
      caption="회의"
      count={rows.length}
      head={
        <tr className="border-b border-[var(--que-border)] text-xs">
          <th className={TH}>제목</th>
          <th className={TH}>일시</th>
          <th className={TH}>참석자</th>
          <th className={TH}>상태</th>
        </tr>
      }
    >
      {rows.map((e, i) => (
        <tr
          key={i}
          className={`border-b border-[var(--que-border)] last:border-b-0 ${
            e.duplicate ? "opacity-50" : ""
          }`}
        >
          <td className={`${TD} max-w-[240px]`}>
            <span className="block truncate font-medium">{e.title}</span>
          </td>
          <td className={`${TD} tabular-nums whitespace-nowrap text-[var(--que-text-secondary)]`}>
            {e.date} {e.startTime}–{e.endTime}
          </td>
          <td className={`${TD} max-w-[200px] truncate text-[var(--que-text-secondary)]`}>
            {e.attendees.length > 0 ? e.attendees.join(", ") : "—"}
          </td>
          <td className={TD}>{e.duplicate ? <DuplicateBadge /> : <ToneBadge tone="blue">생성 예정</ToneBadge>}</td>
        </tr>
      ))}
    </TableShell>
  );
}
