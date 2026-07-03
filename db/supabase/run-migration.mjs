// Que 초기 마이그레이션 러너 — 직접 Postgres 연결로 migrate-fresh.sql을 실행한다.
// 연결 문자열은 data/.env의 SUPABASE_DB_URL에서 읽는다(비밀번호가 채팅/git에 남지 않도록).
// 사용: node db/supabase/run-migration.mjs [파일]  (기본: db/supabase/migrate-fresh.sql)
// 런타임 앱은 이걸 쓰지 않는다 — 이건 일회성 DDL 전용. 앱은 supabase-js(PostgREST)로 붙는다.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import pg from "pg";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../..");

// data/.env 파싱 (간단 파서 — KEY=VALUE, 따옴표 제거)
const envText = readFileSync(path.join(repoRoot, "data/.env"), "utf8");
const env = Object.fromEntries(
  envText
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
    }),
);

// 연결 문자열: SUPABASE_DB_URL이 있으면 그대로, 없으면 SUPABASE_PASSWORD + 프로젝트 ref로 조립.
// 비밀번호는 URL 인코딩(특수문자 안전). ref는 SUPABASE_URL(https://<ref>.supabase.co)에서 추출.
function buildDbUrl() {
  const pw = env.SUPABASE_PASSWORD;
  const encPw = pw ? encodeURIComponent(pw) : undefined;
  const subst = (u) =>
    encPw
      ? u.replace(/\[YOUR-PASSWORD\]|\[PASSWORD\]|<비밀번호>|:PASSWORD@/gi, (m) =>
          m === ":PASSWORD@" ? `:${encPw}@` : encPw,
        )
      : u;

  // 1) SUPABASE_DB_URL 키 우선
  if (env.SUPABASE_DB_URL) return subst(env.SUPABASE_DB_URL);
  // 2) 키 없이 붙여넣은 bare postgresql:// 라인도 허용
  const bare = envText.split("\n").map((l) => l.trim()).find((l) => l.startsWith("postgresql://"));
  if (bare) return subst(bare);
  // 3) 직접 연결(대체로 IPv6/비활성) — pooler를 쓰려면 위 1·2를 채워라
  const ref = (env.SUPABASE_URL ?? "").match(/https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1];
  if (!encPw || !ref) return null;
  return `postgresql://postgres:${encPw}@db.${ref}.supabase.co:5432/postgres`;
}
const dbUrl = buildDbUrl();
if (!dbUrl) {
  console.error(
    "연결 정보가 없습니다. data/.env에 SUPABASE_DB_URL(직접 연결 문자열) 또는\n" +
      "SUPABASE_PASSWORD(+ SUPABASE_URL) 를 넣으세요.",
  );
  process.exit(1);
}

// --check 모드: 파괴적 실행 없이 연결 + 현재 테이블만 확인
if (process.argv.includes("--check")) {
  const c = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  try {
    await c.connect();
    const { rows } = await c.query(
      "select table_name from information_schema.tables where table_schema='public' order by table_name",
    );
    console.log(`✅ 연결 OK. 현재 public 테이블 ${rows.length}개:`, rows.map((r) => r.table_name).join(", ") || "(없음)");
  } catch (e) {
    console.error("❌ 연결 실패:", e.message);
    process.exitCode = 1;
  } finally {
    await c.end();
  }
  process.exit(process.exitCode ?? 0);
}

const sqlFile = process.argv[2] ?? path.join(here, "migrate-fresh.sql");
const sql = readFileSync(sqlFile, "utf8");

const client = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });

try {
  await client.connect();
  console.log(`연결됨. 실행: ${path.relative(repoRoot, sqlFile)} (${sql.length}자)`);
  await client.query(sql); // 파일 자체가 begin;...commit; 로 감싸져 원자적 실행
  console.log("✅ 마이그레이션 성공 (단일 트랜잭션 커밋).");

  const { rows } = await client.query(
    "select table_name from information_schema.tables where table_schema='public' order by table_name",
  );
  console.log(`public 테이블 ${rows.length}개:`, rows.map((r) => r.table_name).join(", "));
} catch (err) {
  console.error("❌ 마이그레이션 실패 — 트랜잭션 롤백됨:", err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
