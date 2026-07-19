// 공개 현황판(view) 전용 표현 헬퍼. 데이터가 아니라 순수 포매팅/색 계산만 담는다.
// - 담당자 색(avatarColor, #rrggbb)에서 카드 틴트/텍스트 색을 파생한다.
// - 시간 라벨은 KST(서버 TZ 고정) 기준으로 en-US "h:mm AM/PM" 형식.

const WEEKDAY_FULL_KR = ["일", "월", "화", "수", "목", "금", "토"] as const;

/** 아바타 이니셜: 한글 이름은 뒤 2글자, 그 외는 앞 2글자를 대문자로. */
export function avatarInitials(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length <= 2) return trimmed;
  // 한글(가-힣) 포함이면 뒤 2글자(성 제외한 이름 느낌), 아니면 앞 2글자.
  if (/[가-힣]/.test(trimmed)) return trimmed.slice(-2);
  return trimmed.slice(0, 2).toUpperCase();
}

/** #rrggbb + 2자리 알파 → #rrggbbaa. 카드 배경 틴트 등에 쓴다. */
export function withAlpha(hex: string, alpha2: string): string {
  const base = hex.length === 7 ? hex : "#666666";
  return `${base}${alpha2}`;
}

/** "2026년 7월 5일" */
export function formatKoreanDate(d: Date): string {
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
}

/** "일요일" */
export function formatKoreanWeekday(d: Date): string {
  return `${WEEKDAY_FULL_KR[d.getDay()]}요일`;
}

/** "월"·"화" 등 짧은 요일 한 글자. */
export function shortWeekdayKR(d: Date): string {
  return WEEKDAY_FULL_KR[d.getDay()];
}

/**
 * 대형 디스플레이 비례 스케일 헬퍼.
 * 벽/대형 태블릿(2420·2994·3540px 가로)에서 타이포·간격·카드가 비례해 커지도록
 * base + min-[...] 임의 브레이크포인트를 한 문자열로 묶는다. 각 호출은 "한 속성"만
 * 담당(예: text 크기 하나)해서 tailwind-merge 충돌을 피한다.
 */
export function scale(base: string, s2420: string, s2994: string, s3540: string): string {
  // 각 인자는 여러 클래스를 가질 수 있으므로 클래스마다 브레이크포인트 접두사를 붙인다
  // (전체 문자열에 한 번만 붙이면 첫 클래스만 프리픽스되고 나머지는 base로 새는 버그).
  const pre = (bp: number, cls: string): string =>
    cls
      .split(/\s+/)
      .filter(Boolean)
      .map((c) => `min-[${bp}px]:${c}`)
      .join(" ");
  return `${base} ${pre(2420, s2420)} ${pre(2994, s2994)} ${pre(3540, s3540)}`;
}

/** 마일스톤 riskStatus → 상태 점 색 클래스. late=red, at_risk=amber, on_track=green(상태색 의미 고정). */
export function milestoneRiskDot(risk: "on_track" | "at_risk" | "late"): string {
  if (risk === "late") return "bg-red-500";
  if (risk === "at_risk") return "bg-amber-500";
  return "bg-green-500";
}

/** 마일스톤 riskStatus → 강조 텍스트 색. late=red, at_risk=amber, on_track=중립. */
export function milestoneRiskText(risk: "on_track" | "at_risk" | "late"): string {
  if (risk === "late") return "text-red-600";
  if (risk === "at_risk") return "text-amber-600";
  return "text-neutral-700";
}

/** D-day 라벨. 0=D-DAY, 양수=D-n. */
export function ddayLabel(dday: number): string {
  return dday === 0 ? "D-DAY" : `D-${dday}`;
}

const timeFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Seoul",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

/** "2:00 PM" (KST) */
export function formatClockTime(iso: string): string {
  return timeFmt.format(new Date(iso));
}

/** "2:00 PM - 3:30 PM" 또는 단일 시각 "5:30 PM". */
export function formatTimeRange(startAt: string, endAt?: string): string {
  const start = formatClockTime(startAt);
  if (!endAt || endAt === startAt) return start;
  return `${start} - ${formatClockTime(endAt)}`;
}

/** KST 기준 자정으로부터의 분(주간 그리드 배치용). 서버 TZ가 Asia/Seoul로 고정돼 있다. */
export function minutesOfDayKST(iso: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(iso));
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return hour * 60 + minute;
}
