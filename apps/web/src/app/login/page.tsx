import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { LoginForm } from "./login-form";

// Figma QUE_All_Pages / 0 1 0 - Login 기준 2단 레이아웃.
// 좌: 히어로 이미지+헤드라인(lg 이상), 우: 로그인 폼. 태블릿 세로(<lg)에서는 폼만 중앙.
export default async function LoginPage() {
  const session = await auth();
  if (session?.user?.id) redirect("/");

  return (
    <main className="flex min-h-svh bg-white">
      {/* 좌측 히어로 — lg 이상에서만 */}
      <div className="relative hidden w-1/2 overflow-hidden lg:block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/auth/hero.jpg"
          alt=""
          className="absolute inset-0 size-full object-cover"
        />
        <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-b from-transparent to-black/70" />
        <div className="absolute inset-x-0 bottom-16 flex flex-col items-center gap-1.5 px-8 text-center text-white">
          <h2 className="text-[2.6rem] leading-[1.4] font-bold tracking-tight">
            프로젝트를 간소화하고
            <br />
            생산성을 높이세요
          </h2>
          <p className="max-w-[38ch] text-lg text-white/90">
            그리프 큐는 성과중심이 아닌 업무 중심의 툴로 설계 되었습니다.
          </p>
        </div>
      </div>

      {/* 우측 폼 — 은은한 방사형 그라데이션 배경 */}
      <div
        className="flex flex-1 items-center justify-center px-6 py-10"
        style={{
          backgroundImage:
            "radial-gradient(60rem 40rem at 15% -10%, rgba(112,234,255,0.12), transparent 60%), radial-gradient(50rem 40rem at 110% 0%, rgba(191,151,255,0.14), transparent 60%)",
        }}
      >
        <LoginForm />
      </div>
    </main>
  );
}
