import type { RevisionNote } from "@que/core";
import { getDb } from "./db";

// 수정사항(이슈/피드백) 트래커 조회 — 최신순. 작성자/변경자 id를 사람이 읽을 이름으로 매핑한다.
// 팀 공용 목록이라 별도 권한 필터 없이 전부 돌려준다(인증만 필요, 페이지가 게이트).

export interface RevisionNoteRow extends RevisionNote {
  /** 작성자 표시 이름 (db.users에서 매핑, 없으면 폴백) */
  authorName: string;
  /** 마지막 상태 변경자 표시 이름 (변경 이력 있을 때만) */
  updatedByName?: string;
}

export async function getRevisionNotes(): Promise<RevisionNoteRow[]> {
  const db = await getDb();
  const nameOf = (id: string | undefined): string | undefined =>
    id ? db.users.find((u) => u.id === id)?.name : undefined;

  return [...db.revisionNotes]
    // createdAt은 ISO 8601 문자열이라 사전식 비교가 곧 시간 역순(최신 우선)이다.
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((note) => ({
      ...note,
      authorName: nameOf(note.authorId) ?? "알 수 없음",
      updatedByName: nameOf(note.updatedBy),
    }));
}
