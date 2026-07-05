import type { User } from "../domain";

// 기획서 "초기 멤버 명단" 8명. 황성현은 대표/관리자.
export const USERS: User[] = [
  { id: "hwang-sunghyeon", name: "황성현", role: "admin", avatarColor: "#2563eb" },
  { id: "oh-seunghoon", name: "오승훈", role: "admin", avatarColor: "#16a34a" }, // 직급 '관리' → 관리자
  { id: "hwang-sungjin", name: "황성진", role: "member", avatarColor: "#d97706" },
  { id: "park-seunghwan", name: "박승환", role: "member", avatarColor: "#dc2626" },
  { id: "song-suyong", name: "송수용", role: "member", avatarColor: "#7c3aed" },
  { id: "lee-yejin", name: "이예진", role: "member", avatarColor: "#0891b2" },
  { id: "kim-riwon", name: "김리원", role: "member", avatarColor: "#db2777" },
  { id: "lee-hyejin", name: "이혜진", role: "member", avatarColor: "#0d9488" },
];

export const DEFAULT_USER_ID = USERS[0].id;

export function findUser(id: string | undefined): User | undefined {
  return USERS.find((user) => user.id === id);
}

// ---------- 인증(실 로그인) 관련 ----------
// 실제 회사 이메일(영어이름@griff.co.kr). 출처: data/docs/que-user-info.md.
// id의 로마자 표기가 실제와 다른 경우가 있어(예: oh-seunghoon→seunghun.oh) 유도가 아니라 명시 맵으로 둔다.
// 시드/mock 로그인/Supabase 인증이 이 맵을 공유한다.
const USER_EMAILS: Record<string, string> = {
  "hwang-sunghyeon": "sunghyeon.hwang@griff.co.kr",
  "oh-seunghoon": "seunghun.oh@griff.co.kr",
  "song-suyong": "suyong.song@griff.co.kr",
  "hwang-sungjin": "seongjin.hwang@griff.co.kr",
  "lee-yejin": "yejin.lee@griff.co.kr",
  "park-seunghwan": "seunghwan.park@griff.co.kr",
  "kim-riwon": "riwon.kim@griff.co.kr",
  "lee-hyejin": "hyejin.lee@griff.co.kr",
};

export function emailForUser(id: string): string {
  if (USER_EMAILS[id]) return USER_EMAILS[id];
  // 폴백: id `<성>-<이름>` → `<이름>.<성>@griff.co.kr`
  const [family, ...rest] = id.split("-");
  return `${rest.join("")}.${family}@griff.co.kr`;
}

// 직급(직책) — 팀원 카드 표시용. 출처: data/docs/que-user-info.md.
// 전화·생년월일은 PII라 코드에 두지 않는다(필요 시 DB 컬럼으로).
const USER_RANK: Record<string, string> = {
  "hwang-sunghyeon": "대표",
  "oh-seunghoon": "관리",
  "hwang-sungjin": "사원",
  "park-seunghwan": "사원",
  "song-suyong": "사원",
  "lee-yejin": "사원",
  "kim-riwon": "사원",
  "lee-hyejin": "사원",
};

export function rankForUser(id: string): string {
  return USER_RANK[id] ?? "사원";
}

// 직급(grade) — 홈·성과 화면의 스코프 판정용. role(admin/member)은 쓰기 권한 전용이라
// 그대로 두고, "누구의 작업/부하가 보이는가"는 이 grade로 판정한다. USER_RANK가 유일한 소스 —
// 문자열 rank("대표"/"관리")를 화면·데이터 계층에서 직접 비교하지 말고 반드시 이 헬퍼로 감싼다.
export type UserGrade = "ceo" | "manager" | "staff";

export function gradeForUser(id: string): UserGrade {
  const rank = USER_RANK[id];
  if (rank === "대표") return "ceo";
  if (rank === "관리") return "manager";
  return "staff";
}

// 성과 "사람 위젯"(히트맵 rows·부하표) 스코프. 뷰어의 grade에서만 유도한다 —
// 대표=전원, 관리자=대표 제외 전원, 사원=본인. 세션 사용자 id로만 호출하고 URL 파라미터로
// 넓힐 수 없게 한다(웹/MCP/CLI가 공유하는 방어 지점). KPI·완료율·추이·프로젝트 진행률에는
// 적용하지 않는다(그건 전원 동일; 사원 KPI만 별도로 본인 스코프).
export function personScopeForGrade(viewerId: string): string[] {
  const grade = gradeForUser(viewerId);
  if (grade === "ceo") return USERS.map((u) => u.id);
  if (grade === "manager") {
    return USERS.filter((u) => gradeForUser(u.id) !== "ceo").map((u) => u.id);
  }
  return [viewerId];
}

// 부서 — 성과 화면(저성과 팀 표) 표시용. ⚠️ 임시 placeholder — 실제 값은 사용자 제공 후 교체.
// (que-user-info.md엔 부서가 없어 임시 배정. DB 컬럼화는 실제 값 확정 시.)
const USER_DEPARTMENT: Record<string, string> = {
  "hwang-sunghyeon": "경영",
  "oh-seunghoon": "운영",
  "hwang-sungjin": "개발",
  "park-seunghwan": "개발",
  "song-suyong": "디자인",
  "lee-yejin": "디자인",
  "kim-riwon": "기획",
  "lee-hyejin": "디자인",
};

export function departmentForUser(id: string): string {
  return USER_DEPARTMENT[id] ?? "";
}

/** 로컬 mock 개발 + 초기 배포용 공용 임시 비밀번호. 실 운영에선 사용자별 변경이 후속(강제 변경 플로우 = B2). */
export const DEV_PASSWORD = "que-2026!";

/** DEV_PASSWORD의 bcrypt(10) 해시 — 시드가 8명에 동일하게 넣는다(재시드 시 auth 컬럼 유지용). */
export const SEED_PASSWORD_HASH =
  "$2b$10$vaQFbujUi6Adz/jWcHknH.PcIbImnBo6s67oWsVkDkx8y.NxDbvcW";
