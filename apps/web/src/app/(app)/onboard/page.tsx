import type { ReactNode } from "react";
import Link from "next/link";
import { CircleHelp } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";

// 기타 > 온보딩 — Que를 처음 쓰는 팀원용 시작 가이드.
// 외부 아티팩트(team-guide.html)를 shadcn 관례·Que 토큰(--que-*)으로 이식한 정적 콘텐츠.
// 데이터가 없어 서버 컴포넌트로 렌더한다(core 접근 없음 — 순수 안내 문구).
// 상태색 의미는 CLAUDE.md 고정: green=진행/완료, blue=예정/정보, amber=주의/대기,
// red=문제/취소, violet=회의록/응답대기.

export const metadata = {
  title: "온보딩 · Que",
};

// 3. 메뉴 지도 행. menu.ts IA와 일치(묶음: 매일/실행/운영/참조/기타).
const MENU_MAP: { group: string; menu: ReactNode; when: string }[] = [
  {
    group: "매일",
    menu: (
      <>
        <b>홈</b> · <b>데일리</b> · <b>Copilot</b> · <b>작업 목록</b>
      </>
    ),
    when: "아침 조망 → 10시 체크인 → 궁금하면 AI에게 → 내 할 일",
  },
  {
    group: "실행",
    menu: (
      <>
        <b>프로젝트</b>(칸반·간트) · <b>일정</b> · <b>Now</b>
      </>
    ),
    when: "상태 옮길 때 · 일정 볼 때 · 운영표(관리자)",
  },
  {
    group: "운영",
    menu: (
      <>
        <b>팀 현황</b> · <b>회의록</b> · <b>반복·마일스톤</b>
      </>
    ),
    when: "팀 상태 조망 · 회의 후 · 기한 약속 관리",
  },
  {
    group: "참조",
    menu: (
      <>
        <b>성과</b> · <b>멤버</b>
      </>
    ),
    when: "업무 분포(평가 아님) · 팀원 카드",
  },
  {
    group: "기타",
    menu: (
      <>
        <b>결제요청</b> · <b>수정사항</b> · <b>도움말</b> · <b>설계 FAQ</b>
      </>
    ),
    when: "필요할 때만 — 문제 발견은 수정사항에",
  },
];

// 상태색 범례. blue는 브랜드 토큰으로 표현(예정·정보 의미).
const STATUS_LEGEND: { color: string; label: string }[] = [
  { color: "var(--que-success)", label: "초록 = 진행·완료" },
  { color: "var(--que-brand)", label: "파랑 = 예정·안내" },
  { color: "var(--que-warning)", label: "노랑 = 주의·대기" },
  { color: "var(--que-error)", label: "빨강 = 문제" },
  { color: "var(--que-violet)", label: "보라 = 응답 대기" },
];

// 4. 툴별 안내(왜/어떻게/잘 쓰면). menu 라벨은 실제 라우트로 링크한다.
const TOOLS: {
  title: string;
  menu: string;
  href: string;
  why: string;
  how: string;
  win: string;
  copy?: string;
}[] = [
  {
    title: "데일리 · 스탠드업 체크인",
    menu: "데일리",
    href: "/daily",
    why: "아침 보고 회의는 8명×15분을 태웁니다. 보고를 위한 보고가 일을 밀어냅니다.",
    how: "10시 알림 → 폼 또는 AI 대화로 포커스 한마디. 어제·오늘 작업은 자동으로 붙습니다.",
    win: "회의 없는 아침. 막힘이 오전에 드러나 도움이 당일 갑니다. 11시엔 AI 팀 요약.",
    copy: "“보고는 30초. 나머지는 AI가.”",
  },
  {
    title: "OKR — 분기 목표와 월 핵심결과",
    menu: "데일리 › OKR 탭",
    href: "/daily?tab=okr",
    why: "바쁜 것과 전진하는 것은 다릅니다. Task ≠ Key Result.",
    how: "분기 목표 아래 월 KR(수동·작업 자동·상태 체크). 내 작업을 KR에 연결만 하면 됩니다.",
    win: "오늘 하는 일이 어느 목표를 미는지 매일 보입니다. 분기말 몰아치기가 사라집니다.",
  },
  {
    title: "Que Copilot",
    menu: "상단바 Copilot · ⌘K",
    href: "/copilot",
    why: "화면을 찾아다니고 폼을 채우는 시간 — 물어보면 됩니다.",
    how: "“오늘 팀 막힌 거?”는 실데이터로 답하고, “내일 10시 ○○ 잡아줘”는 확인 카드 → [실행].",
    win: "등록 10초. 답은 실데이터만, 변경은 확인 후만 — 이중 방어라 안심.",
    copy: "“실행은 언제나 사람이 확인한 후에.”",
  },
  {
    title: "작업 목록",
    menu: "작업 목록",
    href: "/today",
    why: "내 하루의 진입점이 없으면 할 일이 머릿속·포스트잇·슬랙에 흩어집니다.",
    how: "아침에 열어 확인 → 끝나면 체크 → 새 일은 자연어로(“금요일까지 배너 시안”).",
    win: "“오늘 뭐부터?”와 “그거 어떻게 됐어?”가 동시에 사라집니다.",
  },
  {
    title: "프로젝트 — 칸반과 간트",
    menu: "프로젝트",
    href: "/projects",
    why: "전황판이 없으면 PM의 머릿속이 단일 장애점이 됩니다.",
    how: "4열 칸반 드래그(홀드·문제는 사유 필수), 실수는 [실행 취소]. 보드·목록·캘린더·간트 전환.",
    win: "어느 열에 카드가 쌓였는지 5초. 상태 공유 회의가 드래그 하나로 대체됩니다.",
  },
  {
    title: "일정",
    menu: "일정",
    href: "/schedule",
    why: "회사 일정과 내 작업이 다른 곳에 살면, 충돌은 겹치고 나서야 압니다.",
    how: "주/월 달력에 일정+작업+마일스톤 칩. 중요 마일스톤은 노랑→주황 칩.",
    win: "충돌이 사전에 드러납니다. 외부 일정은 읽기 전용이라 실수로 못 건드립니다.",
  },
  {
    title: "팀 현황 · Now",
    menu: "팀 현황 · Now",
    href: "/team",
    why: "“지금 누가 뭐에 막혀 있나”를 알려면 8명에게 하나씩 물어야 했습니다.",
    how: "운영 보드에서 전원 상태 조망. 타인 작업엔 댓글·도움 요청으로.",
    win: "병목이 스스로 손을 드는 팀. 점수화는 없습니다 — 감시가 아니라 조망.",
  },
  {
    title: "회의록 · Action",
    menu: "회의록",
    href: "/meeting-notes",
    why: "회의 결정이 채팅에 흩어지면 “그거 누가 하기로 했지?”가 매주 반복됩니다.",
    how: "회의록 업로드 → 할 일 자동 추출 → 담당·기한 없으면 ‘확인 필요’로 남습니다.",
    win: "기록되지 않은 결정 0건. 회의가 실제 작업으로 이어집니다.",
    copy: "“결정이 곧 기록이다.”",
  },
  {
    title: "반복 업무 · 마일스톤",
    menu: "반복·마일스톤",
    href: "/planning",
    why: "매주 같은 일을 매번 등록하는 낭비, 큰 기한이 위험해지는 걸 늦게 아는 사고.",
    how: "반복 템플릿은 한 번 켜두면 자동 생성. 마일스톤이 위험하면 담당자에게 긴급 결정 카드(유지/연기/보류).",
    win: "기한 약속이 전 화면에 보이고, 위기는 회의를 기다리지 않습니다 — 나머지 6명은 0분.",
  },
  {
    title: "성과",
    menu: "성과",
    href: "/heatmap",
    why: "업무 몰림은 감으로 보이지 않습니다. 몰림을 못 보면 재배분도 못 합니다.",
    how: "완료율·기한 초과·히트맵을 기간별로.",
    win: "재배분의 근거가 생깁니다. 개인 평가가 아닙니다 — 순위도 점수도 없습니다.",
  },
  {
    title: "결제요청",
    menu: "결제요청",
    href: "/payments",
    why: "결제 요청이 DM으로 오가면 흘러가 누락됩니다.",
    how: "요청 등록 → 대기/완료 추적. 계좌·금액은 권한별로 가려집니다.",
    win: "“입금됐나요?” 문의가 사라집니다.",
  },
  {
    title: "알림 · Slack",
    menu: "알림",
    href: "/notifications",
    why: "도구를 열어야만 아는 정보는 이미 늦습니다.",
    how: "내게 관련된 신호만 모입니다. 아침 브리핑·스탠드업 버튼은 Slack DM으로 — 누르면 그 화면으로 바로.",
    win: "Que를 안 열어도 필요한 것이 먼저 찾아옵니다.",
  },
];

// 5. 지켜지는 규칙.
const RULES: { title: string; desc: string }[] = [
  { title: "본인 작업만 수정", desc: "타인 작업엔 댓글·도움 요청만. 내 기록은 내 말입니다." },
  { title: "개인 평가·점수화 없음", desc: "드러나는 것은 사람의 잘못이 아니라 병목입니다." },
  {
    title: "문제·홀드는 사유와 함께",
    desc: "맥락 없는 빨간불은 없습니다 — 무엇을 도우면 되는지가 함께 옵니다.",
  },
  {
    title: "AI는 확인 후에만 실행",
    desc: "답변은 실데이터에서만, 변경은 확인 카드에서 사람이 누른 후에만.",
  },
];

// 섹션 제목 헬퍼(번호 + 제목).
function SectionTitle({ no, children }: { no: number; children: ReactNode }) {
  return (
    <h2 className="mb-2 mt-14 flex items-center gap-2.5 text-xl font-bold tracking-tight text-[var(--que-text)] first:mt-0">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-[var(--que-brand-subtle)] text-sm font-bold tabular-nums text-[var(--que-brand)]">
        {no}
      </span>
      {children}
    </h2>
  );
}

export default function OnboardPage() {
  return (
    <div className="mx-auto max-w-[880px]">
      <PageHeader
        title="온보딩"
        subtitle="Que를 처음 쓰는 팀원을 위한 시작 가이드"
        actions={
          <Link
            href="/help"
            className="flex h-10 items-center gap-1.5 rounded-lg border border-[var(--que-border)] px-3 text-sm font-medium text-[var(--que-text-secondary)] hover:bg-[var(--que-bg-muted)]"
          >
            <CircleHelp className="size-4" aria-hidden />
            사용법은 도움말
          </Link>
        }
      />

      {/* 히어로 — 제목+태그라인+칩 수준의 안내 배너(장식 그래픽 없음). */}
      <section className="rounded-xl border border-[var(--que-border)] bg-[var(--que-bg)] p-5 shadow-[var(--que-shadow-sm)] md:p-6">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--que-brand)]">
          GRIFF-SYSTEM · 팀원용 시작 가이드
        </p>
        <h2 className="mt-2.5 text-balance text-2xl font-extrabold leading-tight text-[var(--que-text)] md:text-[28px]">
          Que — 감시하지 않고, 병목을 드러낸다
        </h2>
        <p className="mt-2 text-[var(--que-text-secondary)]">
          보고는 30초, 나머지는 AI가. 8명이 어떻게 움직이는지가 한 화면에 모입니다.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {[
            { k: "베타 시작", v: "7월 20일 (월)" },
            { k: "주소", v: "que.griff.co.kr" },
            { k: "첫 주 요구", v: "하루 1분" },
          ].map((chip) => (
            <span
              key={chip.k}
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--que-border)] bg-[var(--que-bg-muted)] px-3 py-1.5 text-[13px] font-semibold text-[var(--que-text-secondary)]"
            >
              {chip.k} <b className="text-[var(--que-brand)]">{chip.v}</b>
            </span>
          ))}
        </div>
      </section>

      {/* 1. 왜 바꾸나요 */}
      <SectionTitle no={1}>왜 바꾸나요</SectionTitle>
      <p className="mb-5 text-[var(--que-text-secondary)]">
        회사가 “사람 기억력”으로 돌아가면, 결정과 병목이 채팅 스레드 속으로 사라집니다.
      </p>
      <div className="grid gap-3.5 md:grid-cols-2">
        <div className="rounded-xl border border-[var(--que-border)] bg-[var(--que-bg)] p-5 shadow-[var(--que-shadow-sm)]">
          <h3 className="mb-2.5 text-[15px] font-semibold text-[var(--que-error)]">지금까지</h3>
          <ul className="list-disc space-y-1.5 pl-5 text-sm text-[var(--que-text-secondary)]">
            <li>보고는 회의로 — 아침마다 8명 × 15분</li>
            <li>결정은 슬랙 스레드에 흘러가고</li>
            <li>일정은 각자 머릿속에</li>
            <li>
              상태는 “그거 어떻게 됐어?”로 물어봐야
            </li>
          </ul>
        </div>
        <div className="rounded-xl border border-[var(--que-border)] bg-[var(--que-bg)] p-5 shadow-[var(--que-shadow-sm)]">
          <h3 className="mb-2.5 text-[15px] font-semibold text-[var(--que-success)]">Que에서는</h3>
          <ul className="list-disc space-y-1.5 pl-5 text-sm text-[var(--que-text-secondary)]">
            <li>
              보고는 AI가 만들고 — 사람은 <b className="text-[var(--que-text)]">결정만</b>
            </li>
            <li>결정은 기록되고, 회의록이 할 일로 이어지고</li>
            <li>일정·마감·마일스톤이 한 달력에</li>
            <li>병목이 스스로 손을 듭니다</li>
          </ul>
        </div>
      </div>

      {/* 2. 첫 주는 이것만 */}
      <SectionTitle no={2}>첫 주는 이것만 — 3가지</SectionTitle>
      <p className="mb-5 text-[var(--que-text-secondary)]">
        도구를 배우는 게 아니라 습관 하나를 붙입니다. 첫 주에 요구하는 시간은 하루 1분 미만입니다.
      </p>
      <div className="grid gap-3.5 md:grid-cols-3">
        {[
          {
            n: 1,
            title: "매일 10시, 체크인 30초",
            desc: (
              <>
                데일리 화면에서 오늘의 포커스 <b className="text-[var(--que-text)]">한마디</b>만.
                어제·오늘 작업은 자동으로 붙습니다. Slack 알림 버튼을 누르면 바로 열립니다.
              </>
            ),
          },
          {
            n: 2,
            title: "작업이 끝나면 완료 체크",
            desc: (
              <>
                작업 목록에서 체크 하나. “그거 어떻게 됐어?” 메시지가 사라집니다.
              </>
            ),
          },
          {
            n: 3,
            title: "막히면 막힘 칸에",
            desc: <>막힌 게 없으면 비워두면 됩니다. 적으면 오전 안에 도움이 갑니다.</>,
          },
        ].map((step) => (
          <div
            key={step.n}
            className="rounded-xl border border-[var(--que-border)] bg-[var(--que-bg)] p-[18px] shadow-[var(--que-shadow-sm)]"
          >
            <span className="flex size-[26px] items-center justify-center rounded-lg bg-[var(--que-brand-subtle)] text-sm font-bold text-[var(--que-brand)]">
              {step.n}
            </span>
            <h3 className="mb-1.5 mt-2.5 text-[15px] font-semibold text-[var(--que-text)]">
              {step.title}
            </h3>
            <p className="text-[13.5px] text-[var(--que-text-secondary)]">{step.desc}</p>
          </div>
        ))}
      </div>

      {/* 3. 메뉴 지도 */}
      <SectionTitle no={3}>메뉴 지도 — 언제 여나요</SectionTitle>
      <div className="overflow-x-auto rounded-xl border border-[var(--que-border)] bg-[var(--que-bg)] shadow-[var(--que-shadow-sm)]">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              {["묶음", "메뉴", "언제"].map((h) => (
                <th
                  key={h}
                  className="border-b border-[var(--que-border)] px-3 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-[var(--que-text-tertiary)]"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MENU_MAP.map((row) => (
              <tr key={row.group} className="last:[&>td]:border-b-0">
                <td className="whitespace-nowrap border-b border-[var(--que-border)] px-3 py-2.5 align-top font-bold text-[var(--que-brand)]">
                  {row.group}
                </td>
                <td className="border-b border-[var(--que-border)] px-3 py-2.5 align-top text-[var(--que-text)]">
                  {row.menu}
                </td>
                <td className="border-b border-[var(--que-border)] px-3 py-2.5 align-top text-[var(--que-text-secondary)]">
                  {row.when}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-[13.5px] text-[var(--que-text-secondary)]">
        {STATUS_LEGEND.map((s) => (
          <span key={s.label} className="inline-flex items-center gap-1.5">
            <span
              aria-hidden
              className="inline-block size-2.5 rounded-full"
              style={{ backgroundColor: s.color }}
            />
            {s.label}
          </span>
        ))}
      </div>

      {/* 4. 툴별 안내 */}
      <SectionTitle no={4}>툴별 안내 — 왜 · 어떻게 · 잘 쓰면</SectionTitle>
      <p className="mb-5 text-[var(--que-text-secondary)]">
        각 툴은 세 줄이면 충분합니다. 자세한 조작법은{" "}
        <Link href="/help" className="font-medium text-[var(--que-brand)] hover:underline">
          도움말
        </Link>
        에 전부 있습니다.
      </p>
      <div className="flex flex-col gap-3.5">
        {TOOLS.map((tool) => (
          <div
            key={tool.title}
            className="rounded-xl border border-[var(--que-border)] bg-[var(--que-bg)] p-5 shadow-[var(--que-shadow-sm)] md:p-[22px]"
          >
            <h3 className="flex flex-wrap items-baseline gap-2 text-[17px] font-semibold text-[var(--que-text)]">
              {tool.title}
              <Link
                href={tool.href}
                className="text-[12.5px] font-medium text-[var(--que-text-tertiary)] hover:text-[var(--que-brand)] hover:underline"
              >
                {tool.menu}
              </Link>
            </h3>
            <dl className="mt-3.5 grid grid-cols-[3rem_1fr] gap-x-3.5 gap-y-1.5 text-[14.5px] sm:grid-cols-[3.5rem_1fr]">
              <dt className="pt-0.5 text-[12.5px] font-bold tracking-wide text-[var(--que-error)]">
                왜
              </dt>
              <dd className="text-[var(--que-text-secondary)]">{tool.why}</dd>
              <dt className="pt-0.5 text-[12.5px] font-bold tracking-wide text-[var(--que-brand)]">
                어떻게
              </dt>
              <dd className="text-[var(--que-text-secondary)]">{tool.how}</dd>
              <dt className="pt-0.5 text-[12.5px] font-bold tracking-wide text-[var(--que-success)]">
                잘 쓰면
              </dt>
              <dd className="text-[var(--que-text-secondary)]">{tool.win}</dd>
            </dl>
            {tool.copy && (
              <p className="mt-3 text-[13.5px] font-semibold text-[var(--que-brand)]">{tool.copy}</p>
            )}
          </div>
        ))}
      </div>

      {/* 5. 지켜지는 규칙 */}
      <SectionTitle no={5}>지켜지는 규칙 — 그래서 안심하고 씁니다</SectionTitle>
      <div className="grid gap-3 md:grid-cols-2">
        {RULES.map((rule) => (
          <div
            key={rule.title}
            className="rounded-xl border border-[var(--que-border)] bg-[var(--que-bg)] p-4 text-sm shadow-[var(--que-shadow-sm)] md:p-[18px]"
          >
            <b className="mb-1 block text-[var(--que-text)]">{rule.title}</b>
            <span className="text-[var(--que-text-secondary)]">{rule.desc}</span>
          </div>
        ))}
      </div>

      {/* 6. 시작하기 */}
      <SectionTitle no={6}>시작하기</SectionTitle>
      <div className="rounded-xl border border-[var(--que-border)] bg-[var(--que-brand-subtle)] p-5 md:p-[22px]">
        <b className="text-[var(--que-text)]">첫날 할 일 3개</b>
        <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-[var(--que-text)]">
          <li>
            로그인 — 회사 이메일과 안내받은 비밀번호. 로그인 화면에서{" "}
            <b>아이디 기억하기</b>를 체크해 두면 다음부터 바로 들어옵니다.
          </li>
          <li>
            10시에{" "}
            <Link href="/daily" className="font-semibold text-[var(--que-brand)] hover:underline">
              데일리
            </Link>
            에서 체크인 한 번 (30초).
          </li>
          <li>
            <Link href="/copilot" className="font-semibold text-[var(--que-brand)] hover:underline">
              Copilot
            </Link>
            에 아무거나 물어보기 — “오늘 나 뭐 해야 해?”
          </li>
        </ol>
        <p className="mt-3.5 text-sm text-[var(--que-text-secondary)]">
          막히면:{" "}
          <Link href="/help" className="font-semibold text-[var(--que-brand)] hover:underline">
            도움말
          </Link>
          (사용 설명서) ·{" "}
          <Link href="/faq" className="font-semibold text-[var(--que-brand)] hover:underline">
            설계 FAQ
          </Link>
          (왜 이렇게 만들었나) · Copilot에게 질문. 오류를 발견하면{" "}
          <Link href="/revisions" className="font-semibold text-[var(--que-brand)] hover:underline">
            수정사항
          </Link>{" "}
          메뉴에 남겨주세요 — 그게 베타에 제일 큰 기여입니다.
        </p>
      </div>

      {/* 하단 상호 링크 (터치 40px+) */}
      <div className="mt-8 flex flex-wrap gap-2 border-t border-[var(--que-border)] pt-5">
        <Link
          href="/help"
          className="inline-flex h-10 items-center rounded-lg border border-[var(--que-border)] px-4 text-sm font-medium text-[var(--que-text-secondary)] hover:bg-[var(--que-bg-muted)]"
        >
          도움말 — 화면별 사용법
        </Link>
        <Link
          href="/faq"
          className="inline-flex h-10 items-center rounded-lg border border-[var(--que-border)] px-4 text-sm font-medium text-[var(--que-text-secondary)] hover:bg-[var(--que-bg-muted)]"
        >
          설계 FAQ — 왜 이렇게 만들었나
        </Link>
      </div>

      <p className="mt-6 text-[13.5px] text-[var(--que-text-tertiary)]">
        Que · GRIFF-SYSTEM — 감시하는 도구가 아니라, 병목을 드러내는 도구. · 베타 2026-07-20
      </p>
    </div>
  );
}
