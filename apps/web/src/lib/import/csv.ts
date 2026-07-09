// CSV 일괄 가져오기 — 파싱·행 스키마·형식 검증 (순수 모듈, 클라/서버 공용)
// 템플릿 정본: data/imports/*.csv (이름 기반 — 담당자·클라이언트·프로젝트를 '이름'으로 적고
// 서버 액션이 실제 id로 해석한다). `#`로 시작하는 행(가이드)과 빈 행은 무시한다.
// ⚠️ "use client" 금지 — 서버 액션이 같은 값을 import한다(projects-scope.ts 선례).

// ---------- 상수 ----------

/** 한 번에 가져올 수 있는 최대 데이터 행 수(폭주 방지). */
export const IMPORT_MAX_ROWS = 200;

/** 작업 CSV 헤더(순서 무관 — 이름으로 매핑). data/imports/tasks-sample.csv와 1:1. */
export const TASK_HEADERS = [
  "title",
  "assigneeName",
  "clientName",
  "projectName",
  "startAt",
  "endAt",
  "priority",
  "estimatedHours",
  "description",
  "status",
  "statusReason",
  "nextAction",
  "helpUserNames",
  "recheckAt",
] as const;

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
  startAt: string;
  endAt: string;
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
  return parseWithHeaders(text, TASK_HEADERS, (get, line) => ({
    line,
    title: get("title"),
    assigneeName: get("assigneeName"),
    clientName: get("clientName"),
    projectName: get("projectName"),
    startAt: get("startAt"),
    endAt: get("endAt"),
    priority: get("priority"),
    estimatedHours: get("estimatedHours"),
    description: get("description"),
    status: get("status"),
    statusReason: get("statusReason"),
    nextAction: get("nextAction"),
    helpUserNames: get("helpUserNames"),
    recheckAt: get("recheckAt"),
  }));
}

export function parseMilestonesCsv(text: string): ParseResult<MilestoneImportRow> {
  return parseWithHeaders(text, MILESTONE_HEADERS, (get, line) => ({
    line,
    clientName: get("clientName"),
    projectName: get("projectName"),
    title: get("title"),
    dueAt: get("dueAt"),
    riskStatus: get("riskStatus"),
  }));
}

// ---------- 형식 검증(이름 해석 전 — 값만으로 판정 가능한 것) ----------

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
  for (const [field, label] of [
    ["startAt", "시작"],
    ["endAt", "종료"],
    ["recheckAt", "재확인"],
  ] as const) {
    const v = row[field];
    if (v && !isIsoWithOffset(v)) {
      errors.push(`${label}(${field}) 날짜 형식 오류 — 예: 2026-07-14T10:00:00+09:00`);
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
    errors.push("마감(dueAt) 날짜 형식 오류 — 예: 2026-07-20T10:00:00+09:00");
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

export const SAMPLE_TASKS_CSV = `title,assigneeName,clientName,projectName,startAt,endAt,priority,estimatedHours,description,status,statusReason,nextAction,helpUserNames,recheckAt
# 작업명(필수),담당자 이름(비우면 본인),클라이언트명(선택·동명 프로젝트 구분용),프로젝트명(비우면 없음),시작 ISO(+09:00),종료 ISO(시작 이후),low/normal/high(기본 normal),예상시간 숫자(0보다),설명,상태(기본 scheduled),사유(홀드/문제 필수),다음 할 일(홀드/문제 권장),도움 주는 사람 이름(여러명 세미콜론),재확인 ISO(홀드/문제 권장)
메인 배너 디자인,이예진,멘딕스,여름 프로모션,2026-07-14T10:00:00+09:00,2026-07-14T18:00:00+09:00,high,6,메인/서브 배너 2종,scheduled,,,,
랜딩 개발,이혜진,멘딕스,여름 프로모션,2026-07-19T10:00:00+09:00,2026-07-21T18:00:00+09:00,high,16,퍼블리싱+개발,on_hold,디자인 시안 확정 지연,시안 확정 후 재개,이예진;황성진,2026-07-15T10:00:00+09:00
`;

export const SAMPLE_MILESTONES_CSV = `clientName,projectName,title,dueAt,riskStatus
# 클라이언트명(선택·동명 프로젝트 구분용),프로젝트명(필수),마일스톤명(필수),마감 ISO(+09:00),on_track(정상)/at_risk(주의)/late(지연) 기본 on_track
멘딕스,여름 프로모션,프로모션 오픈,2026-07-20T10:00:00+09:00,on_track
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
