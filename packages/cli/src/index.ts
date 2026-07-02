import { Command } from "commander";
import {
  ACTION_ITEM_STATUS_LABELS,
  CHECK_IN_RESPONSE_LABELS,
  PAYMENT_STATUS_LABELS,
  TASK_STATUS_LABELS,
  createQueClient,
  QueApiError,
  type ActionItem,
  type CheckInResponse,
  type Task,
  type TaskStatus,
  type User,
} from "@que/core";
import { resolveApiUrl, resolveToken, saveToken } from "./config.js";

// que CLI — 터미널에서 Que를 조회/조작한다. 모든 호출은 웹 API 경유 (via: cli).
// 사용 예: que today / que task-status task-x done / que checkin chk-y working

function client() {
  return createQueClient({ baseUrl: resolveApiUrl(), token: resolveToken(), via: "cli" });
}

function fail(error: unknown): never {
  if (error instanceof QueApiError) {
    console.error(`오류 [${error.code}]: ${error.message}`);
    process.exit(1);
  }
  throw error;
}

function time(iso?: string): string {
  if (!iso) return "--:--";
  const d = new Date(iso);
  return `${String(d.getMonth() + 1)}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

const program = new Command("que")
  .description("Que — 캘린더 UI를 가진 팀 작업 상태 관리 도구의 CLI")
  .version("0.1.0");

program
  .command("login")
  .argument("<token>", "Personal Access Token (mock: que_pat_<userId>)")
  .description("토큰을 ~/.que/config.json 에 저장한다")
  .action((token: string) => {
    const savedTo = saveToken(token);
    console.log(`토큰을 저장했습니다: ${savedTo}`);
  });

program
  .command("me")
  .description("현재 토큰의 사용자 확인")
  .action(async () => {
    try {
      const { user } = (await client().get("/api/me")) as { user: User };
      console.log(`${user.name} (${user.role === "admin" ? "관리자" : "팀원"}) · ${user.id}`);
    } catch (error) {
      fail(error);
    }
  });

program
  .command("today")
  .description("오늘 요약 — 내 타임라인, 응답 대기 체크인, 주의 필요")
  .action(async () => {
    try {
      const data = (await client().get("/api/my-day")) as {
        timeline: { kind: string; title: string; startAt?: string; task?: Task }[];
        pendingCheckIns: { checkIn: { id: string; scheduledAt: string }; task: Task }[];
        attention: { task: Task; reason?: string }[];
      };
      console.log("── 오늘 타임라인 ──");
      if (data.timeline.length === 0) console.log("  (없음)");
      for (const item of data.timeline) {
        const status = item.task ? ` [${TASK_STATUS_LABELS[item.task.status]}]` : " [회사 일정]";
        console.log(`  ${time(item.startAt)}  ${item.title}${status}`);
      }
      if (data.pendingCheckIns.length) {
        console.log("── 응답 대기 체크인 ──");
        for (const { checkIn, task } of data.pendingCheckIns) {
          console.log(`  ${checkIn.id}  ${time(checkIn.scheduledAt)} "${task.title}"`);
          console.log(`    → que checkin ${checkIn.id} <working|done|needs_reschedule|issue|not_needed|merged|later>`);
        }
      }
      if (data.attention.length) {
        console.log("── 주의 필요 ──");
        for (const { task, reason } of data.attention) {
          console.log(`  [${TASK_STATUS_LABELS[task.status]}] ${task.title}${reason ? ` — ${reason}` : ""}`);
        }
      }
    } catch (error) {
      fail(error);
    }
  });

program
  .command("tasks")
  .description("작업 목록")
  .option("--status <status>", `상태 필터 (${Object.keys(TASK_STATUS_LABELS).join("|")})`)
  .option("--assignee <userId>", "담당자 필터")
  .option("--project <projectId>", "프로젝트 필터")
  .action(async (opts: { status?: string; assignee?: string; project?: string }) => {
    try {
      const params = new URLSearchParams();
      if (opts.status) params.set("status", opts.status);
      if (opts.assignee) params.set("assignee", opts.assignee);
      if (opts.project) params.set("project", opts.project);
      const query = params.toString();
      const { tasks } = (await client().get(`/api/tasks${query ? `?${query}` : ""}`)) as {
        tasks: Task[];
      };
      if (tasks.length === 0) console.log("(작업 없음)");
      for (const task of tasks) {
        console.log(
          `${task.id}  ${time(task.startAt)}  [${TASK_STATUS_LABELS[task.status]}] ${task.title} (담당 ${task.assigneeId})`,
        );
      }
    } catch (error) {
      fail(error);
    }
  });

program
  .command("task-status")
  .argument("<taskId>")
  .argument("<to>", `변경할 상태 (${Object.keys(TASK_STATUS_LABELS).join("|")})`)
  .option("--reason <reason>", "사유 (issue/on_hold 필수)")
  .option("--next <nextAction>", "다음 액션")
  .option("--help-from <userId>", "도움 필요한 사람")
  .option("--recheck <iso>", "다시 확인할 시간 (ISO 8601)")
  .description("작업 상태 변경 — 문제발생/홀드는 --reason 필수")
  .action(
    async (
      taskId: string,
      to: string,
      opts: { reason?: string; next?: string; helpFrom?: string; recheck?: string },
    ) => {
      try {
        const detail = opts.reason
          ? {
              reason: opts.reason,
              nextAction: opts.next,
              helpUserId: opts.helpFrom,
              recheckAt: opts.recheck,
            }
          : undefined;
        const { task } = (await client().post(`/api/tasks/${taskId}/status`, {
          to,
          detail,
        })) as { task: Task };
        console.log(`"${task.title}" → ${TASK_STATUS_LABELS[task.status as TaskStatus]}`);
      } catch (error) {
        fail(error);
      }
    },
  );

program
  .command("move")
  .argument("<taskId>")
  .argument("<startAt>", "시작 (ISO 8601)")
  .argument("<endAt>", "종료 (ISO 8601)")
  .description("작업 일정 이동")
  .action(async (taskId: string, startAt: string, endAt: string) => {
    try {
      const { task } = (await client().post(`/api/tasks/${taskId}/move`, { startAt, endAt })) as {
        task: Task;
      };
      console.log(`"${task.title}" → ${time(task.startAt)}–${time(task.endAt)}`);
    } catch (error) {
      fail(error);
    }
  });

program
  .command("checkin")
  .argument("<checkInId>")
  .argument("<response>", `응답 (${Object.keys(CHECK_IN_RESPONSE_LABELS).join("|")})`)
  .option("--reason <reason>", "사유 (issue 응답 시 필수)")
  .description("자동 체크인 응답")
  .action(async (checkInId: string, response: string, opts: { reason?: string }) => {
    try {
      await client().post(`/api/checkins/${checkInId}/answer`, {
        response,
        detail: opts.reason ? { reason: opts.reason } : undefined,
      });
      console.log(`체크인 응답 완료: ${CHECK_IN_RESPONSE_LABELS[response as CheckInResponse] ?? response}`);
    } catch (error) {
      fail(error);
    }
  });

program
  .command("comment")
  .argument("<taskId>")
  .argument("<body...>", "댓글 내용")
  .option("--help-from <userId>", "도움을 요청할 사용자")
  .description("작업에 댓글/도움 요청 — 타인 작업에도 가능")
  .action(async (taskId: string, bodyWords: string[], opts: { helpFrom?: string }) => {
    try {
      await client().post(`/api/tasks/${taskId}/comments`, {
        body: bodyWords.join(" "),
        helpUserId: opts.helpFrom,
      });
      console.log(opts.helpFrom ? "도움 요청을 남겼습니다." : "댓글을 남겼습니다.");
    } catch (error) {
      fail(error);
    }
  });

const action = program.command("action").description("회의록 Action 후보 관리");

action
  .command("list")
  .option("--note <meetingNoteId>", "회의록 필터")
  .description("Action 후보 목록")
  .action(async (opts: { note?: string }) => {
    try {
      const { actionItems } = (await client().get(
        `/api/action-items${opts.note ? `?note=${opts.note}` : ""}`,
      )) as { actionItems: ActionItem[] };
      if (actionItems.length === 0) console.log("(후보 없음)");
      for (const item of actionItems) {
        console.log(
          `${item.id}  [${ACTION_ITEM_STATUS_LABELS[item.status]}] ${item.title} (담당 ${item.assigneeId ?? "미지정"}, 마감 ${item.dueAt ? time(item.dueAt) : "미지정"})`,
        );
      }
    } catch (error) {
      fail(error);
    }
  });

action
  .command("assign")
  .argument("<actionItemId>")
  .option("--assignee <userId>", "담당자")
  .option("--due <iso>", "마감 (ISO 8601)")
  .description("후보에 담당자/마감 지정")
  .action(async (actionItemId: string, opts: { assignee?: string; due?: string }) => {
    try {
      const { actionItem } = (await client().patch(`/api/action-items/${actionItemId}`, {
        assigneeId: opts.assignee,
        dueAt: opts.due,
      })) as { actionItem: ActionItem };
      console.log(`"${actionItem.title}" → ${ACTION_ITEM_STATUS_LABELS[actionItem.status]}`);
    } catch (error) {
      fail(error);
    }
  });

action
  .command("confirm")
  .argument("<actionItemId>")
  .description("후보를 Task로 확정 (담당자·마감 필수)")
  .action(async (actionItemId: string) => {
    try {
      const { task } = (await client().post(`/api/action-items/${actionItemId}/confirm`)) as {
        task: Task;
      };
      console.log(`Task 생성됨: ${task.id} "${task.title}" (담당 ${task.assigneeId})`);
    } catch (error) {
      fail(error);
    }
  });

for (const [sub, to] of [
  ["hold", "held"],
  ["ignore", "ignored"],
] as const) {
  action
    .command(sub)
    .argument("<actionItemId>")
    .description(sub === "hold" ? "후보 보류" : "후보 무시")
    .action(async (actionItemId: string) => {
      try {
        const { actionItem } = (await client().post(`/api/action-items/${actionItemId}/status`, {
          to,
        })) as { actionItem: ActionItem };
        console.log(`"${actionItem.title}" → ${ACTION_ITEM_STATUS_LABELS[actionItem.status]}`);
      } catch (error) {
        fail(error);
      }
    });
}

const pay = program.command("pay").description("결제 요청 관리");

pay
  .command("list")
  .description("결제 요청 목록 (계좌/금액은 권한에 따라 마스킹)")
  .action(async () => {
    try {
      const data = (await client().get("/api/payments")) as {
        rows: {
          id: string;
          title: string;
          status: string;
          requesterName: string;
          bankName: string;
          accountDisplay: string;
          amountDisplay: string | null;
          overdue: boolean;
        }[];
      };
      for (const row of data.rows) {
        const flags = row.overdue ? " ⚠마감초과" : "";
        console.log(
          `${row.id}  [${PAYMENT_STATUS_LABELS[row.status as keyof typeof PAYMENT_STATUS_LABELS]}]${flags} ${row.title} — ${row.requesterName} · ${row.bankName} ${row.accountDisplay} · ${row.amountDisplay ?? "금액 비공개"}`,
        );
      }
    } catch (error) {
      fail(error);
    }
  });

pay
  .command("add")
  .requiredOption("--title <title>")
  .requiredOption("--bank <bankName>")
  .requiredOption("--account <accountNumber>")
  .requiredOption("--amount <amount>", "금액 (원)")
  .requiredOption("--category <category>")
  .option("--due <iso>", "마감 (ISO 8601)")
  .option("--desc <description>")
  .description("결제 요청 등록")
  .action(
    async (opts: {
      title: string;
      bank: string;
      account: string;
      amount: string;
      category: string;
      due?: string;
      desc?: string;
    }) => {
      try {
        const { payment } = (await client().post("/api/payments", {
          title: opts.title,
          bankName: opts.bank,
          accountNumber: opts.account,
          amount: Number(opts.amount),
          category: opts.category,
          dueAt: opts.due,
          description: opts.desc,
        })) as { payment: { id: string; title: string } };
        console.log(`결제 요청 등록됨 (대기): ${payment.id} "${payment.title}"`);
      } catch (error) {
        fail(error);
      }
    },
  );

for (const [sub, to] of [
  ["done", "done"],
  ["cancel", "cancelled"],
  ["wait", "waiting"],
] as const) {
  pay
    .command(sub)
    .argument("<paymentId>")
    .description(`결제 상태를 ${PAYMENT_STATUS_LABELS[to]}로 변경`)
    .action(async (paymentId: string) => {
      try {
        const { payment } = (await client().post(`/api/payments/${paymentId}/status`, { to })) as {
          payment: { title: string; status: string };
        };
        console.log(
          `"${payment.title}" → ${PAYMENT_STATUS_LABELS[payment.status as keyof typeof PAYMENT_STATUS_LABELS]}`,
        );
      } catch (error) {
        fail(error);
      }
    });
}

program.parseAsync().catch(fail);
