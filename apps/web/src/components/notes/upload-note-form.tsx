"use client";

import { useRef, useState } from "react";
import { USERS, type Project } from "@que/core";
import { uploadMeetingNoteAction } from "@/app/(app)/meeting-notes/actions";
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

/** Plaud Note MD 업로드 폼. 파일 내용은 클라이언트에서 읽어 서버 액션으로 넘긴다. */
export function UploadNoteForm({ projects }: { projects: Project[] }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const { run, pending } = useSafeAction();
  const [title, setTitle] = useState("");
  const [projectId, setProjectId] = useState("");
  const [meetingDate, setMeetingDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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
    setMarkdownBody(await file.text());
    if (!title) setTitle(file.name.replace(/\.md$/i, ""));
  };

  const canSubmit =
    title.trim() &&
    fileName &&
    markdownBody &&
    !pending &&
    (visibility !== "restricted" || restrictedUserIds.length > 0);

  const submit = () => {
    run(
      () =>
        uploadMeetingNoteAction({
          title,
          projectId: projectId || undefined,
          meetingDate,
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
          <FieldLabel htmlFor="note-file">Markdown 파일 (Plaud Note 내보내기)</FieldLabel>
          <Input
            id="note-file"
            ref={fileRef}
            type="file"
            accept=".md,.markdown,.txt"
            onChange={(e) => onFileChange(e.target.files?.[0])}
          />
          {fileName && (
            <p className="text-xs text-muted-foreground">
              {fileName} · {markdownBody.length.toLocaleString()}자 읽음
            </p>
          )}
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field>
            <FieldLabel htmlFor="note-title">회의명</FieldLabel>
            <Input id="note-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <Field>
            <FieldLabel htmlFor="note-date">회의일</FieldLabel>
            <Input
              id="note-date"
              type="date"
              value={meetingDate}
              onChange={(e) => setMeetingDate(e.target.value)}
            />
          </Field>
        </div>
        <Field>
          <FieldLabel>프로젝트</FieldLabel>
          <Select
            items={Object.fromEntries(projects.map((p) => [p.id, p.name]))}
            value={projectId}
            onValueChange={(v) => setProjectId(v ?? "")}
          >
            <SelectTrigger aria-label="프로젝트 선택">
              <SelectValue placeholder="선택 안 함" />
            </SelectTrigger>
            <SelectContent>
              {projects.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  {project.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel>참석자</FieldLabel>
          <div className="grid grid-cols-4 gap-2">
            {USERS.map((user) => (
              <label key={user.id} className="flex h-10 items-center gap-2 text-sm">
                <Checkbox
                  checked={attendeeIds.includes(user.id)}
                  onCheckedChange={(checked) =>
                    setAttendeeIds((prev) =>
                      checked ? [...prev, user.id] : prev.filter((id) => id !== user.id),
                    )
                  }
                  aria-label={`참석자 ${user.name}`}
                />
                {user.name}
              </label>
            ))}
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
              {USERS.map((user) => (
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
        <Button
          className="h-10 rounded-lg bg-[var(--que-brand)] text-[var(--que-on-brand)] hover:bg-[var(--que-brand-hover)]"
          disabled={!canSubmit}
          onClick={submit}
        >
          {pending ? "업로드 중…" : "업로드"}
        </Button>
      </div>
    </section>
  );
}
