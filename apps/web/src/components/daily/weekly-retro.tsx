import Link from "next/link";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { WeeklyRetroData } from "@/lib/weekly-retro-data";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

// 주간 회고(명세 D) — 조회 전용 프레젠테이션. 한 주(월~금) 스탠드업을 되돌아본다.
// 운영 도구 톤: 표·칩 우선, 장식 없음. 데이터·주 이동은 서버(page.tsx)에서 결정해 내려준다.

/** YYYY-MM-DD → "7월 15일 (화)". 경계 흔들림 방지로 정오 파싱. */
function fmtDay(key: string): string {
  return format(new Date(`${key}T12:00:00`), "M월 d일 (EEE)", { locale: ko });
}

const NAV_BTN =
  "inline-flex h-10 min-w-10 items-center justify-center gap-1 rounded-lg border px-2 text-sm font-medium";

export function WeeklyRetro({
  data,
  prevHref,
  nextHref,
  isCurrentWeek,
}: {
  data: WeeklyRetroData;
  /** 이전 주 링크(하한 없음). */
  prevHref: string;
  /** 다음 주 링크 — 미래 주면 undefined(이동 불가). */
  nextHref?: string;
  /** 지금이 이번 주면 "이번 주" 버튼을 비활성 표시. */
  isCurrentWeek: boolean;
}) {
  const hasAny = data.days.some((d) => d.submitted > 0);
  // focus 날짜 → 요일 라벨(사람별 포커스 목록에 요일 프리픽스로 쓴다).
  const labelByDate = new Map(data.days.map((d) => [d.date, d.label]));

  return (
    <div className="flex flex-col gap-5">
      {/* 주 이동 */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Link
            href={prevHref}
            aria-label="이전 주"
            className={cn(NAV_BTN, "hover:bg-muted")}
          >
            <ChevronLeft className="size-4" aria-hidden />
          </Link>
          <h2 className="text-base font-semibold tabular-nums">{data.weekLabel}</h2>
          {nextHref ? (
            <Link
              href={nextHref}
              aria-label="다음 주"
              className={cn(NAV_BTN, "hover:bg-muted")}
            >
              <ChevronRight className="size-4" aria-hidden />
            </Link>
          ) : (
            <span
              aria-disabled
              aria-label="다음 주 없음"
              className={cn(NAV_BTN, "cursor-not-allowed text-muted-foreground opacity-50")}
            >
              <ChevronRight className="size-4" aria-hidden />
            </span>
          )}
        </div>
        {isCurrentWeek ? (
          <span
            aria-current="page"
            className={cn(NAV_BTN, "cursor-default bg-muted text-muted-foreground")}
          >
            이번 주
          </span>
        ) : (
          <Link href="/daily?tab=retro" className={cn(NAV_BTN, "hover:bg-muted")}>
            이번 주
          </Link>
        )}
      </div>

      {!hasAny ? (
        <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          이번 주에는 제출된 체크인이 없습니다.
        </div>
      ) : (
        <>
          {/* ⑴ 일자별 제출 현황 */}
          <section aria-label="일자별 제출 현황" className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold text-muted-foreground">일자별 제출</h3>
            <div className="grid grid-cols-5 gap-2">
              {data.days.map((d) => (
                <div
                  key={d.date}
                  className="flex flex-col items-center gap-1 rounded-lg border bg-card p-2"
                >
                  <span className="text-xs text-muted-foreground">{d.label}</span>
                  <span className="text-base font-semibold tabular-nums">
                    {d.submitted}
                    <span className="text-sm font-normal text-muted-foreground">/{d.total}</span>
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* ⑵ 사람별 요약 */}
          <section aria-label="사람별 요약" className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold text-muted-foreground">사람별 요약</h3>
            <div className="overflow-hidden rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-32">이름</TableHead>
                    <TableHead>이번 주 포커스</TableHead>
                    <TableHead className="w-20 text-right">완료</TableHead>
                    <TableHead className="w-24 text-right">제출</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.people.map((p) => (
                    <TableRow key={p.userId} className={cn(p.isMe && "bg-muted/40")}>
                      <TableCell className="align-top">
                        <span className="flex items-center gap-1.5">
                          <span
                            className="size-2.5 shrink-0 rounded-full"
                            style={{ backgroundColor: p.avatarColor }}
                            aria-hidden
                          />
                          <span className="truncate font-medium">{p.userName}</span>
                          {p.isMe && (
                            <Badge variant="outline" className="shrink-0">
                              나
                            </Badge>
                          )}
                        </span>
                      </TableCell>
                      <TableCell className="align-top">
                        {p.focuses.length === 0 ? (
                          <span className="text-sm text-muted-foreground">—</span>
                        ) : (
                          <ul className="flex flex-col gap-1">
                            {p.focuses.map((f) => (
                              <li key={f.date} className="text-sm">
                                <span className="mr-1.5 text-xs tabular-nums text-muted-foreground">
                                  {labelByDate.get(f.date) ?? ""}
                                </span>
                                {f.focus}
                              </li>
                            ))}
                          </ul>
                        )}
                      </TableCell>
                      <TableCell className="text-right align-top tabular-nums">
                        {p.doneCount}
                      </TableCell>
                      <TableCell className="text-right align-top tabular-nums text-muted-foreground">
                        {p.submittedDays}/5
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </section>

          {/* ⑶ 막힘 목록 */}
          <section aria-label="이번 주 막힘" className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold text-muted-foreground">막힘</h3>
            {data.blockers.length === 0 ? (
              <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                이번 주에 기록된 막힘이 없습니다.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {data.blockers.map((b, i) => (
                  <li
                    key={`${b.userId}-${b.text}-${i}`}
                    className="rounded-lg border border-destructive/30 bg-destructive/5 p-3"
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                      <p className="text-sm text-foreground">
                        <span className="font-medium">{b.userName}</span>
                        <span className="mx-1.5 text-muted-foreground">·</span>
                        {b.text}
                      </p>
                      <span className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="tabular-nums">
                          마지막 언급 {fmtDay(b.lastMentionedDate)}
                        </span>
                        {b.unmentionedSince && (
                          <Badge variant="outline" className="shrink-0">
                            이후 언급 없음
                          </Badge>
                        )}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* ⑷ 그 주 AI 팀 요약(일자별 아코디언) */}
          <section aria-label="AI 팀 요약" className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold text-muted-foreground">AI 팀 요약</h3>
            {data.summaries.length === 0 ? (
              <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                이번 주에 생성된 AI 팀 요약이 없습니다.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {data.summaries.map((s) => (
                  <details key={s.date} className="group rounded-lg border bg-card">
                    <summary className="flex h-11 cursor-pointer list-none items-center justify-between gap-2 px-3 text-sm font-medium">
                      <span className="tabular-nums">{fmtDay(s.date)}</span>
                      <span className="flex items-center gap-2">
                        <Badge variant="secondary" className="shrink-0 uppercase">
                          {s.model}
                        </Badge>
                        <ChevronRight
                          className="size-4 text-muted-foreground transition-transform group-open:rotate-90"
                          aria-hidden
                        />
                      </span>
                    </summary>
                    <div className="whitespace-pre-wrap border-t px-3 py-2.5 text-sm text-muted-foreground">
                      {s.content}
                    </div>
                  </details>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
