import type {
  ActionItemStatus,
  CheckInResponse,
  PaymentStatus,
  TaskStatus,
} from "./domain";

// 상태 코드 → 화면 표기. 상태 색상 의미는 CLAUDE.md에 고정되어 있다:
// green=진행/완료, blue=예정/정보, amber=주의/대기, red=문제/취소, violet=회의록/응답대기

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  scheduled: "예정",
  in_progress: "진행중",
  done: "완료",
  needs_reschedule: "시간변경필요",
  on_hold: "홀드",
  issue: "문제발생",
  cancelled: "취소",
  merged: "병합",
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  waiting: "대기",
  done: "완료",
  cancelled: "취소",
};

export const ACTION_ITEM_STATUS_LABELS: Record<ActionItemStatus, string> = {
  needs_review: "확인 필요",
  candidate: "생성 대기",
  created: "Task 생성됨",
  held: "보류",
  ignored: "무시됨",
};

export const CHECK_IN_RESPONSE_LABELS: Record<CheckInResponse, string> = {
  working: "작업중",
  done: "완료",
  needs_reschedule: "시간변경필요",
  issue: "문제발생",
  not_needed: "필요없어짐",
  merged: "병합",
  later: "나중에 답변",
};
