// 회의록 markdown 본문에서 "회의 일시"를 규칙 기반으로 추출한다 (배치4 항목 13).
// 결과는 저장되지 않는다 — 업로드 폼의 기본값을 채우는 용도이며, 사용자가 폼에서 보고
// 수정할 수 있으므로 확인 카드 규칙과 무관하다(자동 등록이 아니라 기본값 제안).
//
// 지원 형식(우선순위: "일시/날짜" 라벨 줄 → 문서 상단 첫 날짜):
//   날짜 — 2026-07-06, 2026.07.06, 2026/07/06, 2026년 7월 6일, 7월 6일
//   시간 — 14:00, 오후 2시, 오후 2시 30분, 오후 2시 반, 14시
// 시간을 못 찾으면 hasTime=false로 두고 기본 시각(10:00)을 채운다(서버 dateOnly 기본과 동일).

export interface MeetingDateTimeDraft {
  /** datetime-local 폼 기본값 형식 YYYY-MM-DDTHH:mm — 그대로 input value에 쓴다 */
  dateTime: string;
  /** 본문에서 실제 시각까지 찾았는지 (false면 기본 시각 10:00을 채운 것) */
  hasTime: boolean;
}

const pad = (n: number): string => String(n).padStart(2, "0");

/** 한 줄에서 날짜(연·월·일)를 추출. 연도가 없으면 now의 연도를 쓴다. */
function matchDate(line: string, now: Date): { year: number; month: number; day: number } | undefined {
  // 2026-07-06 / 2026.07.06 / 2026/07/06
  const iso = line.match(/(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})/);
  if (iso) {
    return { year: Number(iso[1]), month: Number(iso[2]), day: Number(iso[3]) };
  }
  // 2026년 7월 6일 / 7월 6일
  const ko = line.match(/(?:(\d{4})\s*년\s*)?(\d{1,2})\s*월\s*(\d{1,2})\s*일/);
  if (ko) {
    return { year: ko[1] ? Number(ko[1]) : now.getFullYear(), month: Number(ko[2]), day: Number(ko[3]) };
  }
  return undefined;
}

/** 한 줄에서 시각(시·분)을 추출. 24시간·오전/오후 표기를 모두 지원한다. */
function matchTime(line: string): { hour: number; minute: number } | undefined {
  // 14:00 (초는 무시)
  const hhmm = line.match(/(?<!\d)(\d{1,2}):(\d{2})(?::\d{2})?(?!\d)/);
  if (hhmm) {
    const hour = Number(hhmm[1]);
    const minute = Number(hhmm[2]);
    if (hour <= 23 && minute <= 59) return { hour, minute };
  }
  // 오후 2시 / 오후 2시 30분 / 오후 2시 반 / 14시
  const ko = line.match(/(오전|오후|아침|저녁|밤)?\s*(\d{1,2})\s*시\s*(반|(\d{1,2})\s*분)?/);
  if (ko) {
    let hour = Number(ko[2]);
    let minute = 0;
    if (ko[3] === "반") minute = 30;
    else if (ko[4]) minute = Number(ko[4]);
    const meridiem = ko[1] ?? "";
    if (/오후|저녁|밤/.test(meridiem) && hour < 12) hour += 12;
    if (hour <= 23 && minute <= 59) return { hour, minute };
  }
  return undefined;
}

// "일시/날짜/일자/시간" 라벨이 붙은 줄을 우선 신뢰한다(문서 안 다른 날짜 오탐 회피).
const LABEL_HINT = /일시|날짜|일자|회의\s*시간|meeting\s*date|date/i;

/**
 * 회의록 본문에서 회의 일시를 추출한다. 못 찾으면 undefined(폼은 기존 기본값 유지).
 * @param markdown 회의록 md 원문
 * @param now 연도·기본값 기준 시각(테스트 주입용, 기본 현재)
 */
export function extractMeetingDateTime(markdown: string, now: Date = new Date()): MeetingDateTimeDraft | undefined {
  if (!markdown) return undefined;
  // 상단 메타에 몰려 있으므로 앞 40줄만 본다(대용량 본문 스캔 비용·오탐 축소).
  const lines = markdown.split("\n").slice(0, 40);

  const labeled = lines.filter((l) => LABEL_HINT.test(l));
  // 1순위: 라벨 줄에서 날짜, 2순위: 아무 줄에서 첫 날짜
  for (const source of [labeled, lines]) {
    for (const line of source) {
      const date = matchDate(line, now);
      if (!date) continue;
      // 시각은 같은 줄에서 먼저, 없으면 라벨 줄 전체에서 탐색
      const time = matchTime(line) ?? labeled.map((l) => matchTime(l)).find(Boolean) ?? undefined;
      const d = new Date(date.year, date.month - 1, date.day, time?.hour ?? 10, time?.minute ?? 0);
      if (Number.isNaN(d.getTime())) continue;
      const dateTime = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
      return { dateTime, hasTime: Boolean(time) };
    }
  }
  return undefined;
}
