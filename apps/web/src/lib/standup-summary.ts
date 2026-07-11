import "server-only";

import {
  keyResultProgress,
  latestStatusLog,
  type MockQueDb,
  type StandupTeamSummary,
} from "@que/core";
import { getStandupData } from "./team-data";
import { kstDateKey } from "./daily-data";
import { currentMonthKey } from "./okr-data";
import { generateAnalysis } from "./ai/gemini";

// 데일리 스탠드업 AI 팀 요약(기획 §3②) — pro 우선, 실패 시 flash 폴백. server-only.
// 당일 체크인 전건 + 각자 파생 4분면(어제 완료/미완·오늘 예정) + 막힘 작업 사유를 근거로,
// (a)막힘 클러스터+도울 사람 (b)어제→오늘 흐름 (c)추천 액션 2~3개를 생성해 saveStandupTeamSummary로
// 저장한다(AI 저장 관례의 의도적 예외 — 기획 §2). 미제출자가 있으면 "n인 미제출"을 명시한다(§8-2).
//
// 저장·persist까지 이 함수가 책임진다(호출부: 크론의 팀 요약 게시, admin 재생성 액션). Slack 게시는 호출부.
// 권한은 호출부가 강제한다(크론=시스템, 재생성=admin) — saveStandupTeamSummary는 권한을 보지 않는다.

const SUMMARY_SYSTEM = [
  "너는 8명 규모 한국 회사의 데일리 스탠드업 진행자다. 오늘 팀의 비동기 체크인과 작업 데이터를 근거로",
  "팀 전체가 3초 안에 읽을 팀 요약을 만든다. 감시가 아니라 병목과 흐름을 빨리 드러내는 운영 요약이다.",
  "규칙:",
  "- 반드시 한국어 존댓말. 데이터에 없는 사실을 지어내지 않는다. 사람 평가·질책 금지.",
  "- 아래 세 섹션 구조를 그대로 지킨다(각 섹션 머리글 포함, 마크다운 굵게 없이 plain text):",
  "  [막힘 클러스터] 서로 얽힌 막힘을 묶고, 도울 수 있는 사람을 이름으로 제안(근거 있을 때만). 없으면 '막힘 없음'.",
  "  [어제→오늘 흐름] 이월이 몰린 곳·모멘텀(잘 나가는 흐름)을 2~3문장으로.",
  "  [추천 액션] 오늘 팀이 할 구체적 행동 2~3개를 번호로. 각 1문장, 실행 가능하게.",
  "- 전체 12줄 이내. 미제출자 수가 주어지면 [어제→오늘 흐름] 끝에 'n인 미제출'을 덧붙인다.",
  "- '이번 달 KR' 목록이 주어지면, 오늘 체크인이 어느 KR 진척에 기여하는지 보일 때만 [어제→오늘 흐름]에서 짧게 언급한다(근거 없으면 생략).",
].join("\n");

/** AI 팀 요약을 위한 1인 데이터 묶음(제출자만). */
interface MemberPayload {
  이름: string;
  포커스?: string;
  부연?: string;
  막힘서술?: string;
  "어제 완료": string[];
  "어제 미완(이월)": string[];
  "오늘 예정": string[];
  "막힌 작업": { 제목: string; 상태: string; 사유: string; "다음 액션": string }[];
}

/**
 * 당일 스탠드업 팀 요약 생성 → 저장 → persist. 반환은 저장된 요약.
 * pro로 시도하고 실패하면 flash로 폴백한다(모델을 content와 함께 기록). 둘 다 실패하면 throw.
 * @param regeneratedBy admin 재생성이면 그 actorId. 크론 최초 생성이면 생략.
 */
export async function generateTeamSummary(
  db: MockQueDb,
  now: Date,
  regeneratedBy?: string,
): Promise<StandupTeamSummary> {
  const date = kstDateKey(now);
  const entries = db.standupEntriesByDate(date);
  const submittedUserIds = entries.map((e) => e.userId);
  const submittedSet = new Set(submittedUserIds);

  // 파생 4분면은 전사 스코프(clientId 미지정)로 — getStandupData가 web 계층이라 여기서 조립한다.
  const rows = await getStandupData(now);
  const rowByUser = new Map(rows.map((r) => [r.user.id, r]));
  const nameById = new Map(db.users.map((u) => [u.id, u.name]));

  const members: MemberPayload[] = entries.map((entry) => {
    const row = rowByUser.get(entry.userId);
    const blocked = (row?.blocked ?? []).map((t) => {
      const log = latestStatusLog(db.statusLogs, t.id, t.status);
      return {
        제목: t.title,
        상태: t.status,
        사유: log?.reason ?? "",
        "다음 액션": log?.nextAction ?? "",
      };
    });
    return {
      이름: nameById.get(entry.userId) ?? entry.userId,
      포커스: entry.focus,
      부연: entry.note,
      막힘서술: entry.blockerText,
      "어제 완료": row?.yesterdayDone.map((t) => t.title) ?? [],
      "어제 미완(이월)": row?.yesterdayUnfinished.map((t) => t.title) ?? [],
      "오늘 예정": row?.todayPlanned.map((t) => t.title) ?? [],
      "막힌 작업": blocked,
    };
  });

  // 미제출자(활성 유저 중 오늘 체크인 없는 사람) — "n인 미제출" 근거.
  const activeUsers = db.users.filter((u) => u.active !== false);
  const missing = activeUsers.filter((u) => !submittedSet.has(u.id));

  // 이번 달 활성 KR(최대 5) — 체크인이 어느 목표에 기여하는지 흐름 섹션에서 언급하도록 문맥만 준다(기획 §7 Phase 4).
  const month = currentMonthKey(now);
  const activeKrs = db.keyResults
    .filter((k) => k.month === month && k.status === "active")
    .slice(0, 5)
    .map((k) => ({
      제목: k.title,
      owner: nameById.get(k.ownerId) ?? k.ownerId,
      진척: keyResultProgress(k, db.tasks),
    }));

  const payload = {
    날짜: date,
    "제출 인원": `${members.length}/${activeUsers.length}`,
    미제출자: missing.map((u) => u.name),
    "이번 달 KR": activeKrs,
    제출: members,
  };
  const userContent = JSON.stringify(payload, null, 1);

  // pro 우선(리포트 분석과 동급 종합), 실패 시 flash 폴백. 모델을 실제 성공한 쪽으로 기록한다.
  let content: string;
  let model: StandupTeamSummary["model"];
  try {
    content = await generateAnalysis(SUMMARY_SYSTEM, userContent, {
      model: "pro",
      maxOutputTokens: 2048,
    });
    model = "pro";
  } catch (proError) {
    console.error("[que-standup] pro 팀 요약 실패 → flash 폴백", proError);
    content = await generateAnalysis(SUMMARY_SYSTEM, userContent, {
      model: "flash",
      maxOutputTokens: 2048,
    });
    model = "flash";
  }

  const summary = db.saveStandupTeamSummary({
    date,
    model,
    content,
    submittedUserIds,
    regeneratedBy,
  });
  await db.persist();
  return summary;
}
