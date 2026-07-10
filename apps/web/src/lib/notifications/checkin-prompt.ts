import "server-only";

import type { CheckIn, MockQueDb, NotificationIntent } from "@que/core";
import { digestRecipientAllowlist } from "./config";

// 체크인 재촉 DM(checkin_prompt) 콘텐츠 빌더 — C-2 Slack 인터랙티브, web 계층.
// "오늘 시작한 이 작업, 어떻게 되고 있나요?"를 담당자 개인 DM으로 보내고, 버튼으로 바로 응답받는다.
// 부수효과 없음(발송·적재는 dispatch). dedup `checkin_prompt:<checkInId>:<KST날짜>` — 체크인·날짜당 1회.
//
// 버튼은 사유가 필요 없는 응답만 담는다: 작업중(working)·완료(done)·나중에(later).
// 문제발생/홀드/병합처럼 사유·추가 입력이 필요한 응답은 딥링크(/today)로 유도 — 사유 없는
// 문제/홀드 전환을 core가 거부하는 도메인 규칙과 정합(Slack 모달로 사유를 받는 건 후속).

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** now의 KST 날짜 키(YYYY-MM-DD) — dedup marker(체크인·날짜당 1회). */
function kstDateKey(now: Date): string {
  return new Date(now.getTime() + KST_OFFSET_MS).toISOString().slice(0, 10);
}

/** 응답을 기다리는 체크인인지 — 미응답이거나, '나중에' 응답 후 스누즈 시각이 지난 것. */
export function isAwaitingAnswer(checkIn: CheckIn, now: Date): boolean {
  if (!checkIn.answeredAt) return true;
  if (checkIn.response !== "later") return false;
  if (!checkIn.snoozeUntil) return true; // 스누즈 시각 없는 '나중에'는 계속 대기
  return Date.parse(checkIn.snoozeUntil) <= now.getTime();
}

/**
 * 응답 대기 체크인 → 담당자 개인 DM intent. recipient=assigneeId, marker=KST 날짜.
 * allowlist(QUE_DIGEST_RECIPIENTS)는 개인 DM 계열 공통의 단계적 롤아웃 게이트라 여기도 적용한다.
 */
export function buildCheckinPromptIntents(db: MockQueDb, now: Date): NotificationIntent[] {
  const dateKey = kstDateKey(now);
  const allow = digestRecipientAllowlist();
  const taskById = new Map(db.tasks.map((t) => [t.id, t]));
  const activeIds = new Set(db.users.filter((u) => u.active !== false).map((u) => u.id));

  const intents: NotificationIntent[] = [];
  for (const checkIn of db.checkIns) {
    if (!isAwaitingAnswer(checkIn, now)) continue;
    if (!activeIds.has(checkIn.assigneeId)) continue;
    if (allow && !allow.includes(checkIn.assigneeId)) continue;
    const task = taskById.get(checkIn.taskId);
    // 이미 종결(완료/취소/병합)된 작업의 체크인은 묻지 않는다 — 답이 무의미하다.
    if (!task || task.status === "done" || task.status === "cancelled" || task.status === "merged")
      continue;

    intents.push({
      kind: "checkin_prompt",
      entityType: "check_in",
      entityId: checkIn.id,
      marker: dateKey,
      recipient: checkIn.assigneeId,
      payload: {
        title: "작업 체크인",
        text: `오늘 시작한 '${task.title}' 작업, 어떻게 되고 있나요? 아래 버튼으로 바로 응답할 수 있습니다.`,
        deeplinkPath: "/today",
        tone: "blue",
        actions: [
          { actionId: "checkin:working", label: "작업중", value: checkIn.id },
          { actionId: "checkin:done", label: "완료", value: checkIn.id, style: "primary" },
          { actionId: "checkin:later", label: "나중에", value: checkIn.id },
        ],
      },
    });
  }
  return intents;
}
