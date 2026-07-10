"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  CHECK_IN_RESPONSE_LABELS,
  type CheckInResponse,
  type StatusDetail,
} from "@que/core";
import { answerCheckInAction } from "@/app/(app)/today/actions";
import { Button } from "@/components/ui/button";
import { StatusDetailForm } from "./status-detail-form";
import { useSafeAction } from "./use-safe-action";

const CHOICES: CheckInResponse[] = [
  "working",
  "done",
  "needs_reschedule",
  "issue",
  "not_needed",
  "merged",
  "later",
];

/** 자동 체크인 응답 패널. 문제발생 선택 시 사유 입력 폼이 열린다. */
export function CheckInPanel({
  checkInId,
  question,
  variant = "stack",
}: {
  checkInId: string;
  question: string;
  /** stack=/today 기본(질문·안내·버튼 세로). row=홈 리스트형(질문+버튼 한 줄 — Figma 계약). */
  variant?: "stack" | "row";
}) {
  const { run, pending } = useSafeAction();
  const [issueOpen, setIssueOpen] = useState(false);
  const [laterOpen, setLaterOpen] = useState(false);

  const respond = (response: CheckInResponse, detail?: StatusDetail) => {
    run(() => answerCheckInAction({ checkInId, response, detail }), {
      success: `상태 응답 완료: ${CHECK_IN_RESPONSE_LABELS[response]}`,
      onSuccess: () => setIssueOpen(false),
    });
  };

  // '나중에' 스누즈 — 계산한 시각을 UTC ISO로 보낸다(서버가 new Date로 파싱, tz 모호성 없음).
  const snooze = (at: Date, message: string) => {
    run(() => answerCheckInAction({ checkInId, response: "later", snoozeUntil: at.toISOString() }), {
      success: message,
      onSuccess: () => setLaterOpen(false),
    });
  };

  const choose = (choice: CheckInResponse) => {
    if (pending) return;
    if (choice === "issue") {
      setIssueOpen((open) => !open);
    } else if (choice === "later") {
      // 즉시 제출하지 않고 스누즈 프리셋 토글을 편다(issueOpen 인라인 토글과 같은 패턴).
      setLaterOpen((open) => !open);
    } else if (choice === "merged") {
      // 병합은 대상 작업 선택이 필요 — 타임라인의 작업 상세에서 처리하도록 안내
      toast.info("병합은 타임라인에서 작업을 열어 대상 작업을 선택해 처리해주세요.");
    } else {
      respond(choice);
    }
  };

  // 숫자키 1~7 = 응답 버튼. 패널에 포커스가 있을 때만 동작(오늘 화면에 패널이 여럿일 수 있어
  // 전역 키는 어느 패널인지 모호). 사유 입력 중(input/textarea)엔 무시한다.
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    // 사유 폼·스누즈 프리셋이 열려 있으면 숫자키 무시 — 폼의 버튼/Select에 포커스가 있을 때
    // 숫자를 누르면 작성 중이던 사유가 유실되고 오응답이 나간다(입력칸 밖 포커스도 가드).
    if (issueOpen || laterOpen) return;
    const target = e.target as HTMLElement;
    if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) {
      return;
    }
    const idx = Number(e.key) - 1;
    if (!Number.isInteger(idx) || idx < 0 || idx >= CHOICES.length) return;
    e.preventDefault();
    choose(CHOICES[idx]);
  };

  const row = variant === "row";
  return (
    <div
      className="flex flex-col gap-3 rounded-md focus-within:outline-2 focus-within:outline-offset-4 focus-within:outline-ring"
      tabIndex={0}
      onKeyDown={onKeyDown}
      aria-label="작업 상태 확인 응답 (숫자키 1–7로 빠르게 응답)"
    >
      {/* row: 질문(좌)과 버튼(우)을 한 줄에 — 홈 리스트형(Figma). 좁은 화면에선 wrap. */}
      <div className={row ? "flex flex-wrap items-center gap-x-4 gap-y-2" : "contents"}>
        <p className={row ? "min-w-0 flex-1 text-sm font-medium" : "text-sm font-medium"}>
          {question}
        </p>
        {!row && (
          <p className="text-xs text-muted-foreground">
            응답하면 팀 현황판과 프로젝트 화면에 즉시 반영됩니다. 숫자키 1–7로도 응답할 수 있어요.
          </p>
        )}
        <div
          className={row ? "flex shrink-0 flex-wrap gap-1.5" : "flex flex-wrap gap-2"}
          role="group"
          aria-label="작업 상태 응답 선택"
        >
          {CHOICES.map((choice, i) => (
            <Button
              key={choice}
              variant={choice === "issue" ? "destructive" : "outline"}
              size="sm"
              className="h-10 gap-1.5"
              disabled={pending}
              aria-expanded={choice === "later" ? laterOpen : undefined}
              onClick={() => choose(choice)}
            >
              <span
                aria-hidden
                className="grid size-4 place-items-center rounded bg-black/5 text-[10px] font-semibold tabular-nums text-muted-foreground dark:bg-white/10"
              >
                {i + 1}
              </span>
              {CHECK_IN_RESPONSE_LABELS[choice]}
            </Button>
          ))}
        </div>
      </div>
      {issueOpen && (
        <div className="rounded-md border p-3">
          <StatusDetailForm
            submitLabel="문제발생으로 응답"
            pending={pending}
            onSubmit={(detail) => respond("issue", detail)}
          />
        </div>
      )}
      {laterOpen && (
        <SnoozePresets pending={pending} onPick={snooze} />
      )}
    </div>
  );
}

/** '나중에' 스누즈 프리셋 4개. 시각은 클릭 시점에 로컬 tz 기준으로 계산하고,
 *  이미 지난 프리셋(예: 지금이 15시면 오늘 오후 2시)은 비활성화한다(서버가 과거를 거부).
 *  현재 시각은 마운트 후 effect로 잡는다(렌더 중 Date.now 호출 금지 — react-hooks/purity). */
function SnoozePresets({
  pending,
  onPick,
}: {
  pending: boolean;
  onPick: (at: Date, message: string) => void;
}) {
  // 현재 시각은 마운트 후 microtask에서 잡는다 — 렌더 중 Date.now 호출(purity)과
  // effect 본문 동기 setState(set-state-in-effect)를 모두 피하는 레포 표준(async 콜백 setState).
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (active) setNow(Date.now());
    });
    return () => {
      active = false;
    };
  }, []);

  const todayAfternoonPast = (() => {
    if (now === null) return false; // now 미확정 시엔 활성(마운트 직후 effect가 즉시 보정)
    const d = new Date(now);
    d.setHours(14, 0, 0, 0);
    return d.getTime() <= now;
  })();

  const presets: { label: string; message: string; getAt: () => Date; past: boolean }[] = [
    {
      label: "30분 뒤",
      message: "30분 뒤에 다시 물어볼게요.",
      getAt: () => new Date(Date.now() + 30 * 60000),
      past: false,
    },
    {
      label: "1시간 뒤",
      message: "1시간 뒤에 다시 물어볼게요.",
      getAt: () => new Date(Date.now() + 60 * 60000),
      past: false,
    },
    {
      label: "오늘 오후 2시",
      message: "오늘 오후 2시에 다시 물어볼게요.",
      getAt: () => {
        const d = new Date();
        d.setHours(14, 0, 0, 0);
        return d;
      },
      past: todayAfternoonPast,
    },
    {
      label: "내일 오전 9시",
      message: "내일 오전 9시에 다시 물어볼게요.",
      getAt: () => {
        const d = new Date();
        d.setDate(d.getDate() + 1);
        d.setHours(9, 0, 0, 0);
        return d;
      },
      past: false,
    },
  ];

  return (
    <div className="rounded-md border p-3">
      <p className="mb-2 text-sm font-medium">언제 다시 물어볼까요?</p>
      <div className="flex flex-wrap gap-2" role="group" aria-label="다시 물어볼 시각 선택">
        {presets.map((preset) => (
          <Button
            key={preset.label}
            variant="outline"
            size="sm"
            className="h-10"
            disabled={pending || preset.past}
            onClick={() => onPick(preset.getAt(), preset.message)}
          >
            {preset.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
