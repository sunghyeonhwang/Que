// MCP 서버 스모크 테스트 — stdio JSON-RPC로 실제 서버를 띄워 도구를 호출한다.
// 전제: 웹 dev 서버가 http://localhost:3000 에 떠 있어야 한다.
// 실행: QUE_TOKEN=que_pat_hwang-sunghyeon pnpm --filter @que/mcp test

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const token = process.env.QUE_TOKEN ?? "que_pat_hwang-sunghyeon";

const transport = new StdioClientTransport({
  command: "pnpm",
  args: ["--filter", "@que/mcp", "start"],
  cwd: new URL("../../..", import.meta.url).pathname,
  env: { ...process.env, QUE_TOKEN: token },
});

const client = new Client({ name: "que-smoke", version: "0.0.1" });
await client.connect(transport);

let failed = 0;
function check(name: string, condition: boolean, detail?: string) {
  const mark = condition ? "PASS" : "FAIL";
  if (!condition) failed += 1;
  console.log(`${mark}  ${name}${detail ? ` — ${detail}` : ""}`);
}

// 1) 도구 목록
const { tools } = await client.listTools();
check("도구 개수 20", tools.length === 20, `실제 ${tools.length}`);
check(
  "조회 도구 readOnlyHint",
  tools.filter((t) => t.annotations?.readOnlyHint).length === 10,
);
check(
  "list_clients 조회 도구 등록",
  tools.some((t) => t.name === "list_clients" && t.annotations?.readOnlyHint === true),
);

// 1-1) 거래처 목록 조회 + 거래처별 작업 필터
const clients = await client.callTool({ name: "list_clients", arguments: {} });
const clientsText = (clients.content as { text: string }[])[0]?.text ?? "";
check("list_clients 응답", !clients.isError && clientsText.includes("client-"), clientsText.slice(0, 80));
const clientTasks = await client.callTool({
  name: "list_tasks",
  arguments: { client: "client-mendix" },
});
check("list_tasks client 필터 (거래처명 병기)", !clientTasks.isError);

// 댓글: 타인 작업에도 가능 + 도움 요청
const commented = await client.callTool({
  name: "add_task_comment",
  arguments: {
    taskId: "task-payment-qa", // 박승환 작업 — 관리자 토큰이지만 팀 누구나 가능
    body: "MCP 스모크 — 로그 확인 부탁드립니다",
    helpUserId: "oh-seunghoon",
  },
});
check("add_task_comment (도움 요청)", !commented.isError);
const commentList = await client.callTool({
  name: "list_task_comments",
  arguments: { taskId: "task-payment-qa" },
});
const commentText = (commentList.content as { text: string }[])[0]?.text ?? "";
check("list_task_comments 반영", commentText.includes("MCP 스모크"));

// parse → 저장 안 됨 확인
const parsed = await client.callTool({
  name: "parse_task_input",
  arguments: { text: "내일 오후 3시에 황성현씨 상세페이지 QA 넣어줘" },
});
const parsedText = (parsed.content as { text: string }[])[0]?.text ?? "";
check(
  "parse_task_input 초안 반환",
  parsedText.includes("상세페이지 QA") && parsedText.includes("hwang-sunghyeon"),
  parsedText.slice(0, 80),
);

// 2) 조회
const me = await client.callTool({ name: "get_me", arguments: {} });
const meText = (me.content as { text: string }[])[0]?.text ?? "";
check("get_me 사용자 반환", meText.includes("황성현"), meText.slice(0, 60));

const day = await client.callTool({ name: "get_my_day", arguments: {} });
check("get_my_day 응답", !day.isError);

// 3) 규칙 위반 — 사유 없는 issue 전환은 구조적 에러로 반환돼야 한다
const noReason = await client.callTool({
  name: "change_task_status",
  arguments: { taskId: "task-landing-copy", to: "issue" },
});
const noReasonText = (noReason.content as { text: string }[])[0]?.text ?? "";
check(
  "사유 없는 issue → isError + 코드",
  noReason.isError === true && noReasonText.includes("STATUS_DETAIL_REQUIRED"),
  noReasonText.slice(0, 80),
);

// 4) 정상 변경 — 사유와 함께 (관리자 토큰)
const withReason = await client.callTool({
  name: "change_task_status",
  arguments: {
    taskId: "task-landing-copy",
    to: "on_hold",
    detail: { reason: "MCP 스모크 테스트" },
  },
});
check("사유 있는 on_hold 성공", !withReason.isError);

// 5) 잘못된 enum은 SDK 입력 검증에서 걸린다
const badEnum = await client
  .callTool({ name: "change_task_status", arguments: { taskId: "t", to: "hacked" } })
  .then(
    (r) => r.isError === true,
    () => true, // 프로토콜 레벨 거부도 통과로 간주
  );
check("쓰레기 상태값 거부", badEnum);

// 5-1) create_task — 신규 mutation 경로 커버리지
const created = await client.callTool({
  name: "create_task",
  arguments: {
    title: "MCP 스모크 생성 작업",
    startAt: "2026-07-10T01:00:00.000Z",
    endAt: "2026-07-10T02:00:00.000Z",
  },
});
const createdText = (created.content as { text: string }[])[0]?.text ?? "";
check(
  "create_task 생성 (본인 담당 기본)",
  !created.isError && createdText.includes("hwang-sunghyeon"),
  createdText.slice(0, 80),
);

const badCreate = await client.callTool({
  name: "create_task",
  arguments: { title: " ", startAt: "banana", endAt: "kiwi" },
});
check("create_task 쓰레기 입력 거부", badCreate.isError === true);

// 6) 마스킹 — 팀원 토큰용 별도 서버로는 검사하지 않고, 관리자 응답에 원본 존재만 확인
const payments = await client.callTool({ name: "list_payment_requests", arguments: {} });
const payText = (payments.content as { text: string }[])[0]?.text ?? "";
check("관리자 결제 조회(원본 포함)", payText.includes("264,000원") || payText.includes("264000"));

await client.close();
console.log(failed === 0 ? "\n스모크 통과" : `\n실패 ${failed}건`);
process.exit(failed === 0 ? 0 : 1);
