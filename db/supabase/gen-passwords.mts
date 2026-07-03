// 팀원별 개인 무작위 초기 비밀번호를 생성한다 (공용 que-2026! 교체용).
// 평문은 gitignore 파일로만 남기고, DB에는 bcrypt 해시만 UPDATE한다.
// ⚠️ 이 스크립트는 DB에 직접 쓰지 않는다 — 평문 파일 + UPDATE SQL만 산출한다.
//    SQL 적용은 사용자가 검토 후 실행한다(파괴적: 기존 비번 무효화).
// 사용: pnpm --filter web exec tsx ../../db/supabase/gen-passwords.mts
import { writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import path from "node:path";
import { USERS, emailForUser } from "../../packages/core/src/index.ts";

// bcryptjs는 CJS라 ESM(tsx)에서 createRequire로 로드한다.
const require = createRequire(import.meta.url);
const bcrypt = require("bcryptjs") as { hash(s: string, r: number): Promise<string> };

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../..");

// 혼동 문자를 뺀 강한 무작위 비번(12자). 팀은 비밀번호 관리자 사용 권장.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
function makePassword(len = 12): string {
  const bytes = randomBytes(len);
  let out = "";
  for (let i = 0; i < len; i += 1) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

const issued = await Promise.all(
  USERS.map(async (u) => {
    const password = makePassword();
    const hash = await bcrypt.hash(password, 10);
    return { id: u.id, name: u.name, email: emailForUser(u.id), password, hash };
  }),
);

// 1) 평문 파일 (gitignore, 각 팀원에게 안전 채널로 개별 전달)
const txtPath = path.join(repoRoot, "data/passwords.txt");
const txt =
  "# Que 개인 초기 비밀번호 — 절대 커밋 금지. 각 팀원에게 1:1 안전 채널로 개별 전달.\n" +
  "# 적용: db/supabase/set-passwords.sql 을 사용자가 검토 후 실행. 적용하면 기존 비번(que-2026!)은 즉시 무효.\n\n" +
  issued.map((t) => `${t.name} <${t.email}>: ${t.password}`).join("\n") +
  "\n";
writeFileSync(txtPath, txt, { mode: 0o600 });

// 2) UPDATE SQL (사용자 승인 후 실행)
const sqlPath = path.join(repoRoot, "db/supabase/set-passwords.sql");
const sql =
  "-- Que 개인 비밀번호 적용 (공용 que-2026! 교체). gen-passwords.mts 산출물.\n" +
  "-- ⚠️ 적용 전 백업 불가 — 실행하면 기존 비번 즉시 무효. 평문은 data/passwords.txt.\n" +
  "begin;\n" +
  issued
    .map((t) => `update users set password_hash = '${t.hash}' where id = '${t.id}';`)
    .join("\n") +
  "\ncommit;\n";
writeFileSync(sqlPath, sql, { mode: 0o600 });

console.log(`✅ ${issued.length}명 개인 비번 생성.`);
console.log(`   평문(gitignore): ${txtPath}`);
console.log(`   적용 SQL(사용자 실행): ${sqlPath}`);
for (const t of issued) console.log(`   ${t.name}: ${t.password.slice(0, 2)}…${t.password.slice(-2)}`);
