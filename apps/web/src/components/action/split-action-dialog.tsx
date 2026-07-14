"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { splitActionItemAction } from "@/app/(app)/action/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const MAX_PARTS = 20;
const pad = (n: number) => String(n).padStart(2, "0");

// 세그먼트 고유 키(클라이언트 전용 카운터 — 삭제·재정렬 시 안정적 key).
let _uid = 0;
const uid = () => (_uid += 1);

interface Segment {
  id: number;
  title: string;
  date: string; // YYYY-MM-DD | ""
  time: string; // HH:mm | ""
}

/** 오늘의 KST 연도(연도 없는 날짜 표기의 기본값). */
function kstYear(): number {
  return Number(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Seoul",
      year: "numeric",
    }).format(new Date()),
  );
}

function toKey(y: number, m: number, d: number): string | null {
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  return `${y}-${pad(m)}-${pad(d)}`;
}

/** 조각에서 날짜 표기를 검출: YYYY-MM-DD → "M월 D일" → "M/D". 연도 없으면 현재 KST 연도. */
function detectDate(
  text: string,
  year: number,
): { key: string; index: number; length: number } | null {
  let m = /(\d{4})-(\d{1,2})-(\d{1,2})/.exec(text);
  if (m) {
    const key = toKey(Number(m[1]), Number(m[2]), Number(m[3]));
    if (key) return { key, index: m.index, length: m[0].length };
  }
  m = /(\d{1,2})\s*월\s*(\d{1,2})\s*일/.exec(text);
  if (m) {
    const key = toKey(year, Number(m[1]), Number(m[2]));
    if (key) return { key, index: m.index, length: m[0].length };
  }
  m = /(\d{1,2})\/(\d{1,2})/.exec(text);
  if (m) {
    const key = toKey(year, Number(m[1]), Number(m[2]));
    if (key) return { key, index: m.index, length: m[0].length };
  }
  return null;
}

function cleanTitle(s: string): string {
  return s
    .replace(/^[\s,，、·・:\-]+/, "")
    .replace(/[\s,，、·・:\-]+$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** 제목+원문에서 날짜별 세그먼트 초안 생성. 날짜 2개 미만이면 [](빈 2행으로 폴백). */
function buildPrefill(title: string, sourceText: string): { title: string; date: string }[] {
  const text = sourceText && sourceText.trim() ? sourceText : title;
  const year = kstYear();
  // 콤마·가운뎃점·세미콜론·줄바꿈·문장경계로 조각낸다.
  const fragments = text
    .split(/[,，、·・;；\n]+|[.!?…]+/)
    .map((f) => f.trim())
    .filter(Boolean);
  const segs: { title: string; date: string }[] = [];
  for (const frag of fragments) {
    const d = detectDate(frag, year);
    if (!d) continue;
    // 날짜는 보통 항목명 앞에 온다("7월 16일 뉴스레터") → 날짜 뒤 텍스트를 제목으로.
    const after = cleanTitle(frag.slice(d.index + d.length));
    const before = cleanTitle(frag.slice(0, d.index));
    const t = after || before;
    if (t) segs.push({ title: t, date: d.key });
  }
  return segs.length >= 2 ? segs.slice(0, MAX_PARTS) : [];
}

function initialSegments(title: string, sourceText: string): Segment[] {
  const data = buildPrefill(title, sourceText);
  const base = data.length ? data : [{ title: "", date: "" }, { title: "", date: "" }];
  return base.map((d) => ({ id: uid(), title: d.title, date: d.date, time: "" }));
}

/** Action 후보 나누기 다이얼로그. open 시 SplitBody가 새로 마운트돼 프리필을 1회 계산한다. */
export function SplitActionDialog({
  open,
  onOpenChange,
  actionItemId,
  title,
  sourceText,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  actionItemId: string;
  title: string;
  sourceText: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {open && (
          <SplitBody
            actionItemId={actionItemId}
            title={title}
            sourceText={sourceText}
            onClose={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function SplitBody({
  actionItemId,
  title,
  sourceText,
  onClose,
}: {
  actionItemId: string;
  title: string;
  sourceText: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<Segment[]>(() =>
    initialSegments(title, sourceText),
  );
  const [pending, setPending] = useState(false);

  const update = (id: number, patch: Partial<Segment>) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const remove = (id: number) => setRows((rs) => rs.filter((r) => r.id !== id));
  const add = () =>
    setRows((rs) =>
      rs.length >= MAX_PARTS
        ? rs
        : [...rs, { id: uid(), title: "", date: "", time: "" }],
    );

  const canRun =
    rows.length >= 2 &&
    rows.length <= MAX_PARTS &&
    rows.every((r) => r.title.trim().length > 0);

  const submit = async () => {
    if (!canRun || pending) return;
    setPending(true);
    const parts = rows.map((r) => ({
      title: r.title.trim(),
      dueDate: r.date || undefined,
      dueTime: r.time || undefined,
    }));
    const result = await splitActionItemAction({ actionItemId, parts });
    setPending(false);
    if (result.ok) {
      toast.success(`${parts.length}건으로 나눴습니다`);
      onClose();
      router.refresh();
    } else {
      toast.error(result.error);
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>후보 나누기</DialogTitle>
      </DialogHeader>

      {/* 원문 */}
      <div className="rounded-lg border border-[var(--que-border)] bg-[var(--que-bg-muted)] px-3 py-2">
        <p className="text-[11px] font-medium text-[var(--que-text-tertiary)]">원문</p>
        <p className="mt-0.5 text-sm text-[var(--que-text-secondary)]">
          “{sourceText || title}”
        </p>
      </div>

      <p className="text-xs text-[var(--que-text-tertiary)]">
        각 항목이 별도 후보로 생성됩니다. 시각 미입력 시 17:00으로 마감됩니다.
      </p>

      {/* 세그먼트 목록 — 태블릿 세로 대비 내부 스크롤 */}
      <div className="flex max-h-[45vh] flex-col gap-2 overflow-y-auto">
        {rows.map((row, idx) => (
          <div key={row.id} className="flex items-center gap-2">
            <Input
              value={row.title}
              onChange={(e) => update(row.id, { title: e.target.value })}
              placeholder={`항목 ${idx + 1} 제목`}
              aria-label={`항목 ${idx + 1} 제목`}
              className="h-10 min-w-0 flex-1 rounded-lg text-sm"
            />
            <input
              type="date"
              value={row.date}
              onChange={(e) => update(row.id, { date: e.target.value })}
              aria-label={`항목 ${idx + 1} 마감일`}
              className="h-10 shrink-0 rounded-lg border border-[var(--que-border)] bg-transparent px-2 text-sm"
            />
            <input
              type="time"
              value={row.time}
              onChange={(e) => update(row.id, { time: e.target.value })}
              aria-label={`항목 ${idx + 1} 마감 시각`}
              className="hidden h-10 shrink-0 rounded-lg border border-[var(--que-border)] bg-transparent px-2 text-sm sm:block"
            />
            <Button
              type="button"
              variant="ghost"
              aria-label={`항목 ${idx + 1} 삭제`}
              className="size-10 shrink-0 rounded-lg p-0 text-[var(--que-text-tertiary)]"
              disabled={rows.length <= 1}
              onClick={() => remove(row.id)}
            >
              <Trash2 className="size-4" aria-hidden />
            </Button>
          </div>
        ))}
      </div>

      <Button
        type="button"
        variant="outline"
        className="h-10 justify-center gap-1.5 rounded-lg"
        disabled={rows.length >= MAX_PARTS}
        onClick={add}
      >
        <Plus className="size-4" aria-hidden />
        항목 추가
      </Button>

      <DialogFooter>
        <Button
          variant="outline"
          className="h-10 rounded-lg"
          disabled={pending}
          onClick={onClose}
        >
          취소
        </Button>
        <Button
          className="h-10 rounded-lg"
          disabled={!canRun || pending}
          onClick={() => void submit()}
        >
          {pending ? "나누는 중…" : `나누기 실행 (${rows.length})`}
        </Button>
      </DialogFooter>
    </>
  );
}
