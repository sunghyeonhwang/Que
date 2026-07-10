"use server";

import { gradeForUser } from "@que/core";
import { getCurrentUser } from "@/lib/current-user";
import { getClientFilter } from "@/lib/client-filter";
import { getAdminReportData, type ReportPeriod } from "@/lib/report-data";
import { generateAnalysis } from "@/lib/ai/gemini";

// E-10 분석 AI — 팀 리포트 온디맨드 분석(관리자·대표 전용, /team 리포트 뷰의 'AI 분석' 카드).
// 리포트 집계(getAdminReportData)를 Gemini(Pro — 2026-07-11 업그레이드)에 보내 병목 원인·권장 조치를 한국어로 받아온다.
// 결정 사항(로드맵 E-10): 온디맨드 버튼식(자동 크론 후순위), 외부 LLM 전송은 사용자 승인 완료,
// 개인 성과 평가가 아니라 흐름·구조 관점 코치(지식 얕은 팀에 해석·설명·방향 제시 — E-F 상보).

// 세션 사용자의 grade로 호칭·관점을 분기한다(대표=경영 관점 심화, 관리자=실행 관점). user.name으로 자연스러운 호칭.
function buildSystemPrompt(grade: "ceo" | "manager" | "staff", name: string): string {
  const isCeo = grade === "ceo";
  const title = isCeo ? "대표님" : "팀장님";
  const commonRules = [
    "- 반드시 한국어 존댓말. 마크다운(### 소제목, - 불릿, **강조**)으로 정리한다.",
    "- 개인 성과 평가·비난 금지. 문제는 사람이 아니라 일의 흐름·구조로 서술한다(예: '홀드가 오래 머무는 흐름' O, '아무개가 느림' X). 사람 이름은 도움/재배정 제안처럼 행동이 필요한 곳에만 중립적으로.",
    "- 데이터에 없는 사실을 지어내지 않는다. 수치를 인용할 때는 데이터의 값을 그대로 쓴다.",
    "- PM 전문용어(임계경로, 번다운 등) 대신 쉬운 우리말을 쓴다.",
  ];
  // 인원별 제안(사용자 요청 2026-07-11): 평가가 아니라 지원 관점 — 업무 조언·과부하 케어(재배분·휴식 제안).
  const memberSection =
    "### 인원별 제안 (팀원마다 1~2줄 — 부하·막힘·완료 데이터에 근거한 업무 조언. 과부하로 보이면 재배분·일정 조정·휴식 등 케어 제안. 잘 흘러가는 사람은 짧게 인정. 평가·서열화 금지, 지원 관점만)";
  if (isCeo) {
    return [
      `너는 8명 규모 한국 회사의 경영 참모다. 팀 작업 현황 데이터(JSON)를 근거로 ${name} ${title}께 경영 관점의 리포트 분석을 드린다.`,
      `대화 상대는 ${title}이므로 실행 실무보다 경영 판단(리소스 배분·우선순위·위험 대응)에 초점을 둔다.`,
      "규칙:",
      "- 전체 900~1400자로 깊이 있게 서술한다.",
      `- 구성: ### 지금 가장 큰 병목 (2~3개, 각각 원인 추정과 근거 수치) → ### 흐름 진단 (주간 완료 추이·기간 내 발생 데이터로 지난 기간 대비 나아지는지/나빠지는지 히스토리 근거로 판단) → ### 경영 판단이 필요한 것 (2~3개, 리소스·우선순위 관점) → ${memberSection} → ### 좋아진 점 (1~2개).`,
      ...commonRules,
    ].join("\n");
  }
  return [
    `너는 8명 규모 한국 회사의 팀 운영 코치다. 팀 작업 현황 데이터(JSON)를 근거로 ${name} ${title}께 실행 관점의 조언을 드린다.`,
    "규칙:",
    "- 전체 700~1000자로 서술한다.",
    `- 구성: ### 지금 가장 큰 병목 (2~3개, 각각 원인 추정과 근거 수치) → ### 이번 주 권장 조치 (3개, 실행 가능한 행동) → ${memberSection} → ### 좋아진 점 (1개).`,
    ...commonRules,
  ].join("\n");
}

export interface AiAnalysisResult {
  ok: boolean;
  /** ok=true면 마크다운 분석 텍스트, ok=false면 한글 에러 메시지. */
  text: string;
}

export async function analyzeTeamReportAction(period: ReportPeriod): Promise<AiAnalysisResult> {
  const user = await getCurrentUser();
  // 리포트 뷰와 동일한 이중 게이트 — UI 숨김만 믿지 않는다.
  if (user.role !== "admin") {
    return { ok: false, text: "AI 분석은 관리자만 사용할 수 있습니다." };
  }
  const clientId = await getClientFilter();
  const data = await getAdminReportData(user, period, new Date(), clientId);

  // 프롬프트 페이로드 — 리포트 화면과 같은 집계만 보낸다(개별 작업 설명·댓글 등 원문은 미포함).
  const payload = {
    기간: `${data.rangeStart} ~ ${data.rangeEnd} (${data.period === "week" ? "주간" : "월간"})`,
    전체현황: {
      "활성 프로젝트": data.overall.activeProjects,
      "열린 작업": data.overall.openTasks,
      "현재 막힘(문제·홀드)": data.overall.blockedNow,
      "위험 마일스톤": data.overall.atRiskMilestones,
      "대기 결제": data.overall.pendingPayments,
      "기한 지난 결제": data.overall.overduePayments,
    },
    "기간 내 완료": data.completedInPeriod,
    "기간 내 취소": data.cancelledInPeriod,
    "기간 내 발생": { 문제: data.raisedIssues, 홀드: data.raisedHolds },
    "프로젝트별 완료": data.completedByProject,
    "현재 막힌 작업": data.currentBlockers.map((b) => ({
      작업: b.taskTitle,
      담당: b.assigneeName,
      프로젝트: b.projectName ?? "(없음)",
      상태: b.status === "issue" ? "문제발생" : "홀드",
      사유: b.reason ?? "(미기재)",
      경과: b.sinceLabel,
    })),
    "팀원별 부하": data.loadByMember.map((m) => ({
      이름: m.name,
      "열린 작업": m.openTasks,
      "예상 시간": m.openHours,
      막힘: m.blocked,
    })),
    "주간 완료 추이": data.weeklyTrend,
  };

  const grade = gradeForUser(user);
  const systemPrompt = buildSystemPrompt(grade, user.name);

  try {
    // 리포트 분석은 Pro(깊은 해석·히스토리 진단) — 온디맨드 버튼 경로라 지연(수십 초)·과금 감수(2026-07-11 결정).
    const text = await generateAnalysis(
      systemPrompt,
      JSON.stringify(payload, null, 1),
      { model: "pro", maxOutputTokens: grade === "ceo" ? 4096 : 3072 },
    );
    return { ok: true, text };
  } catch (e) {
    return { ok: false, text: e instanceof Error ? e.message : "AI 분석 생성에 실패했습니다." };
  }
}
