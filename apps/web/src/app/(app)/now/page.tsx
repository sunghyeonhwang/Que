import Link from "next/link";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { ACTION_ITEM_STATUS_LABELS } from "@que/core";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { buttonVariants } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/current-user";
import { getNowData, type NowFilter } from "@/lib/now-data";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

function parseFilter(value: string | undefined): NowFilter {
  return value === "mine" || value === "issue" ? value : "all";
}

const FILTERS: { key: NowFilter; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "mine", label: "내 항목" },
  { key: "issue", label: "문제" },
];

export default async function NowPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const params = await searchParams;
  const filter = parseFilter(params.filter);
  const user = await getCurrentUser();
  const now = new Date();
  const data = getNowData(user, filter, now);

  const metrics = [
    { value: data.summary.calendarCount, label: "오늘 캘린더 항목" },
    { value: data.summary.actionCount, label: "Action 후보" },
    { value: data.summary.issueHold, label: "문제/홀드" },
    { value: data.summary.dueToday, label: "오늘 마감" },
    { value: data.summary.missingAssignee, label: "담당자 확인 필요" },
  ];

  return (
    <div>
      <PageHeader
        title="Now 운영표"
        subtitle={`회의 Action과 캘린더 일정이 연결됐는지 확인하는 팀 운영표 · ${format(now, "M월 d일 (EEE)", { locale: ko })}`}
        actions={
          <Link href="/action" className={cn(buttonVariants(), "h-10")}>
            Action 확정하러 가기
          </Link>
        }
      />

      <section
        aria-label="Now 요약"
        className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5"
      >
        {metrics.map((metric) => (
          <Card key={metric.label} className="py-3">
            <CardContent className="px-4">
              <p className="text-2xl font-semibold tabular-nums">{metric.value}</p>
              <p className="text-xs text-muted-foreground">{metric.label}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <div className="mb-3 flex gap-2" aria-label="Now 필터">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={f.key === "all" ? "/now" : `/now?filter=${f.key}`}
            aria-current={filter === f.key ? "page" : undefined}
            className={cn(
              "flex h-10 items-center rounded-md border px-3 text-sm transition-colors",
              filter === f.key ? "bg-primary text-primary-foreground" : "hover:bg-accent",
            )}
          >
            {f.label}
          </Link>
        ))}
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table className="min-w-[720px]">
          <TableHeader className="sticky top-0 bg-background">
            <TableRow>
              <TableHead className="w-28">시간/마감</TableHead>
              <TableHead className="w-24">구분</TableHead>
              <TableHead>항목</TableHead>
              <TableHead className="w-24">담당자</TableHead>
              <TableHead className="w-32">상태</TableHead>
              <TableHead className="w-40">출처</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  표시할 항목이 없습니다.
                </TableCell>
              </TableRow>
            )}
            {data.rows.map((row) => (
              <TableRow key={row.key} className="min-h-12">
                <TableCell className="tabular-nums">
                  {row.at ? format(new Date(row.at), "HH:mm") : "—"}
                  {row.at && (
                    <span className="block text-xs text-muted-foreground">
                      {format(new Date(row.at), "M/d")}
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant={row.kind === "action" ? "outline" : "secondary"}>
                    {row.kind === "action" ? "Action" : "Calendar"}
                  </Badge>
                </TableCell>
                <TableCell className="max-w-64">
                  <span className="block truncate font-medium">{row.title}</span>
                </TableCell>
                <TableCell>
                  {row.assigneeName ?? (
                    <span className="text-destructive">미지정</span>
                  )}
                </TableCell>
                <TableCell>
                  {row.taskStatus && <StatusBadge status={row.taskStatus} />}
                  {row.actionStatus && (
                    <Badge variant={row.actionStatus === "needs_review" ? "destructive" : "secondary"}>
                      {ACTION_ITEM_STATUS_LABELS[row.actionStatus]}
                    </Badge>
                  )}
                  {row.eventLabel && <Badge variant="outline">{row.eventLabel}</Badge>}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">{row.source}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
