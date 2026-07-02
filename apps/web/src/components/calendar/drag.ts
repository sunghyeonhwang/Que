// HTML5 drag & drop 페이로드 공유 헬퍼. 세 뷰(기본형/전체 멤버/타임라인)가 같이 쓴다.

export interface DragPayload {
  kind: "task" | "event" | "milestone";
  id: string;
  ownerId?: string;
}

const MIME = "application/x-que-item";

export function setDragPayload(e: React.DragEvent, payload: DragPayload): void {
  e.dataTransfer.setData(MIME, JSON.stringify(payload));
  e.dataTransfer.effectAllowed = "move";
}

export function getDragPayload(e: React.DragEvent): DragPayload | null {
  const raw = e.dataTransfer.getData(MIME);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as DragPayload;
  } catch {
    return null;
  }
}
