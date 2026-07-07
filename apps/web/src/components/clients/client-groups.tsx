"use client";

import { useState, type DragEvent } from "react";
import { ChevronDown, ChevronUp, GripVertical } from "lucide-react";
import {
  reorderClientsAction,
  updateClientAction,
  updateProjectAction,
} from "@/app/(app)/clients/actions";
import { useSafeAction } from "@/components/app/use-safe-action";
import { ToneBadge } from "@/components/app/tone-badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Client, Project } from "@que/core";

// 클라이언트 미배정을 나타내는 select 센티널 — 서버로는 clientId: null(연결 해제)로 변환한다.
const NO_CLIENT = "__none__";

// 드래그 재정렬 MIME (projects 보드 선례와 동일한 방식의 커스텀 타입).
const DRAG_MIME = "application/x-que-client";

export interface UserOption {
  id: string;
  name: string;
}

export interface ProjectRowData {
  id: string;
  name: string;
  status: Project["status"];
  clientId?: string;
  ownerId: string;
  ownerName: string;
}

export interface ClientGroup {
  id: string;
  name: string;
  status: Client["status"];
  projects: ProjectRowData[];
}

export function ClientGroups({
  clients,
  unassigned,
  clientOptions,
  users,
}: {
  clients: ClientGroup[];
  unassigned: ProjectRowData[];
  clientOptions: { id: string; name: string }[];
  users: UserOption[];
}) {
  const { run, pending } = useSafeAction();
  // 표시 순서의 로컬 상태(id 배열). 서버가 재검증으로 새 목록을 주면 동기화한다.
  const [order, setOrder] = useState<string[]>(() => clients.map((c) => c.id));
  const [dragId, setDragId] = useState<string | null>(null);
  // 서버 목록이 바뀌면(추가/보관/재정렬 확정) 렌더 중 로컬 순서를 맞춘다.
  // (effect+setState 대신 React 권장 "이전 렌더 정보 저장" 패턴 — 연쇄 렌더 없음)
  const serverKey = clients.map((c) => c.id).join(",");
  const [prevKey, setPrevKey] = useState(serverKey);
  if (prevKey !== serverKey) {
    setPrevKey(serverKey);
    setOrder(clients.map((c) => c.id));
  }

  const byId = new Map(clients.map((c) => [c.id, c]));
  const ordered = order.map((id) => byId.get(id)).filter((c): c is ClientGroup => Boolean(c));

  // 낙관적으로 로컬 순서를 먼저 바꾸고, 서버에 확정 요청한다. 실패 시 재검증으로 원복된다.
  const commit = (next: string[]) => {
    setOrder(next);
    run(() => reorderClientsAction({ orderedIds: next }), {
      success: "클라이언트 순서를 바꿨습니다.",
    });
  };

  const moveBy = (id: string, dir: -1 | 1) => {
    const from = order.indexOf(id);
    const to = from + dir;
    if (from < 0 || to < 0 || to >= order.length) return;
    const next = [...order];
    [next[from], next[to]] = [next[to], next[from]];
    commit(next);
  };

  const dropOn = (targetId: string) => {
    const src = dragId;
    setDragId(null);
    if (!src || src === targetId) return;
    const from = order.indexOf(src);
    const to = order.indexOf(targetId);
    if (from < 0 || to < 0) return;
    const next = [...order];
    next.splice(from, 1);
    next.splice(to, 0, src);
    commit(next);
  };

  const hasNothing = clients.length === 0 && unassigned.length === 0;
  if (hasNothing) {
    return (
      <div className="rounded-xl border border-[var(--que-border)] bg-[var(--que-bg)] p-6 text-center text-sm text-[var(--que-text-tertiary)]">
        아직 클라이언트가 없어요. 오른쪽에서 먼저 클라이언트를 등록해 보세요.
      </div>
    );
  }

  const reorderable = ordered.length > 1;

  return (
    <div className="flex flex-col gap-3">
      {ordered.map((c, index) => (
        <ClientCard
          key={c.id}
          client={c}
          clientOptions={clientOptions}
          users={users}
          reorderable={reorderable}
          reorderPending={pending}
          isFirst={index === 0}
          isLast={index === ordered.length - 1}
          isDragging={dragId === c.id}
          onMoveUp={() => moveBy(c.id, -1)}
          onMoveDown={() => moveBy(c.id, 1)}
          onDragStart={() => setDragId(c.id)}
          onDragEnd={() => setDragId(null)}
          onDropOn={() => dropOn(c.id)}
        />
      ))}

      {unassigned.length > 0 && (
        <div className="rounded-xl border border-dashed border-[var(--que-border)] bg-[var(--que-bg)] p-4 shadow-[var(--que-shadow-sm)]">
          <div className="mb-2 flex items-center gap-2">
            <p className="text-sm font-semibold text-[var(--que-text)]">미배정 프로젝트</p>
            <ToneBadge tone="neutral">{unassigned.length}</ToneBadge>
          </div>
          <p className="mb-3 text-xs text-[var(--que-text-tertiary)]">
            클라이언트에 연결되지 않은 내부 프로젝트예요. 아래에서 클라이언트를 지정할 수 있어요.
          </p>
          <div className="flex flex-col gap-2">
            {unassigned.map((p) => (
              <ProjectRow key={p.id} project={p} clientOptions={clientOptions} users={users} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ClientCard({
  client: c,
  clientOptions,
  users,
  reorderable,
  reorderPending,
  isFirst,
  isLast,
  isDragging,
  onMoveUp,
  onMoveDown,
  onDragStart,
  onDragEnd,
  onDropOn,
}: {
  client: ClientGroup;
  clientOptions: { id: string; name: string }[];
  users: UserOption[];
  reorderable: boolean;
  reorderPending: boolean;
  isFirst: boolean;
  isLast: boolean;
  isDragging: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDropOn: () => void;
}) {
  const { run, pending } = useSafeAction();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(c.name);
  // 보관은 전역 클라이언트 필터에 파급되므로 확인 Dialog를 거친다(복구는 즉시).
  const [archiveOpen, setArchiveOpen] = useState(false);

  const archived = c.status === "archived";
  const trimmed = name.trim();

  const handleDragStart = (event: DragEvent) => {
    event.dataTransfer.setData(DRAG_MIME, c.id);
    event.dataTransfer.effectAllowed = "move";
    onDragStart();
  };
  const handleDragOver = (event: DragEvent) => {
    if (!event.dataTransfer.types.includes(DRAG_MIME)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  };
  const handleDrop = (event: DragEvent) => {
    if (!event.dataTransfer.types.includes(DRAG_MIME)) return;
    event.preventDefault();
    onDropOn();
  };

  const saveName = () => {
    if (!trimmed || trimmed.length > 200) return;
    run(() => updateClientAction({ clientId: c.id, name: trimmed }), {
      success: "클라이언트 이름을 바꿨습니다.",
      onSuccess: () => setEditing(false),
    });
  };

  const toggleArchive = () => {
    run(
      () =>
        updateClientAction({ clientId: c.id, status: archived ? "active" : "archived" }),
      {
        success: archived ? "클라이언트를 복구했습니다." : "클라이언트를 보관했습니다.",
        onSuccess: () => setArchiveOpen(false),
      },
    );
  };

  // 편집 중에는 드래그를 끈다 — draggable 부모가 자식 input의 텍스트 선택을 방해하지 않도록.
  const canDrag = reorderable && !editing;

  return (
    <div
      draggable={canDrag}
      onDragStart={canDrag ? handleDragStart : undefined}
      onDragEnd={canDrag ? onDragEnd : undefined}
      onDragOver={reorderable ? handleDragOver : undefined}
      onDrop={reorderable ? handleDrop : undefined}
      data-dragging={isDragging ? "" : undefined}
      className="rounded-xl border border-[var(--que-border)] bg-[var(--que-bg)] p-4 shadow-[var(--que-shadow-sm)] data-[dragging]:opacity-50"
    >
      <div className="flex flex-wrap items-center gap-2">
        {reorderable && (
          <div className="flex items-center gap-1">
            <span
              className="hidden cursor-grab text-[var(--que-text-tertiary)] active:cursor-grabbing sm:flex"
              aria-hidden
              title="드래그해서 순서 변경"
            >
              <GripVertical className="size-4" />
            </span>
            {/* 터치(태블릿) 대응 — 드래그 대신 40px 버튼으로 한 칸씩 이동한다 */}
            <button
              type="button"
              aria-label={`${c.name} 위로 이동`}
              disabled={isFirst || reorderPending}
              onClick={onMoveUp}
              className="flex size-10 items-center justify-center rounded-lg border border-[var(--que-border)] text-[var(--que-text-secondary)] hover:bg-[var(--que-bg-muted)] disabled:opacity-30"
            >
              <ChevronUp className="size-4" />
            </button>
            <button
              type="button"
              aria-label={`${c.name} 아래로 이동`}
              disabled={isLast || reorderPending}
              onClick={onMoveDown}
              className="flex size-10 items-center justify-center rounded-lg border border-[var(--que-border)] text-[var(--que-text-secondary)] hover:bg-[var(--que-bg-muted)] disabled:opacity-30"
            >
              <ChevronDown className="size-4" />
            </button>
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-semibold text-[var(--que-text)]">{c.name}</p>
            <ToneBadge tone={archived ? "neutral" : "green"}>
              {archived ? "보관" : "활성"}
            </ToneBadge>
          </div>
          <p className="mt-0.5 text-xs text-[var(--que-text-tertiary)]">
            프로젝트 {c.projects.length}개
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            className="h-10"
            disabled={pending}
            onClick={() => setEditing((v) => !v)}
          >
            {editing ? "닫기" : "이름 수정"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-10"
            disabled={pending}
            onClick={archived ? toggleArchive : () => setArchiveOpen(true)}
          >
            {archived ? "복구" : "보관"}
          </Button>
        </div>
      </div>

      {editing && (
        <div className="mt-2.5 flex flex-wrap items-end gap-2 border-t border-[var(--que-border)] pt-2.5">
          <label className="flex flex-1 flex-col gap-1 text-xs text-[var(--que-text-secondary)]">
            이름
            <Input
              value={name}
              aria-invalid={trimmed.length > 200}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <Button
            className="h-10"
            disabled={pending || !trimmed || trimmed.length > 200}
            onClick={saveName}
          >
            {pending ? "저장 중…" : "저장"}
          </Button>
        </div>
      )}

      <div className="mt-3 flex flex-col gap-2">
        {c.projects.length === 0 ? (
          <p className="py-2 text-center text-xs text-[var(--que-text-tertiary)]">
            소속 프로젝트가 없어요.
          </p>
        ) : (
          c.projects.map((p) => (
            <ProjectRow key={p.id} project={p} clientOptions={clientOptions} users={users} />
          ))
        )}
      </div>

      {/* 보관 확인 — 전역 파급효과를 사전에 설명한다(결제 분류 보관 안내와 동일 수준). */}
      <Dialog open={archiveOpen} onOpenChange={setArchiveOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{c.name} 보관</DialogTitle>
            <DialogDescription>
              보관하면 전체 화면의 클라이언트 필터에서 숨겨지고, 새 프로젝트에 배정할 수
              없습니다. 이미 연결된 프로젝트는 그대로 유지되며, 언제든 복구할 수 있습니다.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" className="h-10" />}>
              취소
            </DialogClose>
            <Button className="h-10" disabled={pending} onClick={toggleArchive}>
              {pending ? "보관 중…" : "보관"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ProjectRow({
  project: p,
  clientOptions,
  users,
}: {
  project: ProjectRowData;
  clientOptions: { id: string; name: string }[];
  users: UserOption[];
}) {
  const { run, pending } = useSafeAction();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(p.name);
  const [clientId, setClientId] = useState<string>(p.clientId ?? NO_CLIENT);
  const [ownerId, setOwnerId] = useState(p.ownerId);
  const [status, setStatus] = useState<Project["status"]>(p.status);

  // base-ui Select는 items(value→label)가 있어야 트리거에 라벨을 표시한다(없으면 raw value 노출).
  const clientItems: Record<string, string> = {
    [NO_CLIENT]: "미배정 (내부)",
    ...Object.fromEntries(clientOptions.map((c) => [c.id, c.name])),
  };
  const userItems = Object.fromEntries(users.map((u) => [u.id, u.name]));
  const statusItems: Record<string, string> = { active: "진행", archived: "보관" };

  const archived = p.status === "archived";
  const trimmed = name.trim();

  const save = () => {
    if (!trimmed || trimmed.length > 200) return;
    run(
      () =>
        updateProjectAction({
          projectId: p.id,
          name: trimmed,
          status,
          clientId: clientId === NO_CLIENT ? null : clientId,
          ownerId,
        }),
      { success: "프로젝트를 수정했습니다.", onSuccess: () => setEditing(false) },
    );
  };

  return (
    <div className="rounded-lg border border-[var(--que-border)] px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-[var(--que-text)]">{p.name}</p>
          <p className="truncate text-xs text-[var(--que-text-tertiary)]">
            담당 {p.ownerName}
          </p>
        </div>
        <ToneBadge tone={archived ? "neutral" : "green"}>
          {archived ? "보관" : "진행"}
        </ToneBadge>
        <Button
          variant="outline"
          size="sm"
          className="h-10"
          disabled={pending}
          onClick={() => setEditing((v) => !v)}
        >
          {editing ? "닫기" : "수정"}
        </Button>
      </div>

      {editing && (
        <div className="mt-2.5 flex flex-col gap-2.5 border-t border-[var(--que-border)] pt-2.5">
          <label className="flex flex-col gap-1 text-xs text-[var(--que-text-secondary)]">
            이름
            <Input
              value={name}
              aria-invalid={trimmed.length > 200}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <label className="flex min-w-40 flex-1 flex-col gap-1 text-xs text-[var(--que-text-secondary)]">
              클라이언트
              <Select items={clientItems} value={clientId} onValueChange={(v) => v && setClientId(v)}>
                <SelectTrigger aria-label="클라이언트 재배정" className="h-10 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_CLIENT}>미배정 (내부)</SelectItem>
                  {clientOptions.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            <label className="flex min-w-32 flex-1 flex-col gap-1 text-xs text-[var(--que-text-secondary)]">
              담당자
              <Select items={userItems} value={ownerId} onValueChange={(v) => v && setOwnerId(v)}>
                <SelectTrigger aria-label="담당자 변경" className="h-10 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            <label className="flex min-w-28 flex-col gap-1 text-xs text-[var(--que-text-secondary)]">
              상태
              <Select
                items={statusItems}
                value={status}
                onValueChange={(v) => v && setStatus(v as Project["status"])}
              >
                <SelectTrigger aria-label="프로젝트 상태" className="h-10 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">진행</SelectItem>
                  <SelectItem value="archived">보관</SelectItem>
                </SelectContent>
              </Select>
            </label>
          </div>
          <div className="flex justify-end">
            <Button
              className="h-10"
              disabled={pending || !trimmed || trimmed.length > 200}
              onClick={save}
            >
              {pending ? "저장 중…" : "저장"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
