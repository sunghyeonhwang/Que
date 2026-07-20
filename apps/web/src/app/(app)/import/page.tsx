import { ShieldAlert } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { ImportWorkbench } from "@/components/import/import-workbench";
import { getCurrentUser } from "@/lib/current-user";

export const dynamic = "force-dynamic";

// 기타 > 일정 임포트 — 다른 프로젝트에서 채운 임포트 양식(YAML)을 붙여넣어 미리보기 후 일괄 등록한다.
// 관리자 전용. 파싱·계획·생성은 전부 서버 액션(previewScheduleImportAction/executeScheduleImportAction)이
// 수행하고, 이 화면은 입력·미리보기·결과 표시만 한다(클라이언트 계획 신뢰 금지 — execute가 서버에서 재수립).
export default async function ImportPage() {
  const user = await getCurrentUser();

  // 관리자만 접근 — 메뉴 노출(adminOnly) + 서버 액션 게이트에 더해 화면에서도 안내한다.
  if (user.role !== "admin") {
    return (
      <div>
        <PageHeader
          title="일정 임포트"
          subtitle="임포트 양식(YAML)을 붙여넣어 미리보기 후 일괄 등록합니다."
        />
        <div className="flex max-w-xl items-start gap-3 rounded-xl border border-[var(--que-border)] bg-[var(--que-bg-muted)] p-4">
          <ShieldAlert
            className="mt-0.5 size-5 shrink-0 text-[var(--que-text-tertiary)]"
            aria-hidden
          />
          <p className="text-sm leading-relaxed text-[var(--que-text-secondary)]">
            일정 임포트는 클라이언트·프로젝트·마일스톤·작업·회의를 한 번에 생성하는 관리자 전용
            화면입니다. 다른 프로젝트의 일정을 Que로 옮겨야 한다면 관리자에게 요청하세요.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="일정 임포트"
        subtitle="임포트 양식(YAML)을 붙여넣어 미리보기 후 일괄 등록합니다."
      />

      {/* 교육형 흐름 안내(장식 없음) */}
      <div className="mb-5 rounded-xl border border-[var(--que-border)] bg-[var(--que-bg-muted)] p-4">
        <h2 className="text-base font-semibold text-[var(--que-text)]">어떻게 가져오나요</h2>
        <ol className="mt-2 flex flex-col gap-1.5 text-sm leading-relaxed text-[var(--que-text-secondary)]">
          <li>
            <span className="font-medium text-[var(--que-text)]">① 양식 채우기</span> — 옮겨올
            프로젝트의 Claude Code 세션에{" "}
            <code className="rounded bg-[var(--que-bg)] px-1 py-0.5 text-[0.8em] text-[var(--que-text)]">
              data/docs/que-import-template.md
            </code>
            를 주고, 근거에 맞춰 YAML을 채우게 합니다.
          </li>
          <li>
            <span className="font-medium text-[var(--que-text)]">② 붙여넣고 미리보기</span> —
            완성된 YAML을 아래에 붙여넣고 [미리보기]로 생성될 항목·중복·차단 오류를 확인합니다.
          </li>
          <li>
            <span className="font-medium text-[var(--que-text)]">③ 확인 후 등록</span> — 문제가
            없으면 [등록]으로 클라이언트 → 프로젝트 → 마일스톤 → 작업 → 회의 순으로 일괄
            생성합니다.
          </li>
        </ol>
      </div>

      <ImportWorkbench />
    </div>
  );
}
