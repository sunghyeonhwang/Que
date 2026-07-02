import { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

// 토큰 해석 우선순위: QUE_TOKEN 환경 변수 > ~/.que/config.json (que login으로 저장)

const CONFIG_DIR = path.join(homedir(), ".que");
const CONFIG_PATH = path.join(CONFIG_DIR, "config.json");

interface CliConfig {
  token?: string;
  apiUrl?: string;
}

export function readConfig(): CliConfig {
  if (!existsSync(CONFIG_PATH)) return {};
  try {
    return JSON.parse(readFileSync(CONFIG_PATH, "utf8")) as CliConfig;
  } catch {
    return {};
  }
}

export function saveToken(token: string): string {
  mkdirSync(CONFIG_DIR, { recursive: true });
  const config = { ...readConfig(), token };
  writeFileSync(CONFIG_PATH, `${JSON.stringify(config, null, 2)}\n`);
  chmodSync(CONFIG_PATH, 0o600); // 토큰 파일은 소유자만 읽게
  return CONFIG_PATH;
}

export function resolveToken(): string {
  const token = process.env.QUE_TOKEN ?? readConfig().token;
  if (!token) {
    console.error(
      "토큰이 없습니다. `que login <토큰>`으로 저장하거나 QUE_TOKEN 환경 변수를 설정하세요.",
    );
    console.error("mock 단계 토큰 형식: que_pat_<userId> (예: que_pat_hwang-sunghyeon)");
    process.exit(1);
  }
  return token;
}

export function resolveApiUrl(): string | undefined {
  return process.env.QUE_API_URL ?? readConfig().apiUrl;
}
