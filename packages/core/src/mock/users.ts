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
