"use client";

import { useRef, useState } from "react";
import { Paperclip, X } from "lucide-react";
import { extractMeetingDateTime } from "@que/core";
import { uploadMeetingNoteAction } from "@/app/(app)/meeting-notes/actions";
import { useRoster } from "@/components/app/roster-provider";
import { useSafeAction } from "@/components/app/use-safe-action";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** 프로젝트 선택 옵션 — name은 "클라이언트 · 프로젝트" 병기 라벨(조립은 서버에서). */
export interface UploadNoteProjectOption {
  id: string;
  name: string;
}

/** Plaud Note MD 업로드 폼. 파일 내용은 클라이언트에서 읽어 서버 액션으로 넘긴다. */
export function UploadNoteForm({ projects }: { projects: UploadNoteProjectOption[] }) {
  const roster = useRoster();
  const fileRef = useRef<HTMLInputElement>(null);
  const { run, pending } = useSafeAction();
  const [title, setTitle] = useState("");
  // 다중 프로젝트(주간회의 등 여러 건 걸침) — 드롭다운에서 골라 칩으로 쌓고 X로 제거.
  const [projectIds, setProjectIds] = useState<string[]>([]);
  const [meetingDateTime, setMeetingDateTime] = useState(() => {
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, "0");
    // datetime-local 형식: YYYY-MM-DDTHH:mm. 기본 시각은 정시로 맞춤.
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:00`;
  });
  const [attendeeIds, setAttendeeIds] = useState<string[]>([]);
  const [fileName, setFileName] = useState("");
  const [markdownBody, setMarkdownBody] = useState("");
  const [visibility, setVisibility] = useState<"team" | "project" | "admin" | "restricted">(
    "team",
  );
  const [restrictedUserIds, setRestrictedUserIds] = useState<string[]>([]);

  const onFileChange = async (file: File | undefined) => {
    if (!file) return;
    setFileName(file.name);
    const text = await file.text();
    setMarkdownBody(text);
    if (!title) setTitle(file.name.replace(/\.md$/i, ""));
    // 본문에서 회의 일시를 찾으면 기본값을 채운다(못 찾으면 기존 기본값 유지).
    // 자동 등록이 아니라 폼 기본값 제안이므로 사용자가 그대로 수정할 수 있다.
    const draft = extractMeetingDateTime(text);
    if (draft) setMeetingDateTime(draft.dateTime);
  };

  const missing: string[] = [];
  if (!fileName || !markdownBody) missing.push("파일");
  if (!title.trim()) missing.push("회의명");
  if (visibility === "restricted" && restrictedUserIds.length === 0) missing.push("열람 인원");

  const canSubmit = missing.length === 0 && !pending;

  const submit = () => {
    run(
      () =>
        uploadMeetingNoteAction({
          title,
          projectIds: projectIds.length ? projectIds : undefined,
          meetingDateTime,
          attendeeIds,
          fileName,
          markdownBody,
          visibility,
          restrictedUserIds: visibility === "restricted" ? restrictedUserIds : undefined,
        }),
      {
        success: `"${title}" 회의록이 업로드됐습니다. Action 추출 대기 상태입니다.`,
        onSuccess: () => {
          setTitle("");
          setProjectIds([]);
          setFileName("");
          setMarkdownBody("");
          setAttendeeIds([]);
          setVisibility("team");
          setRestrictedUserIds([]);
          if (fileRef.current) fileRef.current.value = "";
        },
      },
    );
  };

  return (
    <section className="flex h-fit flex-col rounded-xl border border-[var(--que-border)] bg-[var(--que-bg)]">
      <header className="border-b border-[var(--que-border)] px-4 py-3">
        <h2 className="text-base font-semibold text-[var(--que-text)]">회의록 업로드</h2>
      </header>
      <div className="flex flex-col gap-3 p-4">
        <Field>
          <FieldLabel htmlFor="note-file">
            Markdown 파일 (Plaud Note 내보내기) <span className="text-[var(--que-error)]">*</span>
          </FieldLabel>
          {/* 네이티브 file input은 숨기고, 아이콘·텍스트가 수직 정렬된 버튼으로 여닫는다(정렬 어긋남 수정). */}
          <input
            id="note-file"
            ref={fileRef}
            type="file"
            accept=".md,.markdown,.txt"
            className="sr-only"
            onChange={(e) => onFileChange(e.target.files?.[0])}
          />
          <Button
            type="button"
            variant="outline"
            className="h-11 w-full justify-start gap-2 font-normal"
            onClick={() => fileRef.current?.click()}
          >
            <Paperclip className="size-4 shrink-0" aria-hidden />
            <span className="truncate">{fileName || "Markdown 파일 선택"}</span>
          </Button>
          {fileName ? (
            <p className="text-xs text-[var(--que-success)]">
              {fileName} · {markdownBody.length.toLocaleString()}자 읽음
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              .md / .markdown / .txt 파일을 선택하세요. 회의명은 파일명으로 자동 채워집니다.
            </p>
          )}
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field>
            <FieldLabel htmlFor="note-title">회의명</FieldLabel>
            <Input id="note-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <Field>
            <FieldLabel htmlFor="note-date">회의 일시</FieldLabel>
            <Input
              id="note-date"
              type="datetime-local"
              // 다크모드에서 네이티브 달력 아이콘이 검정으로 안 보이는 문제 — color-scheme:dark로 밝게 렌더.
              className="dark:[color-scheme:dark]"
              value={meetingDateTime}
              onChange={(e) => setMeetingDateTime(e.target.value)}
            />
          </Field>
        </div>
        <Field>
          <FieldLabel>
            프로젝트 (복수 선택)
            {projectIds.length > 0 && (
              <span className="ml-1 font-normal text-muted-foreground">
                · {projectIds.length}개 선택
              </span>
            )}
          </FieldLabel>
          {projectIds.length > 0 && (
            <div className="mb-1.5 flex flex-wrap gap-1.5">
              {projectIds.map((id) => {
                const project = projects.find((p) => p.id === id);
                if (!project) return null;
                return (
                  <span
                    key={id}
                    className="flex items-center gap-1 rounded-full bg-muted py-1 pr-1 pl-2.5 text-sm"
                  >
                    {project.name}
                    <button
                      type="button"
                      aria-label={`${project.name} 제거`}
                      onClick={() => setProjectIds((prev) => prev.filter((x) => x !== id))}
                      className="grid size-5 place-items-center rounded-full hover:bg-border"
                    >
                      <X className="size-3.5" aria-hidden />
                    </button>
                  </span>
                );
              })}
            </div>
          )}
          <Select
            items={Object.fromEntries(
              projects.filter((p) => !projectIds.includes(p.id)).map((p) => [p.id, p.name]),
            )}
            value=""
            onValueChange={(v) => {
              if (v) setProjectIds((prev) => (prev.includes(v as string) ? prev : [...prev, v as string]));
            }}
            disabled={projects.every((p) => projectIds.includes(p.id))}
          >
            <SelectTrigger aria-label="프로젝트 추가" className="h-11 w-full">
              <SelectValue
                placeholder={
                  projects.every((p) => projectIds.includes(p.id))
                    ? "모두 추가됨"
                    : "선택 안 함 (프로젝트 추가)"
                }
              />
            </SelectTrigger>
            <SelectContent>
              {projects
                .filter((p) => !projectIds.includes(p.id))
                .map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <div className="flex items-center justify-between gap-2">
            <FieldLabel>
              참석자 (복수 선택)
              {attendeeIds.length > 0 && (
                <span className="ml-1 font-normal text-muted-foreground">
                  · {attendeeIds.length}명 선택
                </span>
              )}
            </FieldLabel>
            <button
              type="button"
              className="inline-flex h-8 items-center rounded-md px-2 text-xs font-medium text-[var(--que-brand)] hover:bg-[var(--que-bg-muted)]"
              onClick={() =>
                setAttendeeIds((prev) =>
                  prev.length === roster.length ? [] : roster.map((u) => u.id),
                )
              }
            >
              {attendeeIds.length === roster.length ? "전체 해제" : "전체 선택"}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-1 sm:grid-cols-3">
            {roster.map((user) => {
              const checked = attendeeIds.includes(user.id);
              return (
                <label
                  key={user.id}
                  className={`flex h-11 cursor-pointer items-center gap-2 rounded-md border px-3 text-sm transition-colors ${
                    checked
                      ? "border-[var(--que-brand)] bg-[var(--que-brand-subtle)]"
                      : "border-[var(--que-border)] hover:bg-[var(--que-bg-muted)]"
                  }`}
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(c) =>
                      setAttendeeIds((prev) =>
                        c ? [...prev, user.id] : prev.filter((id) => id !== user.id),
                      )
                    }
                    aria-label={`참석자 ${user.name}`}
                  />
                  {user.name}
                </label>
              );
            })}
          </div>
        </Field>
        <Field>
          <FieldLabel>공개 범위</FieldLabel>
          <Select
            items={{
              team: "팀 전체",
              admin: "관리자만",
              restricted: "지정 인원만",
            }}
            value={visibility}
            onValueChange={(v) => {
              if (!v) return;
              setVisibility(v as typeof visibility);
              if (v !== "restricted") setRestrictedUserIds([]);
            }}
          >
            <SelectTrigger aria-label="공개 범위 선택">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="team">팀 전체</SelectItem>
              <SelectItem value="admin">관리자만</SelectItem>
              <SelectItem value="restricted">지정 인원만</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        {visibility === "restricted" && (
          <Field>
            <FieldLabel>열람 가능 인원 (관리자는 항상 열람 가능)</FieldLabel>
            <div className="grid grid-cols-4 gap-2">
              {roster.map((user) => (
                <label key={user.id} className="flex h-10 items-center gap-2 text-sm">
                  <Checkbox
                    checked={restrictedUserIds.includes(user.id)}
                    onCheckedChange={(checked) =>
                      setRestrictedUserIds((prev) =>
                        checked ? [...prev, user.id] : prev.filter((id) => id !== user.id),
                      )
                    }
                    aria-label={`열람 허용 ${user.name}`}
                  />
                  {user.name}
                </label>
              ))}
            </div>
            {restrictedUserIds.length === 0 && (
              <p className="text-xs text-[var(--que-error)]">1명 이상 지정해야 합니다.</p>
            )}
          </Field>
        )}
        <div className="sticky bottom-0 -mx-4 -mb-4 mt-1 flex flex-col gap-2 border-t border-[var(--que-border)] bg-[var(--que-bg)] px-4 py-3">
          <Button
            className="h-11 w-full rounded-lg bg-[var(--que-brand)] text-[var(--que-on-brand)] hover:bg-[var(--que-brand-hover)]"
            disabled={!canSubmit}
            onClick={submit}
          >
            {pending ? "업로드 중…" : "회의록 업로드"}
          </Button>
          {!pending && missing.length > 0 && (
            <p className="text-center text-xs text-muted-foreground">
              {missing.join(" · ")}을(를) 입력하면 업로드할 수 있습니다.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
