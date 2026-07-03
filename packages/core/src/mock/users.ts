import type { User } from "../domain";

// 기획서 "초기 멤버 명단" 8명. 황성현은 대표/관리자.
export const USERS: User[] = [
  { id: "hwang-sunghyeon", name: "황성현", role: "admin", avatarColor: "#2563eb" },
  { id: "oh-seunghoon", name: "오승훈", role: "member", avatarColor: "#16a34a" },
  { id: "hwang-sungjin", name: "황성진", role: "member", avatarColor: "#d97706" },
  { id: "park-seunghwan", name: "박승환", role: "member", avatarColor: "#dc2626" },
  { id: "song-suyong", name: "송수용", role: "member", avatarColor: "#7c3aed" },
  { id: "lee-yejin", name: "이예진", role: "member", avatarColor: "#0891b2" },
  { id: "kim-riwon", name: "김리원", role: "member", avatarColor: "#db2777" },
  { id: "lee-hyejin", name: "이혜진", role: "member", avatarColor: "#65a30d" },
];

export const DEFAULT_USER_ID = USERS[0].id;

export function findUser(id: string | undefined): User | undefined {
  return USERS.find((user) => user.id === id);
}

// ---------- 인증(실 로그인) 관련 ----------
// 사용자 id는 `<성>-<이름>` 규칙 → 이메일은 `<이름>.<성>@griff.co.kr` (대표 실제 이메일과 동일 패턴).
// 시드/mock 로그인/Supabase 인증이 같은 유도 규칙을 공유하도록 core에 둔다.
export function emailForUser(id: string): string {
  const [family, ...rest] = id.split("-");
  return `${rest.join("")}.${family}@griff.co.kr`;
}

/** 로컬 mock 개발 + 초기 배포용 공용 임시 비밀번호. 실 운영에선 사용자별 변경이 후속(강제 변경 플로우 = B2). */
export const DEV_PASSWORD = "que-2026!";

/** DEV_PASSWORD의 bcrypt(10) 해시 — 시드가 8명에 동일하게 넣는다(재시드 시 auth 컬럼 유지용). */
export const SEED_PASSWORD_HASH =
  "$2b$10$vaQFbujUi6Adz/jWcHknH.PcIbImnBo6s67oWsVkDkx8y.NxDbvcW";
