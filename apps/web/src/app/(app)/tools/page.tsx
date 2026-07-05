import Link from "next/link";
import { ExternalLink, Terminal, Bot, KeyRound, ShieldCheck, MessageSquareQuote } from "lucide-react";
import { emailForUser } from "@que/core";
import { PageHeader } from "@/components/app/page-header";
import { CopyBlock } from "@/components/tools/copy-block";
import { getCurrentUser } from "@/lib/current-user";

export const dynamic = "force-dynamic";

// 기타 > MCP · CLI — 터미널(CLI)·AI(MCP)로 Que를 연결하는 온보딩/설정 화면.
// 전체 레퍼런스는 data/docs/que-tools-guide.md. 실 PAT는 노출하지 않고 발급 안내만 한다.
const PROD_URL = "https://que.griff.co.kr";
const DOC_URL =
  "https://github.com/sunghyeonhwang/Que/blob/main/data/docs/que-tools-guide.md";

// 자주 쓰는 AI(MCP) 자연어 명령 예시. 전체 186개는 que-tools-guide.md의 'AI 명령어 세트' 참고.
const AI_EXAMPLES: { ko: string; tools: string[] }[] = [
  { ko: "오늘 내 Que 일정 요약해주고, 못 끝낼 것 같은 건 내일로 옮겨줘.", tools: ["get_my_day", "move_task"] },
  { ko: "내일 오후 3시에 상세페이지 QA 잡아줘. 두 시간쯤 걸릴 듯.", tools: ["parse_task_input", "create_task"] },
  { ko: "그 작업 API 오류로 막혔어. 오승훈한테 도움 요청하고 오후 3시에 재확인. issue로 올려줘.", tools: ["change_task_status"] },
  { ko: "지금 대기 중인 체크인 있어? 첫 번째 건 작업중으로 답해줘.", tools: ["get_my_day", "respond_checkin"] },
  { ko: "이 회의록 액션 담당 김리원, 마감 금요일로 넣고 Task로 확정해줘.", tools: ["update_action_item", "confirm_action"] },
  { ko: "지금 팀에서 막혀 있는 사람 있어? 이슈 난 거 위주로.", tools: ["get_now_board"] },
  { ko: "대기 중인 결제 요청 보여줘. 마감 지난 거 있으면 위에.", tools: ["list_payment_requests"] },
  { ko: "김리원 디자인 작업에 '아이콘 두 단계만 키워주세요' 댓글 남겨줘.", tools: ["add_task_comment"] },
];

export default async function ToolsPage() {
  const user = await getCurrentUser();
  const email = emailForUser(user.id);
  const mockToken = `que_pat_${user.id}`;

  const mcpJson = `{
  "mcpServers": {
    "que": {
      "command": "pnpm",
      "args": ["-C", "<Que-저장소-경로>", "--filter", "@que/mcp", "start"],
      "env": {
        "QUE_API_URL": "${PROD_URL}",
        "QUE_TOKEN": "<본인 PAT>"
      }
    }
  }
}`;

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="MCP · CLI"
        subtitle="웹 말고 터미널(CLI)이나 내 AI(Claude·Gemini)로도 Que를 쓸 수 있습니다."
        actions={
          <Link
            href={DOC_URL}
            target="_blank"
            rel="noreferrer"
            className="flex h-10 items-center gap-1.5 rounded-lg border border-[var(--que-border)] px-3 text-sm font-medium text-[var(--que-text-secondary)] hover:bg-[var(--que-bg-muted)]"
          >
            전체 문서 <ExternalLink className="size-4" aria-hidden />
          </Link>
        }
      />

      <div className="flex flex-col gap-4">
        {/* 안전 규칙 */}
        <Card icon={ShieldCheck} title="어느 경로든 규칙은 동일">
          <ul className="ml-4 list-disc space-y-1 text-sm text-[var(--que-text-secondary)]">
            <li>CLI·MCP는 웹과 <b className="font-semibold text-[var(--que-text)]">같은 API·권한·검증·변경 내역(ChangeLog)</b>을 탑니다. 본인 작업만 수정, 타인 것은 조회·댓글·도움요청만.</li>
            <li>자연어 등록은 <b className="font-semibold text-[var(--que-text)]">해석 → 확인 → 실행</b> 2단계. 담당자·마감 없는 Action은 Task로 자동 생성되지 않습니다.</li>
            <li>변경 출처는 <code className="rounded bg-[var(--que-bg-muted)] px-1 py-0.5 text-xs">via: cli|mcp</code>로 기록됩니다.</li>
          </ul>
        </Card>

        {/* 내 연결 정보 */}
        <Card icon={KeyRound} title="내 연결 정보">
          <dl className="grid grid-cols-[7rem_1fr] gap-x-3 gap-y-2 text-sm">
            <dt className="text-[var(--que-text-tertiary)]">API 주소</dt>
            <dd className="font-mono text-[var(--que-text)]">{PROD_URL}</dd>
            <dt className="text-[var(--que-text-tertiary)]">내 계정</dt>
            <dd className="text-[var(--que-text)]">
              {user.name} · <span className="font-mono">{email}</span>
            </dd>
            <dt className="text-[var(--que-text-tertiary)]">사용자 id</dt>
            <dd className="font-mono text-[var(--que-text)]">{user.id}</dd>
          </dl>
          <div className="mt-3 rounded-lg border border-[var(--que-warning)]/30 bg-[var(--que-warning-bg)] px-3 py-2 text-sm text-[var(--que-text-secondary)]">
            <b className="font-semibold text-[var(--que-text)]">토큰(PAT)</b>은 개인 비밀값입니다.{" "}
            <Link href="/settings" className="font-semibold text-[var(--que-brand)] hover:underline">
              설정 › 액세스 토큰
            </Link>
            에서 <b className="font-semibold text-[var(--que-text)]">직접 발급</b>하세요(발급 순간 1회만 표시).
            로컬 개발용 mock 토큰 형식은 <code className="rounded bg-[var(--que-bg)] px-1 py-0.5 text-xs">{mockToken}</code> 입니다(프로덕션에선 통하지 않음).
          </div>
        </Card>

        {/* CLI */}
        <Card icon={Terminal} title="CLI 빠른 시작">
          <p className="mb-2 text-sm text-[var(--que-text-secondary)]">
            저장소를 clone하고 의존성을 설치한 뒤(최초 1회), 토큰을 저장하면 됩니다.
          </p>
          <CopyBlock
            label="설치 · 로그인"
            code={`git clone https://github.com/sunghyeonhwang/Que.git
cd Que && pnpm install
cd packages/cli && pnpm link --global && cd ../..   # que 명령 전역 등록
export QUE_API_URL=${PROD_URL}
que login <본인 PAT>
que me`}
          />
          <p className="mt-3 mb-2 text-sm text-[var(--que-text-secondary)]">자주 쓰는 명령</p>
          <CopyBlock
            label="예시"
            code={`que today                                   # 오늘 요약
que tasks --status 진행중                    # 작업 목록
que task-status <taskId> issue --reason "API 500" --help-from oh-seunghoon
que move <taskId> 2026-07-05T15:00 2026-07-05T16:00
que checkin <checkInId> working              # 체크인 응답
que action confirm <id>                      # 회의록 Action → Task 확정
que pay list                                 # 결제 요청 목록`}
          />
        </Card>

        {/* MCP */}
        <Card icon={Bot} title="AI(MCP) 연결">
          <p className="mb-2 text-sm text-[var(--que-text-secondary)]">
            아래 서버 정의를 내 AI 클라이언트에 등록하면 <b className="font-semibold text-[var(--que-text)]">말로</b> Que를 쓸 수 있습니다.
            <br />예: “오늘 내 Que 일정 보여줘” · “내일 3시에 상세페이지 QA 잡아줘”.
            <code className="mx-1 rounded bg-[var(--que-bg-muted)] px-1 py-0.5 text-xs">-C &lt;저장소경로&gt;</code>가 작업 디렉터리를 고정하므로 어느 클라이언트든 동일합니다.
          </p>

          <p className="mt-3 mb-1.5 text-sm font-semibold text-[var(--que-text)]">Claude Code (CLI)</p>
          <CopyBlock
            code={`claude mcp add que \\
  -e QUE_API_URL=${PROD_URL} \\
  -e QUE_TOKEN=<본인 PAT> \\
  -- pnpm -C <Que-저장소-경로> --filter @que/mcp start`}
          />

          <p className="mt-3 mb-1.5 text-sm font-semibold text-[var(--que-text)]">Claude Desktop 앱</p>
          <p className="mb-1.5 text-xs text-[var(--que-text-tertiary)]">
            <code className="rounded bg-[var(--que-bg-muted)] px-1 py-0.5">~/Library/Application Support/Claude/claude_desktop_config.json</code> 에 추가 후 앱 재시작
          </p>
          <CopyBlock code={mcpJson} />

          <p className="mt-3 mb-1.5 text-sm font-semibold text-[var(--que-text)]">Gemini CLI</p>
          <p className="mb-1.5 text-xs text-[var(--que-text-tertiary)]">
            <code className="rounded bg-[var(--que-bg-muted)] px-1 py-0.5">~/.gemini/settings.json</code> 에 같은 블록 추가 → 재시작 후 <code className="rounded bg-[var(--que-bg-muted)] px-1 py-0.5">/mcp</code>로 확인
          </p>
          <CopyBlock code={mcpJson} />
          <p className="mt-2 text-xs text-[var(--que-text-tertiary)]">
            ※ Gemini 웹앱은 로컬 MCP를 직접 연결하지 못합니다 → Gemini CLI를 사용하세요. Cursor·VS Code 등도 같은 형식으로 등록됩니다.
          </p>
        </Card>

        {/* AI 명령어 예시 */}
        <Card icon={MessageSquareQuote} title="자주 쓰는 AI 명령 예시">
          <p className="mb-3 text-sm text-[var(--que-text-secondary)]">
            연결하고 나면 이렇게 말하면 됩니다. 전체 <b className="font-semibold text-[var(--que-text)]">186개</b> 예시는{" "}
            <Link href={DOC_URL} target="_blank" rel="noreferrer" className="text-[var(--que-brand)] hover:underline">
              전체 문서
            </Link>
            의 ‘AI 명령어 세트’를 참고하세요.
          </p>
          <ul className="flex flex-col gap-2">
            {AI_EXAMPLES.map((ex) => (
              <li
                key={ex.ko}
                className="rounded-lg border border-[var(--que-border)] bg-[var(--que-bg-muted)] px-3 py-2.5"
              >
                <p className="text-sm text-[var(--que-text)]">
                  <span className="font-semibold text-[var(--que-brand)]">“</span>
                  {ex.ko}
                  <span className="font-semibold text-[var(--que-brand)]">”</span>
                </p>
                <p className="mt-1.5 flex flex-wrap gap-1.5">
                  {ex.tools.map((t) => (
                    <code
                      key={t}
                      className="rounded bg-[var(--que-violet-bg)] px-1.5 py-0.5 text-[11px] text-[var(--que-violet)]"
                    >
                      {t}
                    </code>
                  ))}
                </p>
              </li>
            ))}
          </ul>
        </Card>

        {/* 도구 요약 */}
        <Card icon={Bot} title="MCP 도구 (19종)">
          <p className="text-sm text-[var(--que-text-secondary)]">
            <b className="font-semibold text-[var(--que-text)]">조회(9)</b> get_me · get_my_day · get_now_board · get_team_status · list_tasks · list_action_candidates · list_payment_requests · list_task_comments · parse_task_input
          </p>
          <p className="mt-2 text-sm text-[var(--que-text-secondary)]">
            <b className="font-semibold text-[var(--que-text)]">변경(10)</b> create_task · change_task_status · move_task · respond_checkin · update_action_item · confirm_action · resolve_action⚠️ · add_task_comment · create_payment_request · update_payment_status⚠️
          </p>
          <p className="mt-2 text-xs text-[var(--que-text-tertiary)]">⚠️ = 되돌리기 어려운 작업(AI가 실행 전 확인). 자세한 파라미터·CLI 전체 명령은 전체 문서를 참고하세요.</p>
        </Card>
      </div>
    </div>
  );
}

function Card({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Terminal;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-[var(--que-border)] bg-[var(--que-bg)] p-4 shadow-[var(--que-shadow-sm)]">
      <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-[var(--que-text)]">
        <span className="flex size-8 items-center justify-center rounded-lg bg-[var(--que-brand-subtle)] text-[var(--que-brand)]">
          <Icon className="size-[18px]" aria-hidden />
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}
