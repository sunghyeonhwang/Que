import { format } from "date-fns";
import { ko } from "date-fns/locale";

// 영업일(주말 제외) 산술. daily-data의 businessDaysElapsed와 같은 술어(주말=0/6 스킵)를 쓴다.
// KST 요일 기준 — 서버는 instrumentation.ts에서 TZ=Asia/Seoul로 고정하고, KST는 DST가 없어
// getDay()가 흔들리지 않는다.

/**
 * 주어진 시각의 "다음 영업일"을 돌려준다. 시:분은 그대로 유지하고 날짜만 하루씩 전진하되
 * 토(6)·일(0)은 건너뛴다 — 금요일이면 월요일, 토·일 시작이면 그 주 월요일이 된다.
 * (단순히 +1일 하면 금요일 작업이 토요일로 밀려 아무도 안 보므로 다음 영업일로 옮긴다.)
 */
export function nextBusinessDay(from: Date): Date {
  const d = new Date(from);
  do {
    d.setDate(d.getDate() + 1);
  } while (d.getDay() === 0 || d.getDay() === 6);
  return d;
}

/** 다음 영업일을 "M/d(EEE)" 라벨로. 토스트에 실제 이동 날짜를 병기하는 데 쓴다(예: "7/20(월)"). */
export function nextBusinessDayLabel(fromIso: string): string {
  return format(nextBusinessDay(new Date(fromIso)), "M/d(EEE)", { locale: ko });
}
