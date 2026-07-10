"use server";

import { getCurrentUser } from "@/lib/current-user";
import { getClientFilter } from "@/lib/client-filter";
import { getGradeHomeData } from "@/lib/home-grade-data";
import { generateAnalysis } from "@/lib/ai/gemini";

// 홈 AI 브리핑 — 전 역할 온디맨드(홈 명세 §1 TodaySummary, 2026-07-10 통일). E-10 Gemini 재사용.
// grade는 세션 user에서만 서버 판정한다(클라 입력 불신 — URL·파라미터로 스코프 확장 불가). 각 grade는
// 자기 스코프 데이터만 전송한다: 사원=본인 작업·일정·체크인 / 관리자=팀 작업·부하(대표 개인 데이터 제외)
// / 대표=전사. 규칙 기반 폴백(미생성 시 표시할 문장)은 이 액션이 아니라 홈 번들(todaySummary.lines)에 있다.

const BASE_RULES = [
  "규칙:",
  "- 반드시 한국어 존댓말. 마크다운(### 소제목, - 불릿, **강조**)으로 간결하게. 전체 400자 내외.",
  "- 개인 성과 평가·비난 금지. 문제는 사람이 아니라 일의 흐름·구조로 서술한다. 사람 이름은 도움/재배정 제안처럼 행동이 필요한 곳에만 중립적으로.",
  "- 데이터에 없는 사실을 지어내지 않는다. 수치를 인용할 때는 데이터의 값을 그대로 쓴다.",
  "- PM 전문용어(임계경로, 번다운 등) 대신 쉬운 우리말을 쓴다.",
].join("\n");

const SYSTEM_BY_GRADE: Record<"staff" | "manager" | "ceo", string> = {
  staff: [
    "너는 8명 규모 한국 회사의 개인 업무 비서다. 로그인한 사원 '본인'의 오늘 데이터만 근거로 브리핑한다.",
    BASE_RULES,
    "- 구성: ### 오늘 먼저 (가장 급한 1~2개) → ### 챙길 것 (마감 임박·이월·응답 대기) → ### 한마디 (한 문장 응원/정리).",
    "- 타인·팀 전체 이야기는 하지 않는다(데이터에도 없다).",
  ].join("\n"),
  manager: [
    "너는 8명 규모 한국 회사의 팀 운영 코치다. 팀 현황 데이터(JSON)를 근거로 관리자에게 오늘의 브리핑을 한다.",
    BASE_RULES,
    "- 구성: ### 지금 가장 큰 병목 (2~3개, 원인 추정과 근거 수치) → ### 오늘 조정 (도움·재배정·일정 제안 2~3개) → ### 좋아진 점 (1개).",
  ].join("\n"),
  ceo: [
    "너는 8명 규모 한국 회사의 경영 참모다. 전사 현황 데이터(JSON)를 근거로 대표에게 결정 관점 브리핑을 한다.",
    BASE_RULES,
    "- 구성: ### 전사 위험 (2~3개, 근거 수치) → ### 결정·확인 필요 (2~3개) → ### 흐름 (적체 증감·완료 추이 한 줄).",
  ].join("\n"),
};

export interface HomeBriefingResult {
  ok: boolean;
  /** ok=true면 마크다운 브리핑, ok=false면 한글 에러 메시지. */
  text: string;
  /** 외부 전송 고지용 — Gemini로 보낸 데이터 항목 요약(라벨). */
  scope: string[];
  grade?: "staff" | "manager" | "ceo";
}

/** 세션 user의 grade를 서버 판정해 스코프 데이터만 Gemini에 보내 오늘 브리핑을 생성한다. */
export async function generateHomeBriefingAction(): Promise<HomeBriefingResult> {
  const user = await getCurrentUser();
  const clientId = await getClientFilter();
  const now = new Date();
  // grade는 getGradeHomeData 내부에서 user.id로만 판정된다(클라 입력 불신 — URL로 스코프 확장 불가).
  const data = await getGradeHomeData(user, now, { clientId });

  let payload: Record<string, unknown>;
  let scope: string[];

  if (data.grade === "staff") {
    payload = {
      대상: `${user.name}(사원 본인)`, // AI가 "본인님"처럼 어색하게 부르지 않게 실명 전달
      오늘요약: data.todaySummary,
      "핵심 현황": data.homeKpis.map((k) => ({ 항목: k.label, 값: k.value })),
      "오늘 할 일": data.todos.map((t) => ({ 제목: t.title, 상태: t.statusLabel, 마감: t.dueLabel ?? "미정", 기한초과: t.overdue })),
      "오늘 일정": data.schedule.map((s) => ({ 제목: s.title, 시간: s.timeLabel })),
      "응답 대기 체크인": data.checkIns.map((c) => c.taskTitle),
    };
    scope = ["내 작업", "내 일정", "내 체크인"];
  } else if (data.grade === "manager") {
    payload = {
      대상: "팀(관리자 스코프 — 대표 개인 데이터 제외)",
      오늘요약: data.todaySummary,
      "핵심 현황": data.homeKpis.map((k) => ({ 항목: k.label, 값: k.value })),
      "우선 확인": data.teamPriority.items.map((p) => ({ 종류: p.title, 내용: p.description })),
      "프로젝트 현황": data.projectOverview.map((p) => ({ 프로젝트: p.name, 진행률: p.progress, 상태: p.status, 기한초과: p.overdueTasks, 막힘: p.blockedTasks })),
      "업무 흐름": { 순증: data.workflowTrend.netLabel, 주별: data.workflowTrend.weeks },
      "팀원별 부하": data.load.rows.map((m) => ({ 이름: m.name, "열린 작업": m.openTasks, "예상 시간": m.estimatedHours, "가용 대비": m.ratio == null ? "판단 불가" : `${m.ratio}%`, "마감 임박": m.dueSoonCount, 홀드: m.holdCount })),
      "처리 대기": data.pending,
    };
    scope = ["팀 작업·병목", "프로젝트 현황", "업무 흐름", "팀원 부하(대표 제외)", "처리 대기 현황(집계 수)"];
  } else {
    payload = {
      대상: "전사(대표)",
      오늘요약: data.todaySummary,
      "위험 지표": data.riskKpis.map((k) => ({ 항목: k.label, 값: k.value })),
      "운영 지표": data.opsKpis.map((k) => ({ 항목: k.label, 값: k.value })),
      "우선 확인": data.teamPriority.items.map((p) => ({ 종류: p.title, 내용: p.description })),
      "프로젝트 현황": data.projectOverview.map((p) => ({ 프로젝트: p.name, 진행률: p.progress, 상태: p.status })),
      "클라이언트별 현황": data.clientOverview.map((c) => ({ 거래처: c.clientName, "활성 프로젝트": c.activeProjects, "평균 진행률": c.avgProgress, 막힘: c.blockedTasks })),
      "업무 흐름": { 순증: data.workflowTrend.netLabel, 주별: data.workflowTrend.weeks },
      "전 인원 부하": data.load.rows.map((m) => ({ 이름: m.name, "열린 작업": m.openTasks, "예상 시간": m.estimatedHours, "가용 대비": m.ratio == null ? "판단 불가" : `${m.ratio}%`, "마감 임박": m.dueSoonCount, 홀드: m.holdCount })),
      "처리 대기": data.pending,
    };
    scope = ["전사 위험·운영 지표", "프로젝트·클라이언트 현황", "업무 흐름", "전 인원 부하"];
  }

  try {
    const text = await generateAnalysis(SYSTEM_BY_GRADE[data.grade], JSON.stringify(payload, null, 1));
    return { ok: true, text, scope, grade: data.grade };
  } catch (e) {
    return { ok: false, text: e instanceof Error ? e.message : "AI 브리핑 생성에 실패했습니다.", scope, grade: data.grade };
  }
}
