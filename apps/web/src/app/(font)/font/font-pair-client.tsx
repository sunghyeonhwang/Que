"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ExternalLink,
  Lock,
  LayoutGrid,
  Moon,
  Shuffle,
  Sun,
  Unlock,
  X,
} from "lucide-react";

import {
  FONTS,
  MOOD_LABEL,
  poolFor,
  type FontDef,
  type Mood,
} from "./fonts-data";

// ── 상수 ────────────────────────────────────────────────────────────────
type MoodKey = Mood | "free";
const MOOD_ORDER: MoodKey[] = [
  "free",
  "warm",
  "minimal",
  "bold",
  "retro",
  "elegant",
];
const GLYPHS = "가나다라마바사 아자차카타파하 1234567890 AaBbCc";
const BY_FAMILY = new Map(FONTS.map((f) => [f.family, f]));
const DEFAULT_HEADING =
  BY_FAMILY.get("S-CoreDream-6Bold") ?? FONTS[0];
const DEFAULT_BODY =
  BY_FAMILY.get("Pretendard Variable") ?? FONTS[0];

// 에디토리얼 샘플(자체 작성 · 저작권 없음).
const ESSAY_1 =
  "좋은 글자는 소리 없이 말을 건다. 획의 두께와 여백의 간격만으로도 문장은 서두르거나 천천히 걷는다. 우리는 내용을 읽기 전에 먼저 분위기를 읽는다. 같은 문장이라도 어떤 글자에 담기느냐에 따라 다른 온도를 갖는다.";
const ESSAY_2 =
  "제목이 목청을 높이면 본문은 한 발 물러서 균형을 잡는다. 두 글자가 서로를 밀어내지 않고 자리를 나눌 때 화면은 비로소 숨을 쉰다. 페어링은 취향이 아니라 배려다. 읽는 사람의 눈이 지치지 않도록, 글자는 서로의 자리를 지킨다.";

// ── 폰트 로딩(선택된 것만 head에 주입 · 중복 방지) ─────────────────────
const loadedFonts = new Set<string>();
function ensureFont(f: FontDef | null | undefined) {
  if (!f || typeof document === "undefined" || loadedFonts.has(f.family)) return;
  loadedFonts.add(f.family);
  if (f.stylesheet) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = f.stylesheet;
    link.dataset.fp = f.family;
    document.head.appendChild(link);
  } else if (f.woff) {
    const style = document.createElement("style");
    style.dataset.fp = f.family;
    style.textContent = `@font-face{font-family:'${f.family}';src:url('${f.woff}') format('woff');font-display:swap}`;
    document.head.appendChild(style);
  }
}

function ff(f: FontDef | null | undefined) {
  return f ? `'${f.family}', system-ui, sans-serif` : "inherit";
}
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function infoLabel(f: FontDef) {
  return f.infoUrl.includes("noonnu") ? "눈누" : "구글 폰트";
}

// ── 테마 토큰 ───────────────────────────────────────────────────────────
// 포인트 컬러 = 버밀리언 코럴(#ec5a29 / 라이트 #d94a1c). Que 상태색·금지된 인디고/퍼플과 구분.
const DARK_VARS = {
  "--fp-bg": "#0d0d0f",
  "--fp-surface": "#161619",
  "--fp-surface-2": "#1f1f24",
  "--fp-border": "#2a2a31",
  "--fp-text": "#f3f3f5",
  "--fp-muted": "#9c9ca6",
  "--fp-accent": "#ec5a29",
  "--fp-accent-fg": "#ffffff",
} as React.CSSProperties;
const LIGHT_VARS = {
  "--fp-bg": "#f6f5f2",
  "--fp-surface": "#ffffff",
  "--fp-surface-2": "#eeece6",
  "--fp-border": "#e2dfd7",
  "--fp-text": "#18181b",
  "--fp-muted": "#6b6b73",
  "--fp-accent": "#d94a1c",
  "--fp-accent-fg": "#ffffff",
} as React.CSSProperties;

// ── 역할 뱃지 ───────────────────────────────────────────────────────────
function RoleBadges({ font }: { font: FontDef }) {
  return (
    <span className="inline-flex gap-1">
      {font.roles.includes("heading") && (
        <span className="rounded-full border border-[var(--fp-border)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--fp-muted)]">
          제목
        </span>
      )}
      {font.roles.includes("body") && (
        <span className="rounded-full border border-[var(--fp-border)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--fp-muted)]">
          본문
        </span>
      )}
    </span>
  );
}

// ── 메인 ────────────────────────────────────────────────────────────────
export function FontPairClient() {
  // 초기 상태는 URL(공유 링크)에서 복원한다 — setState-in-effect 없이 초기화 함수로 파생.
  const params = useSearchParams();
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [mood, setMood] = useState<MoodKey>(() => {
    const m = params.get("m");
    return m && (MOOD_ORDER as string[]).includes(m) ? (m as MoodKey) : "free";
  });
  const [heading, setHeading] = useState<FontDef>(
    () => BY_FAMILY.get(params.get("h") ?? "") ?? DEFAULT_HEADING,
  );
  const [body, setBody] = useState<FontDef>(
    () => BY_FAMILY.get(params.get("b") ?? "") ?? DEFAULT_BODY,
  );
  const [headingLocked, setHeadingLocked] = useState(false);
  const [bodyLocked, setBodyLocked] = useState(false);
  const [brand, setBrand] = useState("그리프");
  const [slogan, setSlogan] = useState("우리는 화면 너머를 만든다");
  const [listOpen, setListOpen] = useState(false);

  // 현재 페어/무드를 공유용 URL에 반영(replaceState — history 오염 없음, setState 아님).
  useEffect(() => {
    const sp = new URLSearchParams();
    sp.set("h", heading.family);
    sp.set("b", body.family);
    sp.set("m", mood);
    window.history.replaceState(null, "", `?${sp.toString()}`);
  }, [heading, body, mood]);

  // 현재 페어 폰트 로드.
  useEffect(() => {
    ensureFont(heading);
    ensureFont(body);
  }, [heading, body]);

  // 폰트 목록 뷰: 열 때만 전체 lazy 로드.
  useEffect(() => {
    if (listOpen) FONTS.forEach(ensureFont);
  }, [listOpen]);

  // 페어링 롤(잠금 슬롯 유지 · body는 heading과 다른 family · mood body 풀 없으면 free로 폴백).
  const rollPair = useCallback(
    (moodArg: MoodKey) => {
      const hPool = poolFor(moodArg, "heading");
      let bPool = poolFor(moodArg, "body");
      if (bPool.length === 0) bPool = poolFor("free", "body");
      const nextH = headingLocked ? heading : pick(hPool.length ? hPool : FONTS);
      let cands = bPool.filter((f) => f.family !== nextH.family);
      if (cands.length === 0) cands = bPool.length ? bPool : FONTS;
      const nextB = bodyLocked ? body : pick(cands);
      setHeading(nextH);
      setBody(nextB);
    },
    [headingLocked, bodyLocked, heading, body],
  );

  const handleMood = (m: MoodKey) => {
    setMood(m);
    rollPair(m);
  };

  const vars = theme === "dark" ? DARK_VARS : LIGHT_VARS;

  return (
    <div
      style={vars}
      className="flex min-h-dvh flex-col bg-[var(--fp-bg)] text-[var(--fp-text)] [font-feature-settings:'ss01']"
    >
      {/* ── 헤더 ── */}
      <header className="sticky top-0 z-30 border-b border-[var(--fp-border)] bg-[var(--fp-bg)]/95 backdrop-blur supports-[backdrop-filter]:bg-[var(--fp-bg)]/80">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2">
            <span
              className="grid h-8 w-8 place-items-center rounded-md text-sm font-black"
              style={{ background: "var(--fp-accent)", color: "var(--fp-accent-fg)" }}
              aria-hidden
            >
              F
            </span>
            <span className="text-[15px] font-semibold tracking-tight">
              폰트페어 <span className="text-[var(--fp-muted)]">· GRIFF</span>
            </span>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => setListOpen(true)}
              className="hidden h-10 items-center gap-1.5 rounded-full border border-[var(--fp-border)] px-4 text-sm font-medium hover:bg-[var(--fp-surface-2)] sm:inline-flex"
            >
              <LayoutGrid className="h-4 w-4" aria-hidden />
              폰트 목록
            </button>
            <button
              type="button"
              onClick={() => rollPair(mood)}
              aria-label="폰트 페어 셔플"
              className="inline-flex h-10 items-center gap-2 rounded-full px-5 text-sm font-bold shadow-sm transition active:scale-95"
              style={{ background: "var(--fp-accent)", color: "var(--fp-accent-fg)" }}
            >
              <Shuffle className="h-4 w-4" aria-hidden />
              페어링
            </button>
            <button
              type="button"
              onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
              aria-label={theme === "dark" ? "라이트 모드로 전환" : "다크 모드로 전환"}
              className="grid h-10 w-10 place-items-center rounded-full border border-[var(--fp-border)] hover:bg-[var(--fp-surface-2)]"
            >
              {theme === "dark" ? (
                <Sun className="h-4 w-4" aria-hidden />
              ) : (
                <Moon className="h-4 w-4" aria-hidden />
              )}
            </button>
          </div>

          {/* 무드 칩 — 모바일 가로 스크롤 */}
          <div className="-mx-4 w-[calc(100%+2rem)] overflow-x-auto px-4 sm:mx-0 sm:w-full sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex w-max gap-2 sm:w-full sm:flex-wrap">
              {MOOD_ORDER.map((m) => {
                const active = mood === m;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => handleMood(m)}
                    aria-pressed={active}
                    className="h-10 whitespace-nowrap rounded-full border px-4 text-sm font-medium transition"
                    style={
                      active
                        ? {
                            background: "var(--fp-accent)",
                            color: "var(--fp-accent-fg)",
                            borderColor: "var(--fp-accent)",
                          }
                        : {
                            borderColor: "var(--fp-border)",
                            color: "var(--fp-text)",
                          }
                    }
                  >
                    {MOOD_LABEL[m]}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setListOpen(true)}
                className="inline-flex h-10 items-center gap-1.5 whitespace-nowrap rounded-full border border-[var(--fp-border)] px-4 text-sm font-medium sm:hidden"
              >
                <LayoutGrid className="h-4 w-4" aria-hidden />
                목록
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ── 쇼케이스 본문 ── */}
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-32 pt-8 sm:px-6">
        {/* 커스텀 문구 입력 */}
        <div className="mb-8 grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-[var(--fp-muted)]">브랜드명</span>
            <input
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              maxLength={24}
              className="h-11 rounded-lg border border-[var(--fp-border)] bg-[var(--fp-surface)] px-3.5 text-sm outline-none focus:border-[var(--fp-accent)]"
              placeholder="브랜드명"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-[var(--fp-muted)]">슬로건</span>
            <input
              value={slogan}
              onChange={(e) => setSlogan(e.target.value)}
              maxLength={60}
              className="h-11 rounded-lg border border-[var(--fp-border)] bg-[var(--fp-surface)] px-3.5 text-sm outline-none focus:border-[var(--fp-accent)]"
              placeholder="슬로건"
            />
          </label>
        </div>

        {/* ① 브랜드 아이덴티티 */}
        <Section n="01" title="브랜드 아이덴티티">
          <div className="rounded-2xl border border-[var(--fp-border)] bg-[var(--fp-surface)] px-6 py-14 text-center sm:px-10 sm:py-20">
            <p
              className="text-[11px] font-semibold uppercase tracking-[0.35em] text-[var(--fp-muted)]"
              style={{ fontFamily: ff(body) }}
            >
              EST. 2019 · SEOUL
            </p>
            <h1
              className="mt-4 break-keep text-5xl leading-[1.05] sm:text-7xl"
              style={{ fontFamily: ff(heading), fontWeight: 800 }}
            >
              {brand || "브랜드명"}
            </h1>
            <p
              className="mx-auto mt-5 max-w-xl break-keep text-lg text-[var(--fp-muted)] sm:text-xl"
              style={{ fontFamily: ff(body) }}
            >
              {slogan || "슬로건을 입력하세요"}
            </p>
          </div>
        </Section>

        {/* ② 에디토리얼 */}
        <Section n="02" title="에디토리얼">
          <article className="rounded-2xl border border-[var(--fp-border)] bg-[var(--fp-surface)] p-6 sm:p-10">
            <p
              className="text-xs font-semibold uppercase tracking-widest"
              style={{ fontFamily: ff(body), color: "var(--fp-accent)" }}
            >
              TYPOGRAPHY
            </p>
            <h2
              className="mt-3 break-keep text-3xl leading-tight sm:text-5xl"
              style={{ fontFamily: ff(heading), fontWeight: 700 }}
            >
              글자는 목소리를 갖는다
            </h2>
            <p
              className="mt-4 break-keep text-lg text-[var(--fp-muted)] sm:text-xl"
              style={{ fontFamily: ff(body) }}
            >
              타이포그래피는 정보를 넘어 감정을 전달하는 첫 번째 인터페이스다.
            </p>
            <div
              className="mt-6 grid gap-5 break-keep text-[15px] leading-8 sm:grid-cols-2 sm:text-base"
              style={{ fontFamily: ff(body) }}
            >
              <p>{ESSAY_1}</p>
              <p>{ESSAY_2}</p>
            </div>
          </article>
        </Section>

        {/* ③ UI 카드 */}
        <Section n="03" title="UI 카드">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-[var(--fp-border)] bg-[var(--fp-surface)] p-6">
              <span
                className="inline-block rounded-full px-2.5 py-1 text-xs font-semibold"
                style={{ background: "var(--fp-surface-2)", fontFamily: ff(body) }}
              >
                신규
              </span>
              <h3
                className="mt-3 break-keep text-2xl"
                style={{ fontFamily: ff(heading), fontWeight: 700 }}
              >
                새 프로젝트 시작
              </h3>
              <p
                className="mt-2 break-keep text-sm text-[var(--fp-muted)]"
                style={{ fontFamily: ff(body) }}
              >
                아이디어를 화면으로 옮기는 첫 단계입니다. 팀을 초대하고 목표를 정하면 준비가 끝납니다.
              </p>
              <button
                type="button"
                className="mt-5 inline-flex h-10 items-center rounded-lg px-5 text-sm font-semibold"
                style={{
                  background: "var(--fp-accent)",
                  color: "var(--fp-accent-fg)",
                  fontFamily: ff(body),
                }}
              >
                지금 만들기
              </button>
            </div>
            <div className="rounded-2xl border border-[var(--fp-border)] bg-[var(--fp-surface)] p-6">
              <div className="flex items-baseline justify-between">
                <h3
                  className="break-keep text-2xl"
                  style={{ fontFamily: ff(heading), fontWeight: 700 }}
                >
                  이번 주 요약
                </h3>
                <span
                  className="text-3xl font-black"
                  style={{ fontFamily: ff(heading), color: "var(--fp-accent)" }}
                >
                  92%
                </span>
              </div>
              <p
                className="mt-2 break-keep text-sm text-[var(--fp-muted)]"
                style={{ fontFamily: ff(body) }}
              >
                예정된 작업 대부분이 순조롭게 진행되고 있습니다.
              </p>
              <div className="mt-4 space-y-2" style={{ fontFamily: ff(body) }}>
                {[
                  ["완료된 작업", "18건"],
                  ["진행 중", "5건"],
                  ["대기", "2건"],
                ].map(([k, v]) => (
                  <div
                    key={k}
                    className="flex items-center justify-between border-b border-[var(--fp-border)] pb-2 text-sm last:border-0"
                  >
                    <span className="text-[var(--fp-muted)]">{k}</span>
                    <span className="font-semibold">{v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Section>

        {/* ④ 글리프 시트 */}
        <Section n="04" title="글리프 시트">
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { role: "제목", font: heading },
              { role: "본문", font: body },
            ].map(({ role, font }) => (
              <div
                key={role}
                className="rounded-2xl border border-[var(--fp-border)] bg-[var(--fp-surface)] p-6"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className="rounded-md px-2 py-0.5 text-[11px] font-bold"
                    style={{ background: "var(--fp-accent)", color: "var(--fp-accent-fg)" }}
                  >
                    {role}
                  </span>
                  <span className="text-sm font-semibold">{font.label}</span>
                  <RoleBadges font={font} />
                  <a
                    href={font.infoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-auto inline-flex items-center gap-1 text-xs text-[var(--fp-muted)] hover:text-[var(--fp-text)]"
                  >
                    {infoLabel(font)}
                    <ExternalLink className="h-3 w-3" aria-hidden />
                  </a>
                </div>
                <p
                  className="mt-4 break-keep text-2xl leading-relaxed sm:text-[28px]"
                  style={{ fontFamily: ff(font) }}
                >
                  {GLYPHS}
                </p>
              </div>
            ))}
          </div>
        </Section>
      </main>

      {/* ── 하단 고정 페어 바 ── */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--fp-border)] bg-[var(--fp-surface)]/95 backdrop-blur">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-3 px-4 py-3 sm:px-6">
          <PairSlot
            role="제목"
            font={heading}
            locked={headingLocked}
            onToggleLock={() => setHeadingLocked((v) => !v)}
          />
          <PairSlot
            role="본문"
            font={body}
            locked={bodyLocked}
            onToggleLock={() => setBodyLocked((v) => !v)}
          />
        </div>
      </div>

      {/* ── 폰트 목록 오버레이 ── */}
      {listOpen && (
        <FontListOverlay onClose={() => setListOpen(false)} />
      )}
    </div>
  );
}

// ── 섹션 래퍼 ───────────────────────────────────────────────────────────
function Section({
  n,
  title,
  children,
}: {
  n: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-10">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-xs font-mono text-[var(--fp-accent)]">{n}</span>
        <h2 className="text-sm font-semibold tracking-wide text-[var(--fp-muted)]">
          {title}
        </h2>
        <span className="h-px flex-1 bg-[var(--fp-border)]" />
      </div>
      {children}
    </section>
  );
}

// ── 하단 페어 슬롯 ──────────────────────────────────────────────────────
function PairSlot({
  role,
  font,
  locked,
  onToggleLock,
}: {
  role: string;
  font: FontDef;
  locked: boolean;
  onToggleLock: () => void;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2 rounded-xl border border-[var(--fp-border)] bg-[var(--fp-bg)] px-3 py-2">
      <span className="shrink-0 text-[11px] font-semibold text-[var(--fp-muted)]">
        {role}
      </span>
      <a
        href={font.infoUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex min-w-0 flex-1 items-center gap-1 truncate text-sm font-semibold hover:text-[var(--fp-accent)]"
        title={`${font.label} — ${infoLabel(font)} 열기`}
      >
        <span className="truncate">{font.label}</span>
        <ExternalLink className="h-3 w-3 shrink-0 text-[var(--fp-muted)]" aria-hidden />
      </a>
      <button
        type="button"
        onClick={onToggleLock}
        aria-pressed={locked}
        aria-label={`${role} 폰트 ${locked ? "잠금 해제" : "잠금"}`}
        className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border transition"
        style={
          locked
            ? {
                background: "var(--fp-accent)",
                color: "var(--fp-accent-fg)",
                borderColor: "var(--fp-accent)",
              }
            : { borderColor: "var(--fp-border)", color: "var(--fp-muted)" }
        }
      >
        {locked ? (
          <Lock className="h-4 w-4" aria-hidden />
        ) : (
          <Unlock className="h-4 w-4" aria-hidden />
        )}
      </button>
    </div>
  );
}

// ── 폰트 목록 오버레이 ──────────────────────────────────────────────────
function FontListOverlay({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-[var(--fp-bg)]"
      role="dialog"
      aria-modal="true"
      aria-label="전체 폰트 목록"
    >
      <div className="sticky top-0 flex items-center justify-between border-b border-[var(--fp-border)] px-4 py-3 sm:px-6">
        <h2 className="text-base font-semibold">
          폰트 목록{" "}
          <span className="text-[var(--fp-muted)]">· {FONTS.length}종</span>
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="폰트 목록 닫기"
          className="grid h-10 w-10 place-items-center rounded-full border border-[var(--fp-border)] hover:bg-[var(--fp-surface-2)]"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
        <div className="mx-auto grid max-w-6xl gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {FONTS.map((f) => (
            <a
              key={f.family}
              href={f.infoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="group rounded-xl border border-[var(--fp-border)] bg-[var(--fp-surface)] p-4 transition hover:border-[var(--fp-accent)]"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-[var(--fp-muted)]">{f.label}</span>
                <RoleBadges font={f} />
              </div>
              <p
                className="mt-3 break-keep text-2xl leading-snug"
                style={{ fontFamily: ff(f) }}
              >
                {f.label}
              </p>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
