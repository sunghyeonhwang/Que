import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { verifyCredentials } from "@/lib/auth/verify";

// Auth.js v5 — 이메일+비밀번호(Credentials) + JWT 세션(어댑터 불필요).
// getCurrentUser·서버 액션·[...nextauth] 라우트가 여기서 나온 handlers/auth/signIn/signOut을 쓴다.
// 프로덕션에서는 세션 쿠키를 .griff.co.kr 상위 도메인으로 발급해
// interview.griff.co.kr 등 형제 서브도메인이 같은 세션을 검증할 수 있게 한다(SSO).
// 로컬 개발(localhost)에서는 domain을 설정하지 않는다.
const isProd = process.env.NODE_ENV === "production";

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  // JWT 세션. maxAge를 명시(기본 30일은 과함) — 비번 변경/재설정 후 기존 세션의 잔존 창을 제한한다.
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 7 }, // 7일
  ...(isProd && {
    cookies: {
      sessionToken: {
        name: "__Secure-authjs.session-token",
        options: {
          httpOnly: true,
          sameSite: "lax" as const,
          path: "/",
          secure: true,
          domain: ".griff.co.kr",
        },
      },
    },
  }),
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      authorize: async (creds) => {
        const email = typeof creds?.email === "string" ? creds.email : "";
        const password = typeof creds?.password === "string" ? creds.password : "";
        const user = await verifyCredentials(email, password);
        return user ?? null; // null → 로그인 거부
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.role = (user as { role?: "admin" | "member" }).role ?? "member";
        token.mustChangePassword =
          (user as { mustChangePassword?: boolean }).mustChangePassword ?? false;
        if (user.name) token.name = user.name;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = (token.id as string) ?? "";
        session.user.role = (token.role as "admin" | "member") ?? "member";
        session.user.mustChangePassword = (token.mustChangePassword as boolean | undefined) ?? false;
        if (token.name) session.user.name = token.name;
      }
      return session;
    },
  },
});
