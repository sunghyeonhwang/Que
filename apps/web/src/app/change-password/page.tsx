import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { auth } from "@/auth";
import { ForcedChangeForm } from "./forced-change-form";

export const dynamic = "force-dynamic";

// 강제 비밀번호 변경 — 임시 비밀번호 상태(must_change_password)인 사용자만 접근.
// (app) 그룹 밖에 둬서 사이드바 없이 이 작업만 하도록 격리한다.
export default async function ChangePasswordPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!session.user.mustChangePassword) redirect("/");

  return (
    <main className="flex min-h-svh items-center justify-center bg-[var(--que-canvas)] px-6 py-10">
      <div className="w-full max-w-md rounded-2xl border border-[var(--que-border)] bg-[var(--que-bg)] p-6 shadow-[var(--que-shadow-md)] sm:p-8">
        <div className="mb-5 flex flex-col items-center gap-3 text-center">
          <span className="flex size-12 items-center justify-center rounded-xl bg-[var(--que-brand-subtle)] text-[var(--que-brand)]">
            <ShieldCheck className="size-6" aria-hidden />
          </span>
          <div>
            <h1 className="text-xl font-semibold text-[var(--que-text)]">비밀번호를 바꿔주세요</h1>
            <p className="mt-1.5 text-sm text-[var(--que-text-secondary)]">
              {session.user.name ? `${session.user.name}님, ` : ""}지금은 임시 비밀번호예요.
              계속하려면 본인만 아는 새 비밀번호로 바꿔주세요.
            </p>
          </div>
        </div>
        <ForcedChangeForm />
      </div>
    </main>
  );
}
