"use client";

import { useState } from "react";
import { Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DEFAULT_VIEW_SETTINGS,
  VIEW_SECONDS_MAX,
  VIEW_SECONDS_MIN,
  loadViewSettings,
  normalizeSettings,
  saveViewSettings,
  type ViewSlideBoardMode,
  type ViewSlideScheduleRange,
} from "@/lib/view-settings";

// 현황판 슬라이드쇼 설정 다이얼로그(⚙).
// - 좌하단 재생 버튼 위에 기어 버튼을 띄운다(FAB·재생과 겹치지 않음).
// - 저장은 localStorage(기기별). rhf/zod 대신 로컬 상태 + normalizeSettings(clamp/enum)로 방어
//   — 무인증 공개 페이지의 소형 환경설정이라 과투자 없이 값 방어에 집중.
// - 저장 시 SlideshowController가 즉시 구독해 다음 스텝부터 반영한다.

const RANGE_OPTIONS: { value: ViewSlideScheduleRange; label: string }[] = [
  { value: "1day", label: "1Day" },
  { value: "3day", label: "3day" },
];

const BOARD_MODE_OPTIONS: { value: ViewSlideBoardMode; label: string }[] = [
  { value: "paged", label: "2명(순회)" },
  { value: "all", label: "전체 8명" },
];

export function ViewSettings() {
  const [open, setOpen] = useState(false);
  const [boardSeconds, setBoardSeconds] = useState(
    String(DEFAULT_VIEW_SETTINGS.boardSeconds),
  );
  const [scheduleSeconds, setScheduleSeconds] = useState(
    String(DEFAULT_VIEW_SETTINGS.scheduleSeconds),
  );
  const [scheduleRange, setScheduleRange] = useState<ViewSlideScheduleRange>(
    DEFAULT_VIEW_SETTINGS.scheduleRange,
  );
  const [boardMode, setBoardMode] = useState<ViewSlideBoardMode>(
    DEFAULT_VIEW_SETTINGS.boardMode,
  );
  const [includeBoard, setIncludeBoard] = useState(
    DEFAULT_VIEW_SETTINGS.includeBoard,
  );
  const [includeSchedule, setIncludeSchedule] = useState(
    DEFAULT_VIEW_SETTINGS.includeSchedule,
  );

  // 다이얼로그를 열 때 저장된 값으로 폼을 리셋한다(취소 후 재오픈 시 최신 반영).
  // effect가 아니라 open 전환 이벤트 핸들러에서 처리한다(cascading render 회피).
  const handleOpenChange = (next: boolean) => {
    if (next) {
      const s = loadViewSettings();
      setBoardSeconds(String(s.boardSeconds));
      setScheduleSeconds(String(s.scheduleSeconds));
      setScheduleRange(s.scheduleRange);
      setBoardMode(s.boardMode);
      setIncludeBoard(s.includeBoard);
      setIncludeSchedule(s.includeSchedule);
    }
    setOpen(next);
  };

  const bothOff = !includeBoard && !includeSchedule;

  const save = () => {
    if (bothOff) return; // 방어: 순회 대상이 없으면 저장하지 않는다.
    const next = normalizeSettings({
      boardSeconds: Number(boardSeconds),
      scheduleSeconds: Number(scheduleSeconds),
      scheduleRange,
      boardMode,
      includeBoard,
      includeSchedule,
    });
    saveViewSettings(next);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <button
            type="button"
            aria-label="현황판 설정"
            title="현황판 설정 (슬라이드쇼 타이밍·뷰)"
            // 재생 버튼(bottom-8 left-8, size-16) 바로 위. 겹치지 않게 코너 고정.
            className={cn(
              "absolute bottom-28 left-8 flex size-14 items-center justify-center rounded-full text-white shadow-lg transition-colors",
              "bg-neutral-900 hover:bg-neutral-700",
            )}
          />
        }
      >
        <Settings className="size-6" />
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>현황판 설정</DialogTitle>
          <DialogDescription>
            슬라이드쇼 타이밍과 뷰 방식을 설정합니다. 이 기기에만 저장됩니다.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5 py-1">
          {/* 표시 시간 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="view-board-seconds">보드 표시 시간(초)</Label>
              <Input
                id="view-board-seconds"
                type="number"
                inputMode="numeric"
                min={VIEW_SECONDS_MIN}
                max={VIEW_SECONDS_MAX}
                value={boardSeconds}
                onChange={(e) => setBoardSeconds(e.target.value)}
                className="h-11"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="view-schedule-seconds">스케줄 표시 시간(초)</Label>
              <Input
                id="view-schedule-seconds"
                type="number"
                inputMode="numeric"
                min={VIEW_SECONDS_MIN}
                max={VIEW_SECONDS_MAX}
                value={scheduleSeconds}
                onChange={(e) => setScheduleSeconds(e.target.value)}
                className="h-11"
              />
            </div>
          </div>
          <p className="-mt-3 text-xs text-muted-foreground">
            {VIEW_SECONDS_MIN}~{VIEW_SECONDS_MAX}초 범위로 저장됩니다.
          </p>

          {/* 스케줄 뷰 */}
          <Segmented
            label="슬라이드쇼 스케줄 뷰"
            value={scheduleRange}
            options={RANGE_OPTIONS}
            onChange={setScheduleRange}
          />

          {/* 보드 모드 */}
          <Segmented
            label="슬라이드쇼 보드 모드"
            value={boardMode}
            options={BOARD_MODE_OPTIONS}
            onChange={setBoardMode}
          />

          {/* 순회 포함 */}
          <div className="grid gap-2">
            <span className="text-sm font-medium">순회 포함</span>
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              <Label className="gap-2 py-1 font-normal">
                <Checkbox
                  checked={includeBoard}
                  onCheckedChange={(v) => setIncludeBoard(v === true)}
                />
                보드
              </Label>
              <Label className="gap-2 py-1 font-normal">
                <Checkbox
                  checked={includeSchedule}
                  onCheckedChange={(v) => setIncludeSchedule(v === true)}
                />
                스케줄
              </Label>
            </div>
            {bothOff ? (
              <p className="text-xs text-destructive">
                보드·스케줄 중 최소 하나는 포함해야 합니다.
              </p>
            ) : null}
          </div>
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>닫기</DialogClose>
          <Button onClick={save} disabled={bothOff}>
            저장
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// 세그먼트 토글(라디오 대체) — 큰 터치 대상. active=neutral-900.
function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="grid gap-2">
      <span className="text-sm font-medium">{label}</span>
      <div
        role="radiogroup"
        aria-label={label}
        className="flex items-center gap-1 rounded-full border border-input p-1"
      >
        {options.map((opt) => {
          const active = opt.value === value;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(opt.value)}
              className={cn(
                "flex min-h-10 flex-1 items-center justify-center rounded-full px-4 text-sm font-medium transition-colors",
                active
                  ? "bg-neutral-900 text-white"
                  : "text-neutral-600 hover:bg-neutral-100",
              )}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
