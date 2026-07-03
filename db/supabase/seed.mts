// Supabase에 Que 시드 데이터를 채운다 (mock createSeed() → Postgres).
// 연결은 data/.env의 pooler 문자열(또는 SUPABASE_DB_URL). 멱등: 각 테이블을 truncate 후 재삽입.
// 사용: pnpm --filter @que/core exec tsx ../../db/supabase/seed.mts   (또는 repo 루트에서 tsx)
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import pg from "pg";
import {
  createSeed,
  USERS,
  toRow,
  SEED_KEY_TO_TABLE,
  TABLE_INSERT_ORDER,
} from "../../packages/core/src/index.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../..");
const envText = readFileSync(path.join(repoRoot, "data/.env"), "utf8");
const env = Object.fromEntries(
  envText.split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")]; }),
);
const bare = envText.split("\n").map((l) => l.trim()).find((l) => l.startsWith("postgresql://"));
const pw = env.SUPABASE_PASSWORD;
let dbUrl = env.SUPABASE_DB_URL ?? bare;
if (!dbUrl) throw new Error("data/.env에 pooler 연결 문자열이 없습니다.");
if (pw) dbUrl = dbUrl.replace(/\[YOUR-PASSWORD\]/gi, encodeURIComponent(pw));

// 시드 기준 시각: 결정론적으로 고정하지 않고 "지금"을 쓴다 — mock과 동일하게 오늘 화면에 데이터가 걸리도록.
const seed = createSeed(new Date());

/** 한 테이블에 rows를 파라미터 바인딩으로 일괄 삽입 */
async function insertRows(client: pg.Client, table: string, rows: Record<string, unknown>[]) {
  if (rows.length === 0) return 0;
  // 모든 행이 같은 컬럼 집합을 갖도록 합집합 컬럼을 만든다(없는 값은 null)
  const cols = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  const values: unknown[] = [];
  const tuples = rows.map((r, ri) => {
    const ph = cols.map((c, ci) => {
      values.push(c in r ? r[c] : null);
      return `$${ri * cols.length + ci + 1}`;
    });
    return `(${ph.join(",")})`;
  });
  const sql = `insert into ${table} (${cols.map((c) => `"${c}"`).join(",")}) values ${tuples.join(",")}`;
  await client.query(sql, values);
  return rows.length;
}

const client = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
try {
  await client.connect();

  // 각 테이블의 실제 컬럼 집합을 읽어, 도메인에만 있고 DB엔 없는 필드(예: Project.milestoneIds —
  // 정규화로 milestones.project_id에 표현)를 삽입 전에 걸러낸다.
  const colRes = await client.query(
    "select table_name, column_name from information_schema.columns where table_schema='public'",
  );
  const tableCols: Record<string, Set<string>> = {};
  for (const r of colRes.rows) {
    (tableCols[r.table_name] ??= new Set()).add(r.column_name);
  }
  const filterCols = (table: string, row: Record<string, unknown>): Record<string, unknown> => {
    const allowed = tableCols[table];
    if (!allowed) return row;
    return Object.fromEntries(Object.entries(row).filter(([k]) => allowed.has(k)));
  };

  await client.query("begin");

  // FK 역순으로 기존 데이터 제거(멱등). truncate ... cascade 한 방.
  await client.query(`truncate ${[...TABLE_INSERT_ORDER].join(", ")} restart identity cascade`);

  // users는 USERS 상수에서 (도메인에만 있고 DB엔 없는 필드는 filterCols가 제거)
  const counts: Record<string, number> = {};
  counts.users = await insertRows(
    client,
    "users",
    USERS.map((u) => filterCols("users", toRow(u as unknown as Record<string, unknown>))),
  );

  // 나머지는 seed에서 (FK 안전 순서)
  const seedByTable: Record<string, Record<string, unknown>[]> = {};
  for (const [seedKey, table] of Object.entries(SEED_KEY_TO_TABLE)) {
    const arr = (seed as unknown as Record<string, unknown[]>)[seedKey] ?? [];
    seedByTable[table] = arr.map((o) => filterCols(table, toRow(o as Record<string, unknown>)));
  }
  for (const table of TABLE_INSERT_ORDER) {
    if (table === "users") continue;
    counts[table] = await insertRows(client, table, seedByTable[table] ?? []);
  }

  await client.query("commit");
  console.log("✅ 시드 완료:");
  for (const t of TABLE_INSERT_ORDER) console.log(`   ${t}: ${counts[t] ?? 0}행`);

  // 검증: 실제 DB 행 수 재조회
  const check = await Promise.all(
    TABLE_INSERT_ORDER.map((t) => client.query(`select count(*)::int n from ${t}`).then((r) => `${t}=${r.rows[0].n}`)),
  );
  console.log("DB 실제 행 수:", check.join(", "));
} catch (err) {
  await client.query("rollback").catch(() => {});
  console.error("❌ 시드 실패 — 롤백:", (err as Error).message);
  process.exitCode = 1;
} finally {
  await client.end();
}
