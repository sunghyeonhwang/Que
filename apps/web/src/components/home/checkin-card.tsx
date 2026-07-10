import type { HomeCheckInItem } from "@/lib/home-grade-data";
import { HomeCard } from "@/components/home/home-card";
import { CheckInPanel } from "@/components/app/checkin-panel";

// Home/CheckIn — 사원 '작업 상태 확인'. 응답 대기 자동 체크인을 리스트형으로 나열한다(명세 §3).
// 응답 버튼(7종)·숫자키·문제발생 후속 입력은 CheckInPanel을 그대로 재사용한다.
// 0건이면 홈에서 렌더하지 않으므로(카드 자체 숨김) 여기서는 빈 상태를 다루지 않는다.

/** 작업 상태 확인 카드 — 행마다 프로젝트 맥락 + 질문 + 응답 버튼. */
export function CheckInCard({ items }: { items: HomeCheckInItem[] }) {
  return (
    <HomeCard title="작업 상태 확인" meta={String(items.length)}>
      <ul className="flex flex-col gap-2">
        {items.map((item) => (
          <li
            key={item.checkInId}
            className="rounded-lg border border-[var(--que-border)] px-3 py-2.5"
          >
            {/* 질문+버튼 한 줄(row variant — Figma 계약). */}
            {item.projectLabel && (
              <p className="mb-1 text-xs text-[var(--que-text-tertiary)]">{item.projectLabel}</p>
            )}
            <CheckInPanel checkInId={item.checkInId} question={item.question} variant="row" />
          </li>
        ))}
      </ul>
    </HomeCard>
  );
}
