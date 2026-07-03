"use client";

import { useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getDragPayload, type DragPayload } from "./drag";
import { useMoveItem } from "./use-move";

/** 드롭 가능한 캘린더 셀. date(+hour)로 이동시킨다.
 *  restrictOwnerId가 있으면 다른 사람 행으로의 드롭을 막는다 (전체 멤버 뷰). */
export function DropCell({
  date,
  hour,
  restrictOwnerId,
  className,
  style,
  children,
  ariaLabel,
}: {
  date: string;
  hour?: number;
  restrictOwnerId?: string;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
  ariaLabel?: string;
}) {
  const { move } = useMoveItem();
  const [over, setOver] = useState(false);

  const accept = (payload: DragPayload): boolean => {
    if (restrictOwnerId && payload.ownerId && payload.ownerId !== restrictOwnerId) {
      toast.error("드래그로는 날짜만 바꿀 수 있습니다. 담당자 변경은 작업 상세에서 해주세요.");
      return false;
    }
    return true;
  };

  return (
    <div
      role="gridcell"
      aria-label={ariaLabel}
      style={style}
      className={cn(className, over && "bg-accent/70 outline-2 outline-ring")}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const payload = getDragPayload(e);
        if (!payload) return;
        if (!accept(payload)) return;
        move(payload, date, hour);
      }}
    >
      {children}
    </div>
  );
}
