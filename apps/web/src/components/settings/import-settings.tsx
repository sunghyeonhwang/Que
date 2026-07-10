"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Check, Download, FileUp, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  importMilestonesAction,
  importTasksAction,
} from "@/app/(app)/settings/import-actions";
import {
  IMPORT_MAX_ROWS,
  SAMPLE_MILESTONES_CSV,
  SAMPLE_TASKS_CSV,
  type ImportResult,
} from "@/lib/import/csv";

// 설정 › 가져오기 — CSV 일괄 등록 UI.
// 흐름: 종류 선택 → CSV 파일 선택 → [미리보기](서버 dry-run) → 행별 판정 확인 → [등록].
// 등록 전 미리보기를 반드시 거친다 — 자연어 입력 확인 카드 원칙(CLAUDE.md)의 CSV판.
// 파싱·이름 해석·규칙 검증은 전부 서버 액션이 수행하고, 여기는 파일 읽기와 결과 표시만 한다.

type ImportKind = "tasks" | "milestones";

const KIND_META: Record<
  ImportKind,
  { label: string; sample: string; sampleName: string; hint: string }
> = {
  tasks: {
    label: "작업",
    sample: SAMPLE_TASKS_CSV,
    sampleName: "tasks-sample.csv",
    hint: "담당자·클라이언트·프로젝트·도움 주는 사람은 Que에 있는 이름 그대로 적습니다. 담당자를 비우면 본인에게 배정됩니다.",
  },
  milestones: {
    label: "마일스톤",
    sample: SAMPLE_MILESTONES_CSV,
    sampleName: "milestones-sample.csv",
    hint: "프로젝트명은 Que에 있는 이름 그대로 적습니다. 마일스톤 등록은 관리자 또는 프로젝트 담당자만 가능합니다.",
  },
};

function downloadSample(kind: ImportKind) {
  const meta = KIND_META[kind];
  const blob = new Blob(["﻿" + meta.sample], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = meta.sampleName;
  // 앵커를 DOM에 붙여야 일부 브라우저(Firefox 등)가 download 파일명을 무시하지 않는다
  // — 미부착 시 blob URL의 확장자 없는 임시 이름으로 저장되던 문제.
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function ImportSettings() {
  const [kind, setKind] = useState<ImportKind>("tasks");
  const [fileName, setFileName] = useState("");
  const [csvText, setCsvText] = useState("");
  const [preview, setPreview] = useState<ImportResult | null>(null);
  const [committed, setCommitted] = useState<ImportResult | null>(null);
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const runAction = (mode: "preview" | "commit") => {
    startTransition(async () => {
      const action = kind === "tasks" ? importTasksAction : importMilestonesAction;
      const result = await action(csvText, mode);
      if (mode === "preview") {
        setPreview(result);
        setCommitted(null);
        if (result.fileError) toast.error(result.fileError);
      } else {
        setCommitted(result);
        if (result.created > 0) {
          toast.success(
            `${KIND_META[kind].label} ${result.created}건을 등록했습니다` +
              (result.failed > 0 ? ` (실패 ${result.failed}건)` : ""),
          );
        } else {
          toast.error("등록된 항목이 없습니다 — 행별 사유를 확인하세요");
        }
      }
    });
  };

  const reset = () => {
    setFileName("");
    setCsvText("");
    setPreview(null);
    setCommitted(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const changeKind = (next: ImportKind) => {
    if (next === kind) return;
    setKind(next);
    reset();
  };

  const onFileChange = async (file: File | undefined) => {
    if (!file) return;
    setFileName(file.name);
    setCsvText(await file.text());
    setPreview(null);
    setCommitted(null);
  };

  // 결과 표시는 등록 결과가 있으면 그것을, 없으면 미리보기를 보여준다.
  const shown = committed ?? preview;
  const isCommitted = committed !== null;

  return (
    <div className="flex max-w-3xl flex-col gap-5">
      {/* 종류 선택 */}
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-[var(--que-text)]">무엇을 가져오나요?</h2>
        <div className="flex gap-2" role="radiogroup" aria-label="가져오기 종류">
          {(Object.keys(KIND_META) as ImportKind[]).map((k) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={kind === k}
              onClick={() => changeKind(k)}
              className={
                kind === k
                  ? "h-10 rounded-lg bg-[var(--que-brand-subtle)] px-4 text-sm font-semibold text-[var(--que-brand)] ring-1 ring-[var(--que-brand)]"
                  : "h-10 rounded-lg border border-[var(--que-border)] px-4 text-sm font-medium text-[var(--que-text-secondary)] hover:bg-[var(--que-bg-muted)]"
              }
            >
              {KIND_META[k].label}
            </button>
          ))}
        </div>
        <p className="text-sm text-[var(--que-text-secondary)]">{KIND_META[kind].hint}</p>
      </section>

      {/* 파일 선택 + 샘플 */}
      <section className="flex flex-col gap-2 rounded-xl border border-[var(--que-border)] bg-[var(--que-bg)] p-4">
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => onFileChange(e.target.files?.[0])}
          />
          <Button
            variant="outline"
            className="h-10"
            onClick={() => fileRef.current?.click()}
            disabled={pending}
          >
            <FileUp className="size-4" aria-hidden />
            CSV 파일 선택
          </Button>
          <Button variant="ghost" className="h-10" onClick={() => downloadSample(kind)}>
            <Download className="size-4" aria-hidden />
            샘플 CSV 받기
          </Button>
          {fileName && (
            <span className="flex items-center gap-1.5 text-sm text-[var(--que-text-secondary)]">
              {fileName}
              <button
                type="button"
                aria-label="파일 지우기"
                onClick={reset}
                className="flex size-6 items-center justify-center rounded-full hover:bg-[var(--que-bg-muted)]"
              >
                <X className="size-3.5" aria-hidden />
              </button>
            </span>
          )}
        </div>
        <p className="text-xs text-[var(--que-text-tertiary)]">
          UTF-8 CSV만 지원합니다(엑셀은 &quot;CSV UTF-8&quot;로 저장). #으로 시작하는 행과 빈 행은
          무시하며, 한 번에 최대 {IMPORT_MAX_ROWS}행까지 가져올 수 있습니다.
        </p>
      </section>

      {/* 실행 버튼 */}
      <section className="flex items-center gap-2">
        <Button
          className="h-10"
          onClick={() => runAction("preview")}
          disabled={!csvText || pending}
        >
          {pending && !preview ? "확인 중…" : "미리보기"}
        </Button>
        {preview && !preview.fileError && !isCommitted && (
          <Button
            className="h-10 bg-[var(--que-brand)] text-white hover:bg-[var(--que-brand-hover)]"
            onClick={() => runAction("commit")}
            disabled={pending || preview.created === 0}
          >
            <Upload className="size-4" aria-hidden />
            {pending ? "등록 중…" : `${preview.created}건 등록`}
          </Button>
        )}
        {shown && (
          <span className="text-sm text-[var(--que-text-secondary)]">
            {isCommitted ? "등록 결과" : "미리보기"} — 가능 {shown.created}건
            {shown.failed > 0 && (
              <b className="font-medium text-[var(--que-error)]"> · 오류 {shown.failed}건</b>
            )}
          </span>
        )}
      </section>

      {/* 행별 결과 표 */}
      {shown && !shown.fileError && shown.results.length > 0 && (
        <section className="overflow-x-auto rounded-xl border border-[var(--que-border)]">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-[var(--que-border)] bg-[var(--que-bg-muted)] text-left text-xs text-[var(--que-text-secondary)]">
                <th className="px-3 py-2 font-medium">행</th>
                <th className="px-3 py-2 font-medium">이름</th>
                <th className="px-3 py-2 font-medium">판정</th>
                <th className="px-3 py-2 font-medium">내용</th>
              </tr>
            </thead>
            <tbody>
              {shown.results.map((r) => (
                <tr key={r.line} className="border-b border-[var(--que-border)] last:border-b-0">
                  <td className="px-3 py-2 text-[var(--que-text-tertiary)] tabular-nums">{r.line}</td>
                  <td className="max-w-[220px] truncate px-3 py-2 font-medium text-[var(--que-text)]">
                    {r.title}
                  </td>
                  <td className="px-3 py-2">
                    {r.ok ? (
                      <span className="inline-flex items-center gap-1 text-[var(--que-success)]">
                        <Check className="size-3.5" aria-hidden />
                        {isCommitted ? "등록됨" : "가능"}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[var(--que-error)]">
                        <X className="size-3.5" aria-hidden />
                        오류
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-[var(--que-text-secondary)]">{r.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
      {shown?.fileError && (
        <p role="alert" className="text-sm text-[var(--que-error)]">
          {shown.fileError}
        </p>
      )}

      {isCommitted && (
        <p className="text-xs text-[var(--que-text-tertiary)]">
          가져오기로 등록한 작업은 담당자에게 개인 DM을 보내지 않습니다(대량 등록 알림 방지).
          단, 홀드·문제발생으로 등록한 작업은 팀 채널에 병목 알림이 올라갑니다. 등록된 작업은
          작업 목록·프로젝트 화면에서 확인하세요.
        </p>
      )}
    </div>
  );
}
