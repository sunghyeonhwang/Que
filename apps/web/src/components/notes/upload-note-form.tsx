"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { USERS, type Project } from "@que/core";
import { uploadMeetingNoteAction } from "@/app/(app)/meeting-notes/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState("");
  const [projectId, setProjectId] = useState("");
  const [meetingDate, setMeetingDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
  const [attendeeIds, setAttendeeIds] = useState<string[]>([]);
  const [fileName, setFileName] = useState("");
  const [markdownBody, setMarkdownBody] = useState("");

  const onFileChange = async (file: File | undefined) => {
    if (!file) return;
    setFileName(file.name);
    setMarkdownBody(await file.text());
    if (!title) setTitle(file.name.replace(/\.md$/i, ""));
  };

  const canSubmit = title.trim() && fileName && markdownBody && !pending;

  const submit = () => {
    startTransition(async () => {
      const result = await uploadMeetingNoteAction({
        title,
        projectId: projectId || undefined,
        meetingDate,
        attendeeIds,
        fileName,
        markdownBody,
      });
      if (result.ok) {
        toast.success(`"${title}" 회의록이 업로드됐습니다. Action 추출 대기 상태입니다.`);
        setTitle("");
        setFileName("");
        setMarkdownBody("");
        setAttendeeIds([]);
        if (fileRef.current) fileRef.current.value = "";
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">회의록 업로드</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
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
        <Button className="h-10" disabled={!canSubmit} onClick={submit}>
          {pending ? "업로드 중…" : "업로드"}
        </Button>
      </CardContent>
    </Card>
  );
}
