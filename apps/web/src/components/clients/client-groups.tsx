"use client";

import { useState } from "react";
import { updateClientAction, updateProjectAction } from "@/app/(app)/clients/actions";
import { useSafeAction } from "@/components/app/use-safe-action";
import { ToneBadge } from "@/components/app/tone-badge";
import { Button } from "@/components/ui/button";
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
  const hasNothing = clients.length === 0 && unassigned.length === 0;
  if (hasNothing) {
    return (
      <div className="rounded-xl border border-[var(--que-border)] bg-[var(--que-bg)] p-6 text-center text-sm text-[var(--que-text-tertiary)]">
        아직 클라이언트가 없어요. 오른쪽에서 먼저 클라이언트를 등록해 보세요.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {clients.map((c) => (
        <ClientCard
          key={c.id}
          client={c}
          clientOptions={clientOptions}
          users={users}
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
}: {
  client: ClientGroup;
  clientOptions: { id: string; name: string }[];
  users: UserOption[];
}) {
  const { run, pending } = useSafeAction();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(c.name);

  const archived = c.status === "archived";
  const trimmed = name.trim();

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
      { success: archived ? "클라이언트를 복구했습니다." : "클라이언트를 보관했습니다." },
    );
  };

  return (
    <div className="rounded-xl border border-[var(--que-border)] bg-[var(--que-bg)] p-4 shadow-[var(--que-shadow-sm)]">
      <div className="flex flex-wrap items-center gap-2">
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
            className="h-9"
            disabled={pending}
            onClick={() => setEditing((v) => !v)}
          >
            {editing ? "닫기" : "이름 수정"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-9"
            disabled={pending}
            onClick={toggleArchive}
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
          className="h-9"
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
