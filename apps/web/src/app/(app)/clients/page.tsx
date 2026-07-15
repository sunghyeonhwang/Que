import { redirect } from "next/navigation";
import { PageHeader } from "@/components/app/page-header";
import { CreateClientForm } from "@/components/clients/create-client-form";
import { CreateProjectForm } from "@/components/clients/create-project-form";
import {
  ClientGroups,
  type ClientGroup,
  type ProjectRowData,
  type UserOption,
} from "@/components/clients/client-groups";
import { getCurrentUser } from "@/lib/current-user";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

// 기타 > 클라이언트 — 거래처(클라이언트)와 소속 프로젝트를 관리하는 관리자 전용 화면.
// 클라이언트 추가/이름수정/보관, 프로젝트 추가/편집(이름·클라이언트 재배정·상태·담당자).
// 데이터 접근은 core 진입점(getDb)만 사용하고, 뷰모델은 여기서 서버에서 조립한다.
export default async function ClientsPage({
  searchParams,
}: {
  // 홈 클라이언트별 현황 링크(/clients?client=<id>)가 도착하면 해당 카드를 강조·스크롤한다.
  searchParams: Promise<{ client?: string }>;
}) {
  const { client: highlightClientId } = await searchParams;
  const user = await getCurrentUser();
  // 관리자만 접근 — 비관리자가 URL로 직접 오면 홈으로 되돌린다(메뉴 노출 게이트 + 서버 게이트).
  if (user.role !== "admin") redirect("/home");

  const db = await getDb();

  const users: UserOption[] = db.users.map((u) => ({ id: u.id, name: u.name }));
  const nameById = new Map(users.map((u) => [u.id, u.name]));

  const projectsByClient = new Map<string | undefined, ProjectRowData[]>();
  // 그룹 내 표시 순서: 관리자가 정한 sortOrder(오름차순) → 이름. 프로젝트 재정렬이 이 순서를 바꾼다.
  for (const p of [...db.projects].sort(
    (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name, "ko"),
  )) {
    const row: ProjectRowData = {
      id: p.id,
      name: p.name,
      status: p.status,
      clientId: p.clientId,
      ownerId: p.ownerId,
      ownerName: nameById.get(p.ownerId) ?? p.ownerId,
    };
    const key = p.clientId;
    const list = projectsByClient.get(key);
    if (list) list.push(row);
    else projectsByClient.set(key, [row]);
  }

  const clientGroups: ClientGroup[] = [...db.clients]
    // 관리자가 정한 표시 순서(sortOrder 오름차순). 드래그 재정렬이 이 순서를 바꾼다.
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((c) => ({
      id: c.id,
      name: c.name,
      status: c.status,
      projects: projectsByClient.get(c.id) ?? [],
    }));

  const unassignedProjects = projectsByClient.get(undefined) ?? [];

  // 클라이언트 선택 옵션(활성 우선). 프로젝트 폼·재배정에서 공유한다.
  const clientOptions = clientGroups
    .filter((c) => c.status === "active")
    .map((c) => ({ id: c.id, name: c.name }));

  return (
    <div>
      <PageHeader
        title="클라이언트"
        subtitle="거래처와 소속 프로젝트를 관리합니다. 관리자만 볼 수 있는 화면이에요."
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="flex min-w-0 flex-col gap-3">
          <h2 className="text-base font-semibold text-[var(--que-text)]">
            클라이언트 · 프로젝트
          </h2>
          <ClientGroups
            clients={clientGroups}
            unassigned={unassignedProjects}
            clientOptions={clientOptions}
            users={users}
            highlightId={highlightClientId}
          />
        </section>

        <aside className="flex min-w-0 flex-col gap-4">
          <CreateClientForm />
          <CreateProjectForm clients={clientOptions} users={users} defaultOwnerId={user.id} />
        </aside>
      </div>
    </div>
  );
}
