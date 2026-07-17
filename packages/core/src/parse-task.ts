import type { User } from "./domain";

// 자연어 작업 입력의 규칙 기반 해석 (기획서 "자연어 작업 생성 플로우").
// 해석 결과는 저장되지 않는다 — 반드시 확인 카드를 거쳐 createTask로 이어진다.
// 예: "내일 오후 3시에 황성현씨 상세페이지 QA 넣어줘"
//   → { title: "상세페이지 QA", assigneeId: "hwang-sunghyeon", startAt: 내일 15:00 }

export interface TaskDraft {
  title: string;
  assigneeId?: string;
  assigneeName?: string;
  startAt?: string;
  endAt?: string;
  /** 예상 소요시간(시간 단위). "2시간"→2, "30분"→0.5, "반나절"→4, "하루종일"→8.
   *  부하 카드/업무 부하 표/리포트 분포가 이 값을 집계한다. 못 알아들으면 미추출(undefined)이 정답. */
  estimatedHours?: number;
  /** 확정 전 사용자에게 확인해야 할 항목 (기획: 모호하면 확정 전에 확인한다) */
  questions: string[];
}

// 명령형 어미(…넣어줘/추가해줘/해줘)는 문장 끝에서 항상 제거한다.
const TRAILING_COMMAND_PHRASE =
  /\s*(을|를|좀|하나)?\s*(넣어\s*줘|추가해\s*줘|등록해\s*줘|잡아\s*줘|만들어\s*줘|해\s*줘)\s*[.!]?\s*$/;
// 짧은 명령 동사(넣어/추가/등록)는 명사의 일부일 수 있어(예: "작업등록") 앞에 공백·조사
// 경계가 있을 때만 제거한다 — "작업등록"의 등록은 남기고 "작업 등록"·"작업을 등록"만 제거.
const TRAILING_COMMAND_WORD = /(\s|을|를|좀|하나)\s*(넣어|추가|등록)\s*[.!]?\s*$/;

export function parseTaskInput(input: {
  text: string;
  users: User[];
  now?: Date;
}): TaskDraft {
  const now = input.now ?? new Date();
  let rest = input.text.trim();
  const questions: string[] = [];

  // ---- 담당자: 이름(긴 것 우선) + 붙는 호칭/조사 제거 ----
  // 주의: 여기서는 active(재직) 필터를 하지 않는다 — 넘어온 users 목록을 그대로 매칭한다.
  //       비활성 사용자가 담당자로 해석되지 않게 하려면 호출부가 active !== false로 걸러서 넘겨야 한다.
  let assignee: User | undefined;
  for (const user of [...input.users].sort((a, b) => b.name.length - a.name.length)) {
    if (rest.includes(user.name)) {
      assignee = user;
      rest = rest.replace(
        new RegExp(`${user.name}(씨|님)?(가|이|한테|에게|의)?`),
        " ",
      );
      break;
    }
  }

  // ---- 날짜 ----
  const date = new Date(now);
  let hasDate = false;
  const relative: [RegExp, number][] = [
    [/오늘/, 0],
    [/내일\s*모레|모레/, 2],
    [/내일/, 1],
    [/글피/, 3],
  ];
  for (const [pattern, offset] of relative) {
    if (pattern.test(rest)) {
      date.setDate(date.getDate() + offset);
      rest = rest.replace(pattern, " ");
      hasDate = true;
      break;
    }
  }
  // 요일 표현: "(다음 주|이번 주)? X요일" — 없으면 다가오는 해당 요일(오늘 포함)
  if (!hasDate) {
    const weekdayMatch = rest.match(/(다음\s*주|담주|이번\s*주)?\s*([월화수목금토일])요일/);
    if (weekdayMatch) {
      const DOW: Record<string, number> = { 일: 0, 월: 1, 화: 2, 수: 3, 목: 4, 금: 5, 토: 6 };
      const target = DOW[weekdayMatch[2]];
      const current = date.getDay();
      if (/다음\s*주|담주/.test(weekdayMatch[1] ?? "")) {
        // 다음 주(월요일 시작)의 해당 요일
        const daysToNextMonday = ((8 - current) % 7) || 7;
        date.setDate(date.getDate() + daysToNextMonday + ((target + 6) % 7));
      } else {
        date.setDate(date.getDate() + ((target - current + 7) % 7));
      }
      rest = rest.replace(weekdayMatch[0], " ");
      hasDate = true;
    }
  }
  if (!hasDate) {
    const explicit = rest.match(/(\d{1,2})\s*월\s*(\d{1,2})\s*일/) ?? rest.match(/(\d{1,2})\/(\d{1,2})/);
    if (explicit) {
      date.setMonth(Number(explicit[1]) - 1, Number(explicit[2]));
      if (date < now) date.setFullYear(date.getFullYear() + 1); // 지난 날짜면 내년으로
      rest = rest.replace(explicit[0], " ");
      hasDate = true;
    }
  }

  // ---- 예상 소요시간 (시각 파싱보다 먼저) ----
  // "2시간"의 '시'가 아래 시각 파서(…시)에 hour=2로 오인되므로, 시간(hour) 단위 소요는
  // 시각 파싱 앞에서 먼저 뽑아 제거한다. 분(minute) 단위 소요는 "3시 30분"의 분과 겹치므로
  // 시각 파싱을 마친 뒤(아래) 처리한다.
  let estimatedHours: number | undefined;
  // 시점 표현 방어: "N시간/분 후·뒤·전·까지"는 소요가 아니라 시점이다. 소요로 뽑지 않고,
  // 시각 파서가 "N시"를 시각으로 오인하지 않도록 통째로 제거만 한다(시각도 설정하지 않음).
  const timePointMatch = rest.match(
    /(\d+(?:\.\d+)?|한|두|세|반)\s*(시간|분)\s*(후|뒤|전|까지)\s*(에)?/,
  );
  if (timePointMatch) {
    rest = rest.replace(timePointMatch[0], " ");
  } else if (/반나절/.test(rest)) {
    estimatedHours = 4; // 반나절 = 4시간
    rest = rest.replace(/반나절/, " ");
  } else if (/하루\s*종일|종일/.test(rest)) {
    estimatedHours = 8; // 하루종일/종일 = 8시간
    rest = rest.replace(/하루\s*종일|종일/, " ");
  } else {
    // "2시간", "1.5시간", "2시간짜리" — 숫자 시간
    const hourMatch = rest.match(/(\d+(?:\.\d+)?)\s*시간(\s*짜리)?/);
    // "한 시간"·"두 시간" — 한글 수사는 무리하지 않고 1·2만 인정
    const hanMatch = rest.match(/(한|두)\s*시간(\s*짜리)?/);
    if (hourMatch) {
      estimatedHours = Number(hourMatch[1]);
      rest = rest.replace(hourMatch[0], " ");
    } else if (hanMatch) {
      estimatedHours = hanMatch[1] === "한" ? 1 : 2;
      rest = rest.replace(hanMatch[0], " ");
    }
  }

  // ---- 시간 ----
  let hasTime = false;
  let hour = 9;
  let minute = 0;
  const timeMatch =
    rest.match(/(오전|오후|아침|저녁|밤)?\s*(\d{1,2})\s*시\s*(반|(\d{1,2})\s*분)?/) ??
    rest.match(/()(\d{1,2}):(\d{2})/);
  if (timeMatch) {
    const meridiem = timeMatch[1] ?? "";
    hour = Number(timeMatch[2]);
    if (timeMatch[3] === "반") minute = 30;
    else if (timeMatch[4]) minute = Number(timeMatch[4]);
    else if (timeMatch[3] && /^\d{2}$/.test(timeMatch[3])) minute = Number(timeMatch[3]);
    if ((/오후|저녁|밤/.test(meridiem) || (!meridiem && hour <= 6)) && hour < 12) {
      hour += 12; // 오후 표기 또는 1~6시처럼 오전으로 보기 어려운 값은 오후로 해석
    }
    rest = rest.replace(timeMatch[0], " ");
    hasTime = true;
  }

  // ---- 분 단위 예상 소요 (시각 파싱 후) ----
  // "3시 30분"의 분은 위 시각 파서가 이미 소비했으므로, 여기 남은 "30분"만 소요로 본다.
  // 시간(hour) 소요를 이미 뽑았으면 덮어쓰지 않는다.
  if (estimatedHours === undefined) {
    const minuteMatch = rest.match(/(\d+)\s*분(\s*짜리)?/);
    if (minuteMatch) {
      // 30분 → 0.5. 소수 둘째 자리까지 반올림(20분 등 무한소수 방지).
      estimatedHours = Math.round((Number(minuteMatch[1]) / 60) * 100) / 100;
      rest = rest.replace(minuteMatch[0], " ");
    }
  }

  let startAt: string | undefined;
  let endAt: string | undefined;
  if (hasDate || hasTime) {
    date.setHours(hour, minute, 0, 0);
    startAt = date.toISOString();
    endAt = new Date(date.getTime() + 60 * 60 * 1000).toISOString(); // 기본 1시간
  }

  // ---- 제목: 남은 텍스트 정리 ----
  // 명령형 어미(PHRASE)가 있으면 그것만 제거하고, 없을 때만 짧은 동사(WORD)를 제거한다.
  // 둘을 연달아 적용하면 "회원 등록 넣어줘"에서 '넣어줘'를 뗀 뒤 남은 '등록'까지 이중으로
  // 잘려 "회원"이 된다(원문 기준 명령어는 1회만 제거).
  const stripped = TRAILING_COMMAND_PHRASE.test(rest)
    ? rest.replace(TRAILING_COMMAND_PHRASE, " ")
    : rest.replace(TRAILING_COMMAND_WORD, " ");
  const title = stripped
    .replace(/^\s*(에|에서|은|는|이|가)\s+/, " ")
    .replace(/\s+(을|를)\s*$/, " ")
    .replace(/\s{2,}/g, " ")
    .trim()
    .slice(0, 200);

  if (!title) questions.push("작업명을 알 수 없습니다 — 무엇을 등록할까요?");
  if (!hasDate) questions.push("날짜가 없습니다 — 오늘로 등록할까요?");
  if (!hasTime && hasDate) questions.push("시간이 없습니다 — 09:00으로 등록할까요?");
  if (!assignee) questions.push("담당자가 없어 본인 작업으로 등록됩니다.");

  return {
    title,
    assigneeId: assignee?.id,
    assigneeName: assignee?.name,
    startAt,
    endAt,
    estimatedHours,
    questions,
  };
}
