// 사용자별 Personal Access Token(PAT)을 발급한다 (MCP/CLI 인증용).
// 무작위 토큰을 생성해 평문은 파일로만 남기고, DB에는 SHA-256 해시만 저장한다.
// 재실행하면 기존 토큰을 모두 폐기(delete)하고 새로 발급한다(멱등).
// 사용: pnpm --filter @que/core exec tsx ../../db/supabase/gen-tokens.mts
import { readFileSync, writeFileSync } from "node:fs";
import { createHash, randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";
import pg from "pg";
import { USERS } from "../../packages/core/src/index.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../..");
const envText = readFileSync(path.join(repoRoot, "data/.env"), "utf8");
const env = Object.fromEntries(
  envText.split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")]; }),
);
const bare = envText.split("\n").map((l) => l.trim()).find((l) => l.startsWith("postgresql://"));
let dbUrl = env.SUPABASE_DB_URL ?? bare;
if (!dbUrl) throw new Error("data/.env에 pooler 연결 문자열이 없습니다.");
if (env.SUPABASE_PASSWORD) dbUrl = dbUrl.replace(/\[YOUR-PASSWORD\]/gi, encodeURIComponent(env.SUPABASE_PASSWORD));

const hashToken = (t: string) => createHash("sha256").update(t).digest("hex");

const issued = USERS.map((u) => {
  const token = "que_pat_" + randomBytes(24).toString("hex"); // 48 hex, 추측 불가
  return { id: u.id, name: u.name, token, hash: hashToken(token) };
});

const client = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
try {
  await client.connect();
  await client.query("begin");
  await client.query("delete from personal_access_tokens"); // 기존 폐기 후 재발급
  for (const t of issued) {
    await client.query(
      "insert into personal_access_tokens (token_hash, user_id, label) values ($1,$2,$3)",
      [t.hash, t.id, "initial"],
    );
  }
  await client.query("commit");

  const outPath = path.join(repoRoot, "data/pat-tokens.txt");
  const body =
    "# Que Personal Access Tokens (MCP/CLI) — 절대 커밋 금지, 각 팀원에게 개별 전달\n" +
    "# 발급 시각: 스크립트 실행 시점. 재발급하면 이전 토큰은 무효.\n\n" +
    issued.map((t) => `${t.name} (${t.id}): ${t.token}`).join("\n") + "\n";
  writeFileSync(outPath, body, { mode: 0o600 });
  console.log(`✅ ${issued.length}개 PAT 발급 완료 (해시만 DB 저장). 평문: ${outPath}`);
  for (const t of issued) console.log(`   ${t.name}: que_pat_…${t.token.slice(-6)}`);
} catch (err) {
  await client.query("rollback").catch(() => {});
  console.error("❌ 발급 실패 — 롤백:", (err as Error).message);
  process.exitCode = 1;
} finally {
  await client.end();
}
