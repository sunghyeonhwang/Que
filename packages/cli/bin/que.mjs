#!/usr/bin/env node
// que CLI 진입점 — tsx로 TypeScript 소스를 직접 실행한다 (mock/로컬 단계).
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const src = path.join(path.dirname(fileURLToPath(import.meta.url)), "../src/index.ts");
const result = spawnSync("npx", ["tsx", src, ...process.argv.slice(2)], { stdio: "inherit" });
process.exit(result.status ?? 1);
