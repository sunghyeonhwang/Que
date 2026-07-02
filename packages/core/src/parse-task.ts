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
  /** 확정 전 사용자에게 확인해야 할 항목 (기획: 모호하면 확정 전에 확인한다) */
  questions: string[];
}

const TRAILING_COMMANDS =
  /(을|를|좀|하나)?\s*(넣어\s*줘|추가해\s*줘|등록해\s*줘|잡아\s*줘|만들어\s*줘|넣어|추가|등록|해줘)\s*[.!]?\s*$/;

export function parseTaskInput(input: {
  text: string;
  users: User[];
  now?: Date;
}): TaskDraft {
  const now = input.now ?? new Date();
  let rest = input.text.trim();
  const questions: string[] = [];

  // ---- 담당자: 이름(긴 것 우선) + 붙는 호칭/조사 제거 ----
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
  if (!hasDate) {
    const explicit = rest.match(/(\d{1,2})\s*월\s*(\d{1,2})\s*일/) ?? rest.match(/(\d{1,2})\/(\d{1,2})/);
    if (explicit) {
      date.setMonth(Number(explicit[1]) - 1, Number(explicit[2]));
      if (date < now) date.setFullYear(date.getFullYear() + 1); // 지난 날짜면 내년으로
      rest = rest.replace(explicit[0], " ");
      hasDate = true;
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

  let startAt: string | undefined;
  let endAt: string | undefined;
  if (hasDate || hasTime) {
    date.setHours(hour, minute, 0, 0);
    startAt = date.toISOString();
    endAt = new Date(date.getTime() + 60 * 60 * 1000).toISOString(); // 기본 1시간
  }

  // ---- 제목: 남은 텍스트 정리 ----
  const title = rest
    .replace(TRAILING_COMMANDS, " ")
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
    questions,
  };
}
