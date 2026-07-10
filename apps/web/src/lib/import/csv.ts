// CSV 일괄 가져오기 — 파싱·행 스키마·형식 검증 (순수 모듈, 클라/서버 공용)
// 템플릿 정본: data/imports/*.csv (이름 기반 — 담당자·클라이언트·프로젝트를 '이름'으로 적고
// 서버 액션이 실제 id로 해석한다). `#`로 시작하는 행(가이드)과 빈 행은 무시한다.
// ⚠️ "use client" 금지 — 서버 액션이 같은 값을 import한다(projects-scope.ts 선례).

// ---------- 상수 ----------

/** 한 번에 가져올 수 있는 최대 데이터 행 수(폭주 방지). */
export const IMPORT_MAX_ROWS = 200;

/** 작업 CSV 권장 헤더(순서 무관 — 이름으로 매핑). data/imports/tasks-sample.csv와 1:1.
 *  2026-07-11 개편: 손으로 치기 쉽게 날짜(date)·시작시간(startTime)·종료시간(endTime) 분리.
 *  종료시간 생략 시 예상시간(estimatedHours)으로 자동 계산, 그것도 없으면 18:00.
 *  구 형식(startAt/endAt — ISO 또는 "2026-07-14 10:00")도 하위호환으로 계속 인식한다. */
export const TASK_HEADERS = [
  "title",
  "assigneeName",
  "clientName",
  "projectName",
  "date",
  "startTime",
  "endTime",
  "priority",
  "estimatedHours",
  "description",
  "status",
  "statusReason",
  "nextAction",
  "helpUserNames",
  "recheckAt",
] as const;

/** 헤더 검증에 쓰는 필수 최소셋 — 신·구 형식 공통(나머지는 있으면 매핑, 없으면 빈 값). */
const TASK_REQUIRED_HEADERS = ["title", "assigneeName"] as const;

/** 마일스톤 CSV 헤더. data/imports/milestones-sample.csv와 1:1. */
export const MILESTONE_HEADERS = ["clientName", "projectName", "title", "dueAt", "riskStatus"] as const;

/** 가져오기로 지정할 수 있는 상태 — cancelled/merged는 생성 경로로 만들지 않는다. */
export const IMPORTABLE_STATUSES = [
  "scheduled",
  "in_progress",
  "on_hold",
  "issue",
  "needs_reschedule",
  "done",
] as const;
export type ImportableStatus = (typeof IMPORTABLE_STATUSES)[number];

export const RISK_STATUSES = ["on_track", "at_risk", "late"] as const;
export type ImportRiskStatus = (typeof RISK_STATUSES)[number];

// ---------- 행 타입 ----------

export interface TaskImportRow {
  line: number; // 원본 CSV의 줄 번호(1-base, 오류 안내용)
  title: string;
  assigneeName: string;
  clientName: string;
  projectName: string;
  /** 정규화된 최종 ISO(신형 date/시간 조합 또는 구형 startAt/endAt에서 합성). */
  startAt: string;
  endAt: string;
  /** 원본 입력(검증 메시지용 — 어떤 칸이 틀렸는지 정확히 짚는다). */
  rawDate: string;
  rawStartTime: string;
  rawEndTime: string;
  priority: string;
  estimatedHours: string;
  description: string;
  status: string;
  statusReason: string;
  nextAction: string;
  helpUserNames: string;
  recheckAt: string;
}

export interface MilestoneImportRow {
  line: number;
  clientName: string;
  projectName: string;
  title: string;
  dueAt: string;
  riskStatus: string;
}

// ---------- CSV 파싱 (RFC4180: 따옴표 안 콤마·개행·이중따옴표) ----------

/** BOM 제거 + CSV 전체를 셀 단위로 파싱. 반환: 행 배열(각 행 = 셀 배열) + 원본 줄 번호. */
function parseCsvCells(text: string): { cells: string[]; line: number }[] {
  const src = text.replace(/^﻿/, ""); // 엑셀 UTF-8 BOM
  const rows: { cells: string[]; line: number }[] = [];
  let cells: string[] = [];
  let cell = "";
  let inQuotes = false;
  let line = 1;
  let rowLine = 1;

  const pushCell = () => {
    cells.push(cell);
    cell = "";
  };
  const pushRow = () => {
    pushCell();
    rows.push({ cells, line: rowLine });
    cells = [];
    rowLine = line;
  };

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"'; // 이스케이프된 따옴표
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        if (ch === "\n") line++;
        cell += ch;
      }
      continue;
    }
    if (ch === '"') inQuotes = true;
    else if (ch === ",") pushCell();
    else if (ch === "\n") {
      line++;
      pushRow();
      rowLine = line;
    } else if (ch !== "\r") cell += ch;
  }
  if (cell !== "" || cells.length > 0) pushRow();
  return rows;
}

export interface ParseResult<Row> {
  rows: Row[];
  /** 파일 수준 오류(헤더 불일치 등). 있으면 rows는 비어 있다. */
  fileError?: string;
}

/** 헤더 행으로 컬럼 인덱스를 잡고, `#`/빈 행을 걸러 행 객체로 변환한다. */
function parseWithHeaders<Row>(
  text: string,
  required: readonly string[],
  toRow: (get: (name: string) => string, line: number) => Row,
): ParseResult<Row> {
  const raw = parseCsvCells(text);
  // 가이드(`#` 시작)·완전 빈 행 제거
  const meaningful = raw.filter(
    (r) => !(r.cells[0] ?? "").trimStart().startsWith("#") && r.cells.some((c) => c.trim() !== ""),
  );
  if (meaningful.length === 0) return { rows: [], fileError: "CSV에 내용이 없습니다." };

  const header = meaningful[0].cells.map((c) => c.trim());
  const index = new Map(header.map((name, i) => [name, i] as const));
  const missing = required.filter((h) => !index.has(h));
  if (missing.length > 0) {
    return {
      rows: [],
      fileError: `헤더에 다음 컬럼이 없습니다: ${missing.join(", ")} — 샘플 CSV의 1행(헤더)을 그대로 사용하세요.`,
    };
  }

  const body = meaningful.slice(1);
  if (body.length === 0) return { rows: [], fileError: "헤더만 있고 데이터 행이 없습니다." };
  if (body.length > IMPORT_MAX_ROWS) {
    return { rows: [], fileError: `한 번에 최대 ${IMPORT_MAX_ROWS}행까지 가져올 수 있습니다. (현재 ${body.length}행)` };
  }

  const rows = body.map((r) => {
    const get = (name: string) => (r.cells[index.get(name)!] ?? "").trim();
    return toRow(get, r.line);
  });
  return { rows };
}

export function parseTasksCsv(text: string): ParseResult<TaskImportRow> {
  return parseWithHeaders(text, TASK_REQUIRED_HEADERS, (get, line) => ({
    line,
    title: get("title"),
    assigneeName: get("assigneeName"),
    clientName: get("clientName"),
    projectName: get("projectName"),
    ...composeTaskTimes(get),
    priority: get("priority"),
    estimatedHours: get("estimatedHours"),
    description: get("description"),
    status: get("status"),
    statusReason: get("statusReason"),
    nextAction: get("nextAction"),
    helpUserNames: get("helpUserNames"),
    recheckAt: normalizeDateTimeInput(get("recheckAt"), "09:00"),
  }));
}

export function parseMilestonesCsv(text: string): ParseResult<MilestoneImportRow> {
  return parseWithHeaders(text, MILESTONE_HEADERS, (get, line) => ({
    line,
    clientName: get("clientName"),
    projectName: get("projectName"),
    title: get("title"),
    dueAt: normalizeDateTimeInput(get("dueAt"), "18:00"),
    riskStatus: get("riskStatus"),
  }));
}

// ---------- 형식 검증(이름 해석 전 — 값만으로 판정 가능한 것) ----------

/**
 * 사람이 치기 쉬운 날짜 입력을 core 요건(오프셋 ISO)으로 정규화한다(2026-07-11 — "ISO 일일이 치기 힘들다").
 * 허용: ①`2026-07-14 10:00`(공백/T, 초 생략 가능 — KST로 해석) ②`2026-07-14`(날짜만 — defaultTime 부여)
 * ③기존 오프셋 ISO(그대로). 판정 불가 형식은 원본 반환 → 검증(isIsoWithOffset)이 오류로 잡는다.
 */
export function normalizeDateTimeInput(value: string, defaultTime: string): string {
  const v = value.trim();
  if (!v) return v;
  if (/(?:Z|[+-]\d{2}:\d{2})$/.test(v)) return v; // 이미 오프셋 ISO
  let m = /^(\d{4}-\d{2}-\d{2})$/.exec(v);
  if (m) return `${m[1]}T${defaultTime}:00+09:00`;
  m = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})(?::(\d{2}))?$/.exec(v);
  if (m) return `${m[1]}T${m[2]}:${m[3] ?? "00"}+09:00`;
  return v;
}

/**
 * 작업 행의 시작/종료 ISO 합성 — 신형(date+startTime+endTime)과 구형(startAt/endAt)을 모두 받는다.
 * 우선순위: 구형 startAt/endAt 명시 > 신형 조합. 종료 생략 시: endTime → 예상시간(startAt+h) → 18:00.
 * 형식이 틀린 값은 합성하지 않고 원본을 startAt/endAt에 남겨 검증이 정확히 잡게 한다.
 */
function composeTaskTimes(get: (name: string) => string): {
  startAt: string;
  endAt: string;
  rawDate: string;
  rawStartTime: string;
  rawEndTime: string;
} {
  const rawDate = get("date");
  const rawStartTime = get("startTime");
  const rawEndTime = get("endTime");
  let startAt = normalizeDateTimeInput(get("startAt"), "09:00");
  let endAt = normalizeDateTimeInput(get("endAt"), "18:00");

  const dateOk = /^\d{4}-\d{2}-\d{2}$/.test(rawDate);
  const timeOk = (t: string) => /^\d{2}:\d{2}$/.test(t);
  if (!startAt && rawDate) {
    startAt = dateOk && (!rawStartTime || timeOk(rawStartTime))
      ? `${rawDate}T${rawStartTime || "09:00"}:00+09:00`
      : rawDate; // 형식 오류 — 검증이 date 칸을 짚는다
  }
  if (!endAt && rawDate) {
    if (rawEndTime) {
      endAt = dateOk && timeOk(rawEndTime) ? `${rawDate}T${rawEndTime}:00+09:00` : rawEndTime;
    } else {
      const est = Number(get("estimatedHours"));
      const startMs = Date.parse(startAt);
      if (Number.isFinite(est) && est > 0 && Number.isFinite(startMs)) {
        endAt = new Date(startMs + est * 3_600_000).toISOString(); // 예상시간으로 자동 계산(Z — core 허용)
      } else if (dateOk) {
        endAt = `${rawDate}T18:00:00+09:00`;
      }
    }
  }
  return { startAt, endAt, rawDate, rawStartTime, rawEndTime };
}

/** core isoDateTime(z.iso.datetime({ offset: true }))과 동일 요건: 오프셋(+09:00) 또는 Z 필수. */
export function isIsoWithOffset(v: string): boolean {
  if (!/(?:Z|[+-]\d{2}:\d{2})$/.test(v)) return false;
  return Number.isFinite(Date.parse(v));
}

/** 작업 행의 형식 오류 목록(비면 통과). 이름 실재 여부는 서버 해석 단계에서 추가 판정. */
export function taskRowFormatErrors(row: TaskImportRow): string[] {
  const errors: string[] = [];
  if (!row.title) errors.push("작업명(title)이 비어 있습니다");
  if (row.title.length > 200) errors.push("작업명은 200자 이내입니다");
  if (row.description.length > 2000) errors.push("설명은 2000자 이내입니다");
  if (row.rawDate && !/^\d{4}-\d{2}-\d{2}$/.test(row.rawDate)) {
    errors.push("날짜(date) 형식 오류 — 예: 2026-07-14");
  }
  if (row.rawStartTime && !/^\d{2}:\d{2}$/.test(row.rawStartTime)) {
    errors.push("시작시간(startTime) 형식 오류 — 예: 10:00");
  }
  if (row.rawEndTime && !/^\d{2}:\d{2}$/.test(row.rawEndTime)) {
    errors.push("종료시간(endTime) 형식 오류 — 예: 18:00");
  }
  for (const [field, label] of [
    ["startAt", "시작"],
    ["endAt", "종료"],
    ["recheckAt", "재확인"],
  ] as const) {
    const v = row[field];
    if (v && !isIsoWithOffset(v)) {
      errors.push(`${label}(${field}) 날짜 형식 오류 — 예: 2026-07-14 10:00 (또는 날짜만 2026-07-14)`);
    }
  }
  if (row.startAt && row.endAt && Date.parse(row.startAt) > Date.parse(row.endAt)) {
    errors.push("시작이 종료보다 늦습니다");
  }
  if (row.priority && !["low", "normal", "high"].includes(row.priority)) {
    errors.push("priority는 low/normal/high 중 하나입니다");
  }
  if (row.estimatedHours) {
    const n = Number(row.estimatedHours);
    if (!Number.isFinite(n) || n <= 0) errors.push("예상 시간(estimatedHours)은 0보다 큰 숫자입니다");
  }
  const status = row.status || "scheduled";
  if (!(IMPORTABLE_STATUSES as readonly string[]).includes(status)) {
    errors.push(`status는 ${IMPORTABLE_STATUSES.join("/")} 중 하나입니다`);
  }
  if ((status === "on_hold" || status === "issue") && !row.statusReason) {
    errors.push("홀드/문제발생 상태는 사유(statusReason)가 필수입니다");
  }
  if (row.statusReason.length > 500) errors.push("사유는 500자 이내입니다");
  if (row.nextAction.length > 500) errors.push("다음 액션은 500자 이내입니다");
  if (helpNamesOf(row.helpUserNames).length > 10) errors.push("도움 주는 사람은 최대 10명입니다");
  return errors;
}

/** 마일스톤 행의 형식 오류 목록(비면 통과). */
export function milestoneRowFormatErrors(row: MilestoneImportRow): string[] {
  const errors: string[] = [];
  if (!row.projectName) errors.push("프로젝트명(projectName)이 비어 있습니다");
  if (!row.title) errors.push("마일스톤명(title)이 비어 있습니다");
  if (!row.dueAt) errors.push("마감(dueAt)이 비어 있습니다");
  else if (!isIsoWithOffset(row.dueAt)) {
    errors.push("마감(dueAt) 날짜 형식 오류 — 예: 2026-07-20 10:00 (또는 날짜만)");
  }
  if (row.riskStatus && !(RISK_STATUSES as readonly string[]).includes(row.riskStatus)) {
    errors.push("riskStatus는 on_track(정상)/at_risk(주의)/late(지연) 중 하나입니다");
  }
  return errors;
}

/** `이예진;황성진` → ["이예진","황성진"] (공백·빈 항목 정리). */
export function helpNamesOf(v: string): string[] {
  return v
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s !== "");
}

// ---------- 샘플 CSV(화면 다운로드용 — data/imports/*.csv와 같은 형식) ----------
// 2행(#)은 컬럼 설명 가이드 — 파서가 무시하므로 그대로 둬도 된다.

export const SAMPLE_TASKS_CSV = `title,assigneeName,clientName,projectName,date,startTime,endTime,priority,estimatedHours,description,status,statusReason,nextAction,helpUserNames,recheckAt
# 작업명(필수),담당자 이름(비우면 본인),클라이언트명(선택·동명 프로젝트 구분용),프로젝트명(비우면 없음),날짜 2026-07-14,시작시간 10:00(비우면 09:00),종료시간 18:00(비우면 예상시간으로 자동·둘 다 없으면 18:00),low/normal/high(기본 normal),예상시간 숫자(0보다),설명,상태(기본 scheduled),사유(홀드/문제 필수),다음 할 일(홀드/문제 권장),도움 주는 사람 이름(여러명 세미콜론),재확인(날짜 또는 날짜+시간)
메인 배너 디자인,이예진,멘딕스,여름 프로모션,2026-07-14,10:00,18:00,high,6,메인/서브 배너 2종,scheduled,,,,
결제 모듈 QA,박승환,에픽게임즈,결제 개선,2026-07-15,09:00,,normal,4,결제 플로우 전체 점검 — 종료시간 생략(예상 4시간으로 자동),in_progress,,,,
랜딩 개발,이혜진,멘딕스,여름 프로모션,2026-07-19,,,high,16,시간 전부 생략(09:00 시작·예상시간 자동),on_hold,디자인 시안 확정 지연,시안 확정 후 재개,이예진;황성진,2026-07-15 10:00
`;

export const SAMPLE_MILESTONES_CSV = `clientName,projectName,title,dueAt,riskStatus
# 클라이언트명(선택·동명 프로젝트 구분용),프로젝트명(필수),마일스톤명(필수),마감 날짜(2026-07-20 — 시간 쓰려면 2026-07-20 10:00),on_track(정상)/at_risk(주의)/late(지연) 기본 on_track
멘딕스,여름 프로모션,프로모션 오픈,2026-07-20,on_track
`;

// ---------- 행별 처리 결과(서버 액션 반환) ----------

export interface ImportRowResult {
  line: number;
  title: string;
  ok: boolean;
  /** ok=true면 부가 정보(예: "홀드 상태로 등록"), ok=false면 실패 사유. */
  message: string;
}

export interface ImportResult {
  fileError?: string;
  results: ImportRowResult[];
  created: number;
  failed: number;
}
