"use client";

import {
  useCallback,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";
import { useSearchParams } from "next/navigation";
import {
  Check,
  Copy,
  ExternalLink,
  Lock,
  LayoutGrid,
  Moon,
  RotateCcw,
  Shuffle,
  SlidersHorizontal,
  Sparkles,
  Star,
  Sun,
  Trash2,
  Unlock,
  X,
} from "lucide-react";

import {
  CURATED_PAIRS,
  FONTS,
  MOOD_LABEL,
  poolFor,
  type CuratedPair,
  type FontDef,
  type Mood,
} from "./fonts-data";

// ── 상수 ────────────────────────────────────────────────────────────────
type MoodKey = Mood | "free";
type SlotKey = "h" | "s" | "b";
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
const DEFAULT_HEADING = BY_FAMILY.get("S-CoreDream-6Bold") ?? FONTS[0];
const DEFAULT_SUB = BY_FAMILY.get("GmarketSansMedium") ?? FONTS[0];
const DEFAULT_BODY = BY_FAMILY.get("Pretendard Variable") ?? FONTS[0];
const SAVE_KEY = "fontpair-saved";

// 에디토리얼 샘플(자체 작성 · 저작권 없음).
const ESSAY_1 =
  "좋은 글자는 소리 없이 말을 건다. 획의 두께와 여백의 간격만으로도 문장은 서두르거나 천천히 걷는다. 우리는 내용을 읽기 전에 먼저 분위기를 읽는다. 같은 문장이라도 어떤 글자에 담기느냐에 따라 다른 온도를 갖는다.";
const ESSAY_2 =
  "제목이 목청을 높이면 본문은 한 발 물러서 균형을 잡는다. 두 글자가 서로를 밀어내지 않고 자리를 나눌 때 화면은 비로소 숨을 쉰다. 페어링은 취향이 아니라 배려다. 읽는 사람의 눈이 지치지 않도록, 글자는 서로의 자리를 지킨다.";

// ── 파인튜닝 ────────────────────────────────────────────────────────────
interface SlotTune {
  scale: number; // 0.7~1.5
  ls: number; // letter-spacing em, -0.05~0.1
  lh: number; // line-height, 1.0~2.2
  weight: number; // 100~900 step 100
}
interface TuningState {
  h: SlotTune;
  s: SlotTune;
  b: SlotTune;
}
function defaultTuning(): TuningState {
  return {
    h: { scale: 1, ls: 0, lh: 1.2, weight: 700 },
    s: { scale: 1, ls: 0, lh: 1.4, weight: 500 },
    b: { scale: 1, ls: 0, lh: 1.7, weight: 400 },
  };
}

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
function ensureFamily(family: string) {
  ensureFont(BY_FAMILY.get(family));
}

function ff(f: FontDef | null | undefined) {
  return f ? `'${f.family}', system-ui, sans-serif` : "inherit";
}
function ffName(family: string) {
  return BY_FAMILY.has(family) ? `'${family}', system-ui, sans-serif` : "inherit";
}
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function infoLabel(f: FontDef) {
  return f.infoUrl.includes("noonnu") ? "눈누" : "구글 폰트";
}
/** 부제 풀 = 역할 무관 · 무드 필터만. free는 전체. */
function subPool(mood: MoodKey): FontDef[] {
  return mood === "free" ? FONTS : FONTS.filter((f) => f.moods.includes(mood));
}

/** 슬롯 튜닝을 CSS 변수(calc)로 참조하는 텍스트 스타일. base=기준 폰트 크기(clamp 등). */
function slot(font: FontDef, key: SlotKey, base: string): React.CSSProperties {
  const s: Record<string, string> = {
    fontFamily: ff(font),
    fontSize: `calc(${base} * var(--fp-${key}-scale))`,
    letterSpacing: `var(--fp-${key}-ls)`,
    lineHeight: `var(--fp-${key}-lh)`,
    fontWeight: `var(--fp-${key}-w)`,
  };
  return s as React.CSSProperties;
}

/** 실사용 CSS 코드 문자열 — stylesheet=link, woff=@font-face + 튜닝 반영 사용 예시. */
function buildCss(h: FontDef, s: FontDef, b: FontDef, t: TuningState) {
  const seen = new Set<string>();
  const links: string[] = [];
  const faces: string[] = [];
  for (const f of [h, s, b]) {
    if (seen.has(f.family)) continue;
    seen.add(f.family);
    if (f.stylesheet) {
      links.push(`<link rel="stylesheet" href="${f.stylesheet}">`);
    } else if (f.woff) {
      faces.push(
        `@font-face {\n  font-family: '${f.family}';\n  src: url('${f.woff}') format('woff');\n  font-display: swap;\n}`,
      );
    }
  }
  const rule = (sel: string, f: FontDef, tune: SlotTune) =>
    `${sel} {\n  font-family: '${f.family}';\n  letter-spacing: ${tune.ls}em;\n  line-height: ${tune.lh};\n  font-weight: ${tune.weight};\n} /* 크기 스케일 ${tune.scale.toFixed(2)}× */`;
  const usage = [
    rule("h1", h, t.h),
    rule("h2", s, t.s),
    rule("body", b, t.b),
  ].join("\n");
  return [links.join("\n"), faces.join("\n\n"), usage]
    .filter(Boolean)
    .join("\n\n");
}

// ── 저장 페어 · localStorage 외부 스토어(useSyncExternalStore로 hydration 안전) ──
interface SavedPair {
  h: string;
  s: string;
  b: string;
  mood: MoodKey;
  savedAt: number;
  tuning?: TuningState; // 하위호환: 없으면 기본값
}
const EMPTY_SAVED: SavedPair[] = [];
let savedCache: { raw: string; val: SavedPair[] } | null = null;
const savedListeners = new Set<() => void>();

function readSaved(): SavedPair[] {
  if (typeof window === "undefined") return EMPTY_SAVED;
  const raw = window.localStorage.getItem(SAVE_KEY) ?? "";
  if (!savedCache || savedCache.raw !== raw) {
    let val: SavedPair[] = [];
    try {
      val = raw ? (JSON.parse(raw) as SavedPair[]) : [];
    } catch {
      val = [];
    }
    savedCache = { raw, val };
  }
  return savedCache.val;
}
function writeSaved(next: SavedPair[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SAVE_KEY, JSON.stringify(next));
  savedCache = null;
  savedListeners.forEach((l) => l());
}
function subscribeSaved(cb: () => void) {
  savedListeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    savedListeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}
function useSavedPairs() {
  return useSyncExternalStore(subscribeSaved, readSaved, () => EMPTY_SAVED);
}
const pairKey = (h: string, s: string, b: string) => `${h}|${s}|${b}`;

// ── 테마 토큰 — Que 디자인 시스템과 일치(전역 --que-*에 의존하지 않고 값만 복사) ──
// 포인트 = Que 브랜드 인디고(다크 #7488ea / 라이트 #4e6cde). 상태색(green/amber/red)은 미사용.
const DARK_VARS = {
  "--fp-bg": "#0e0f12",
  "--fp-surface": "#16181d",
  "--fp-surface-2": "#202127",
  "--fp-border": "#2a2d35",
  "--fp-text": "#e8eaed",
  "--fp-muted": "#9aa0a6",
  "--fp-accent": "#7488ea",
  "--fp-accent-fg": "#10121a",
} as Record<string, string>;
const LIGHT_VARS = {
  "--fp-bg": "#f7f7f8",
  "--fp-surface": "#ffffff",
  "--fp-surface-2": "#f2f2f4",
  "--fp-border": "#ececee",
  "--fp-text": "#14151a",
  "--fp-muted": "#5b5d66",
  "--fp-accent": "#4e6cde",
  "--fp-accent-fg": "#ffffff",
} as Record<string, string>;

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

function MoodBadge({ mood }: { mood: MoodKey }) {
  return (
    <span
      className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
      style={{ background: "var(--fp-surface-2)", color: "var(--fp-muted)" }}
    >
      {MOOD_LABEL[mood]}
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
  const [sub, setSub] = useState<FontDef>(
    () => BY_FAMILY.get(params.get("s") ?? "") ?? DEFAULT_SUB,
  );
  const [body, setBody] = useState<FontDef>(
    () => BY_FAMILY.get(params.get("b") ?? "") ?? DEFAULT_BODY,
  );
  const [headingLocked, setHeadingLocked] = useState(false);
  const [subLocked, setSubLocked] = useState(false);
  const [bodyLocked, setBodyLocked] = useState(false);
  const [tuning, setTuning] = useState<TuningState>(defaultTuning);
  const [brand, setBrand] = useState("그리프");
  const [slogan, setSlogan] = useState("우리는 화면 너머를 만든다");
  const [listOpen, setListOpen] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [tuneOpen, setTuneOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  const saved = useSavedPairs();

  // 현재 페어/무드를 공유용 URL에 반영(튜닝은 파라미터 과다로 제외).
  useEffect(() => {
    const sp = new URLSearchParams();
    sp.set("h", heading.family);
    sp.set("s", sub.family);
    sp.set("b", body.family);
    sp.set("m", mood);
    window.history.replaceState(null, "", `?${sp.toString()}`);
  }, [heading, sub, body, mood]);

  // 현재 페어 3종 폰트 로드.
  useEffect(() => {
    ensureFont(heading);
    ensureFont(sub);
    ensureFont(body);
  }, [heading, sub, body]);

  // 폰트 목록 뷰: 열 때만 전체 lazy 로드.
  useEffect(() => {
    if (listOpen) FONTS.forEach(ensureFont);
  }, [listOpen]);

  // 페어링 롤(3슬롯 · 잠금 유지 · 서로 다른 family · body 풀 없으면 free 폴백).
  const rollTriple = useCallback(
    (moodArg: MoodKey) => {
      const hPool = poolFor(moodArg, "heading");
      let bPool = poolFor(moodArg, "body");
      if (bPool.length === 0) bPool = poolFor("free", "body");
      const sPoolBase = subPool(moodArg);
      const sPool = sPoolBase.length ? sPoolBase : FONTS;

      const nextH = headingLocked ? heading : pick(hPool.length ? hPool : FONTS);

      let sCands = sPool.filter((f) => f.family !== nextH.family);
      if (sCands.length === 0) sCands = sPool;
      const nextS = subLocked ? sub : pick(sCands);

      let bCands = bPool.filter(
        (f) => f.family !== nextH.family && f.family !== nextS.family,
      );
      if (bCands.length === 0)
        bCands = bPool.filter((f) => f.family !== nextH.family);
      if (bCands.length === 0) bCands = bPool.length ? bPool : FONTS;
      const nextB = bodyLocked ? body : pick(bCands);

      setHeading(nextH);
      setSub(nextS);
      setBody(nextB);
    },
    [headingLocked, subLocked, bodyLocked, heading, sub, body],
  );

  const handleMood = (m: MoodKey) => {
    setMood(m);
    rollTriple(m);
  };

  const applyPair = useCallback(
    (h: string, s: string, b: string, m: MoodKey, tune?: TuningState) => {
      const hf = BY_FAMILY.get(h);
      const sf = BY_FAMILY.get(s);
      const bf = BY_FAMILY.get(b);
      if (hf) setHeading(hf);
      if (sf) setSub(sf);
      if (bf) setBody(bf);
      if ((MOOD_ORDER as string[]).includes(m)) setMood(m);
      setTuning(tune ?? defaultTuning());
    },
    [],
  );

  const handleCopyCss = async () => {
    try {
      await navigator.clipboard.writeText(buildCss(heading, sub, body, tuning));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setSaveMsg("복사 실패");
      window.setTimeout(() => setSaveMsg(null), 2000);
    }
  };

  const handleSave = () => {
    const cur = readSaved();
    const key = pairKey(heading.family, sub.family, body.family);
    if (cur.some((p) => pairKey(p.h, p.s, p.b) === key)) {
      setSaveMsg("이미 저장됨");
      window.setTimeout(() => setSaveMsg(null), 2000);
      return;
    }
    writeSaved([
      {
        h: heading.family,
        s: sub.family,
        b: body.family,
        mood,
        savedAt: Date.now(),
        tuning,
      },
      ...cur,
    ]);
    setSaveMsg("저장됨 ✓");
    window.setTimeout(() => setSaveMsg(null), 2000);
  };

  const handleDelete = (savedAt: number) => {
    writeSaved(readSaved().filter((p) => p.savedAt !== savedAt));
  };

  // 테마 토큰 + 슬롯 튜닝 CSS 변수 병합.
  const vars = {
    ...(theme === "dark" ? DARK_VARS : LIGHT_VARS),
    "--fp-h-scale": String(tuning.h.scale),
    "--fp-h-ls": `${tuning.h.ls}em`,
    "--fp-h-lh": String(tuning.h.lh),
    "--fp-h-w": String(tuning.h.weight),
    "--fp-s-scale": String(tuning.s.scale),
    "--fp-s-ls": `${tuning.s.ls}em`,
    "--fp-s-lh": String(tuning.s.lh),
    "--fp-s-w": String(tuning.s.weight),
    "--fp-b-scale": String(tuning.b.scale),
    "--fp-b-ls": `${tuning.b.ls}em`,
    "--fp-b-lh": String(tuning.b.lh),
    "--fp-b-w": String(tuning.b.weight),
  } as React.CSSProperties;

  return (
    <div
      style={vars}
      className="flex min-h-dvh flex-col bg-[var(--fp-bg)] text-[var(--fp-text)]"
    >
      {/* ── 헤더 ── */}
      <header className="sticky top-0 z-30 border-b border-[var(--fp-border)] bg-[var(--fp-bg)]/95 backdrop-blur supports-[backdrop-filter]:bg-[var(--fp-bg)]/80">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2">
            <span
              className="grid h-7 w-7 place-items-center rounded-md text-xs font-black tracking-tight"
              style={{ background: "var(--fp-accent)", color: "var(--fp-accent-fg)" }}
              aria-hidden
            >
              Fp
            </span>
            <span className="text-[15px] font-semibold tracking-tight">
              폰트페어{" "}
              <span className="font-normal text-[var(--fp-muted)]">· GRIFF</span>
            </span>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => setGalleryOpen(true)}
              className="hidden h-10 items-center gap-1.5 rounded-lg border border-[var(--fp-border)] px-3.5 text-sm font-medium hover:bg-[var(--fp-surface-2)] md:inline-flex"
            >
              <Sparkles className="h-4 w-4" aria-hidden />
              추천 페어
            </button>
            <button
              type="button"
              onClick={() => setListOpen(true)}
              className="hidden h-10 items-center gap-1.5 rounded-lg border border-[var(--fp-border)] px-3.5 text-sm font-medium hover:bg-[var(--fp-surface-2)] md:inline-flex"
            >
              <LayoutGrid className="h-4 w-4" aria-hidden />
              폰트 목록
            </button>
            <button
              type="button"
              onClick={() => setTuneOpen((v) => !v)}
              aria-pressed={tuneOpen}
              className="inline-flex h-10 items-center gap-1.5 rounded-lg border px-3.5 text-sm font-medium transition"
              style={
                tuneOpen
                  ? {
                      background: "var(--fp-accent)",
                      color: "var(--fp-accent-fg)",
                      borderColor: "var(--fp-accent)",
                    }
                  : { borderColor: "var(--fp-border)" }
              }
            >
              <SlidersHorizontal className="h-4 w-4" aria-hidden />
              <span className="hidden sm:inline">파인튜닝</span>
            </button>
            <button
              type="button"
              onClick={() => rollTriple(mood)}
              aria-label="폰트 페어 셔플"
              className="inline-flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-semibold transition active:scale-95"
              style={{ background: "var(--fp-accent)", color: "var(--fp-accent-fg)" }}
            >
              <Shuffle className="h-4 w-4" aria-hidden />
              페어링
            </button>
            <button
              type="button"
              onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
              aria-label={theme === "dark" ? "라이트 모드로 전환" : "다크 모드로 전환"}
              className="grid h-10 w-10 place-items-center rounded-lg border border-[var(--fp-border)] hover:bg-[var(--fp-surface-2)]"
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
                    className="h-10 whitespace-nowrap rounded-lg border px-3.5 text-sm font-medium transition"
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
                onClick={() => setGalleryOpen(true)}
                className="inline-flex h-10 items-center gap-1.5 whitespace-nowrap rounded-lg border border-[var(--fp-border)] px-3.5 text-sm font-medium md:hidden"
              >
                <Sparkles className="h-4 w-4" aria-hidden />
                추천
              </button>
              <button
                type="button"
                onClick={() => setListOpen(true)}
                className="inline-flex h-10 items-center gap-1.5 whitespace-nowrap rounded-lg border border-[var(--fp-border)] px-3.5 text-sm font-medium md:hidden"
              >
                <LayoutGrid className="h-4 w-4" aria-hidden />
                목록
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ── 쇼케이스 본문 ── */}
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-64 pt-8 sm:px-6 sm:pb-40">
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
          <div className="rounded-xl border border-[var(--fp-border)] bg-[var(--fp-surface)] px-6 py-14 text-center sm:px-10 sm:py-20">
            <p
              className="text-[11px] font-semibold uppercase tracking-[0.35em] text-[var(--fp-muted)]"
              style={{ fontFamily: ff(sub) }}
            >
              EST. 2019 · SEOUL
            </p>
            <h1
              className="mt-4 break-keep"
              style={slot(heading, "h", "clamp(3rem, 9vw, 4.5rem)")}
            >
              {brand || "브랜드명"}
            </h1>
            <p
              className="mx-auto mt-5 max-w-xl break-keep text-[var(--fp-muted)]"
              style={slot(sub, "s", "clamp(1.125rem, 3.5vw, 1.5rem)")}
            >
              {slogan || "슬로건을 입력하세요"}
            </p>
          </div>
        </Section>

        {/* ② 에디토리얼 */}
        <Section n="02" title="에디토리얼">
          <article className="rounded-xl border border-[var(--fp-border)] bg-[var(--fp-surface)] p-6 sm:p-10">
            <p
              className="text-xs font-semibold uppercase tracking-widest"
              style={{ fontFamily: ff(body), color: "var(--fp-accent)" }}
            >
              TYPOGRAPHY
            </p>
            <h2
              className="mt-3 break-keep"
              style={slot(heading, "h", "clamp(1.875rem, 5vw, 3rem)")}
            >
              글자는 목소리를 갖는다
            </h2>
            <p
              className="mt-4 break-keep text-[var(--fp-muted)]"
              style={slot(sub, "s", "clamp(1.125rem, 3.5vw, 1.5rem)")}
            >
              타이포그래피는 정보를 넘어 감정을 전달하는 첫 번째 인터페이스다.
            </p>
            <div className="mt-6 grid gap-5 break-keep sm:grid-cols-2">
              <p style={slot(body, "b", "clamp(0.9375rem, 2vw, 1rem)")}>
                {ESSAY_1}
              </p>
              <p style={slot(body, "b", "clamp(0.9375rem, 2vw, 1rem)")}>
                {ESSAY_2}
              </p>
            </div>
          </article>
        </Section>

        {/* ③ UI 카드 */}
        <Section n="03" title="UI 카드">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-[var(--fp-border)] bg-[var(--fp-surface)] p-5">
              <span
                className="inline-block rounded-full px-2.5 py-1 text-xs font-semibold"
                style={{ background: "var(--fp-surface-2)", fontFamily: ff(body) }}
              >
                신규
              </span>
              <h3
                className="mt-3 break-keep"
                style={slot(heading, "h", "1.5rem")}
              >
                새 프로젝트 시작
              </h3>
              <p
                className="mt-2 break-keep text-[var(--fp-muted)]"
                style={slot(body, "b", "0.875rem")}
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
            <div className="rounded-xl border border-[var(--fp-border)] bg-[var(--fp-surface)] p-5">
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="break-keep" style={slot(heading, "h", "1.5rem")}>
                  이번 주 요약
                </h3>
                <span
                  style={{
                    ...slot(heading, "h", "1.875rem"),
                    color: "var(--fp-accent)",
                  }}
                >
                  92%
                </span>
              </div>
              <p
                className="mt-2 break-keep text-[var(--fp-muted)]"
                style={slot(body, "b", "0.875rem")}
              >
                예정된 작업 대부분이 순조롭게 진행되고 있습니다.
              </p>
              <div className="mt-4 space-y-2" style={slot(body, "b", "0.875rem")}>
                {[
                  ["완료된 작업", "18건"],
                  ["진행 중", "5건"],
                  ["대기", "2건"],
                ].map(([k, v]) => (
                  <div
                    key={k}
                    className="flex items-center justify-between border-b border-[var(--fp-border)] pb-2 last:border-0"
                  >
                    <span className="text-[var(--fp-muted)]">{k}</span>
                    <span className="font-semibold">{v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Section>

        {/* ④ 글리프 시트(3장) */}
        <Section n="04" title="글리프 시트">
          <div className="grid gap-4 sm:grid-cols-3">
            {(
              [
                ["제목", heading, "h"],
                ["부제", sub, "s"],
                ["본문", body, "b"],
              ] as const
            ).map(([role, font, key]) => (
              <div
                key={role}
                className="rounded-xl border border-[var(--fp-border)] bg-[var(--fp-surface)] p-5"
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
                  className="mt-4 break-keep"
                  style={slot(font, key, "clamp(1.25rem, 3vw, 1.5rem)")}
                >
                  {GLYPHS}
                </p>
              </div>
            ))}
          </div>
        </Section>
      </main>

      {/* ── 파인튜닝 패널(우측 슬라이드) ── */}
      {tuneOpen && (
        <TuningPanel
          tuning={tuning}
          onChange={setTuning}
          onReset={() => setTuning(defaultTuning())}
          onClose={() => setTuneOpen(false)}
        />
      )}

      {/* ── 하단 고정 페어 바 ── */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--fp-border)] bg-[var(--fp-surface)]/95 backdrop-blur">
        <div className="mx-auto max-w-6xl space-y-2 px-4 py-3 sm:px-6">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <PairSlot
              role="제목"
              font={heading}
              locked={headingLocked}
              onToggleLock={() => setHeadingLocked((v) => !v)}
            />
            <PairSlot
              role="부제"
              font={sub}
              locked={subLocked}
              onToggleLock={() => setSubLocked((v) => !v)}
            />
            <PairSlot
              role="본문"
              font={body}
              locked={bodyLocked}
              onToggleLock={() => setBodyLocked((v) => !v)}
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyCss}
              className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-lg border border-[var(--fp-border)] text-sm font-medium hover:bg-[var(--fp-surface-2)]"
            >
              {copied ? (
                <Check className="h-4 w-4" aria-hidden />
              ) : (
                <Copy className="h-4 w-4" aria-hidden />
              )}
              {copied ? "복사됨 ✓" : "CSS 복사"}
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-lg text-sm font-semibold"
              style={{ background: "var(--fp-accent)", color: "var(--fp-accent-fg)" }}
            >
              <Star className="h-4 w-4" aria-hidden />
              {saveMsg ?? "저장"}
            </button>
          </div>
        </div>
      </div>

      {/* ── 오버레이 ── */}
      {listOpen && <FontListOverlay onClose={() => setListOpen(false)} />}
      {galleryOpen && (
        <GalleryOverlay
          saved={saved}
          onApply={applyPair}
          onDelete={handleDelete}
          onClose={() => setGalleryOpen(false)}
        />
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
        <span className="font-mono text-xs text-[var(--fp-accent)]">{n}</span>
        <h2 className="text-sm font-semibold tracking-wide text-[var(--fp-muted)]">
          {title}
        </h2>
        <span className="h-px flex-1 bg-[var(--fp-border)]" />
      </div>
      {children}
    </section>
  );
}

// ── 파인튜닝 패널 ───────────────────────────────────────────────────────
const SLOT_META: { key: SlotKey; label: string }[] = [
  { key: "h", label: "제목" },
  { key: "s", label: "부제" },
  { key: "b", label: "본문" },
];
function TuningPanel({
  tuning,
  onChange,
  onReset,
  onClose,
}: {
  tuning: TuningState;
  onChange: (next: TuningState) => void;
  onReset: () => void;
  onClose: () => void;
}) {
  useEscClose(onClose);
  const set = (key: SlotKey, field: keyof SlotTune, value: number) =>
    onChange({ ...tuning, [key]: { ...tuning[key], [field]: value } });

  return (
    <>
      <button
        type="button"
        aria-label="파인튜닝 닫기"
        onClick={onClose}
        className="fixed inset-0 z-40 bg-black/30"
      />
      <aside
        className="fixed inset-y-0 right-0 z-40 flex w-full max-w-[380px] flex-col border-l border-[var(--fp-border)] bg-[var(--fp-surface)] shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-label="파인튜닝"
      >
        <div className="flex items-center justify-between border-b border-[var(--fp-border)] px-4 py-3">
          <h2 className="text-base font-semibold">파인튜닝</h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onReset}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[var(--fp-border)] px-3 text-sm font-medium hover:bg-[var(--fp-surface-2)]"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden />
              초기화
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="닫기"
              className="grid h-9 w-9 place-items-center rounded-lg border border-[var(--fp-border)] hover:bg-[var(--fp-surface-2)]"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </div>
        <div className="flex-1 space-y-6 overflow-y-auto px-4 py-5">
          {SLOT_META.map(({ key, label }) => {
            const t = tuning[key];
            return (
              <div key={key} className="space-y-3">
                <p className="text-sm font-semibold">{label}</p>
                <TuneRange
                  slot={label}
                  name="크기 스케일"
                  value={t.scale}
                  min={0.7}
                  max={1.5}
                  step={0.05}
                  display={`${t.scale.toFixed(2)}×`}
                  onChange={(v) => set(key, "scale", v)}
                />
                <TuneRange
                  slot={label}
                  name="자간"
                  value={t.ls}
                  min={-0.05}
                  max={0.1}
                  step={0.005}
                  display={`${t.ls.toFixed(3)}em`}
                  onChange={(v) => set(key, "ls", v)}
                />
                <TuneRange
                  slot={label}
                  name="행간"
                  value={t.lh}
                  min={1.0}
                  max={2.2}
                  step={0.05}
                  display={t.lh.toFixed(2)}
                  onChange={(v) => set(key, "lh", v)}
                />
                <TuneRange
                  slot={label}
                  name="굵기"
                  value={t.weight}
                  min={100}
                  max={900}
                  step={100}
                  display={String(t.weight)}
                  onChange={(v) => set(key, "weight", v)}
                />
              </div>
            );
          })}
          <p className="pt-1 text-xs leading-5 text-[var(--fp-muted)]">
            굵기는 가변(variable) 폰트에서 단계별로, 고정 굵기 폰트에서는 브라우저 합성으로 적용됩니다.
          </p>
        </div>
      </aside>
    </>
  );
}

function TuneRange({
  slot,
  name,
  value,
  min,
  max,
  step,
  display,
  onChange,
}: {
  slot: string;
  name: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <span className="flex items-center justify-between text-xs">
        <span className="text-[var(--fp-muted)]">{name}</span>
        <span className="font-mono font-medium">{display}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={`${slot} ${name}`}
        className="mt-1 h-10 w-full cursor-pointer accent-[var(--fp-accent)]"
      />
    </label>
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
    <div className="flex min-w-0 items-center gap-2 rounded-lg border border-[var(--fp-border)] bg-[var(--fp-bg)] px-3 py-2">
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
  useEscClose(onClose);
  return (
    <OverlayShell title={`폰트 목록 · ${FONTS.length}종`} onClose={onClose}>
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
    </OverlayShell>
  );
}

// ── 추천/저장 갤러리 오버레이 ───────────────────────────────────────────
function GalleryOverlay({
  saved,
  onApply,
  onDelete,
  onClose,
}: {
  saved: SavedPair[];
  onApply: (
    h: string,
    s: string,
    b: string,
    m: MoodKey,
    tune?: TuningState,
  ) => void;
  onDelete: (savedAt: number) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"curated" | "saved">("curated");
  useEscClose(onClose);

  // 오버레이가 열리면 표시 대상 페어의 폰트를 lazy 로드.
  useEffect(() => {
    CURATED_PAIRS.forEach((p) => {
      ensureFamily(p.h);
      ensureFamily(p.s);
      ensureFamily(p.b);
    });
    saved.forEach((p) => {
      ensureFamily(p.h);
      ensureFamily(p.s);
      ensureFamily(p.b);
    });
  }, [saved]);

  const applyCurated = (p: CuratedPair) => {
    onApply(p.h, p.s, p.b, p.mood);
    onClose();
  };
  const applySaved = (p: SavedPair) => {
    onApply(p.h, p.s, p.b, p.mood, p.tuning);
    onClose();
  };

  return (
    <OverlayShell title="페어 갤러리" onClose={onClose}>
      <div className="mx-auto max-w-6xl">
        {/* 탭 */}
        <div className="mb-5 inline-flex rounded-lg border border-[var(--fp-border)] p-1">
          {(
            [
              ["curated", `추천 · ${CURATED_PAIRS.length}`],
              ["saved", `저장한 페어 · ${saved.length}`],
            ] as const
          ).map(([key, label]) => {
            const active = tab === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                aria-pressed={active}
                className="h-10 rounded-md px-4 text-sm font-medium transition"
                style={
                  active
                    ? { background: "var(--fp-accent)", color: "var(--fp-accent-fg)" }
                    : { color: "var(--fp-muted)" }
                }
              >
                {label}
              </button>
            );
          })}
        </div>

        {tab === "curated" ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {CURATED_PAIRS.map((p) => (
              <CuratedCard key={p.name} pair={p} onClick={() => applyCurated(p)} />
            ))}
          </div>
        ) : saved.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--fp-border)] p-10 text-center text-sm text-[var(--fp-muted)]">
            아직 저장한 페어가 없습니다. 하단 바의 [저장] 버튼으로 현재 조합을 담아 보세요.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {saved.map((p) => (
              <SavedCard
                key={p.savedAt}
                pair={p}
                onApply={() => applySaved(p)}
                onDelete={() => onDelete(p.savedAt)}
              />
            ))}
          </div>
        )}
      </div>
    </OverlayShell>
  );
}

function CuratedCard({
  pair,
  onClick,
}: {
  pair: CuratedPair;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col rounded-xl border border-[var(--fp-border)] bg-[var(--fp-surface)] p-5 text-left transition hover:border-[var(--fp-accent)]"
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <MoodBadge mood={pair.mood} />
        <span className="text-xs text-[var(--fp-muted)]">적용 →</span>
      </div>
      <p
        className="break-keep text-3xl leading-tight"
        style={{ fontFamily: ffName(pair.h), fontWeight: 700 }}
      >
        {pair.name}
      </p>
      <p
        className="mt-2 break-keep text-sm text-[var(--fp-muted)]"
        style={{ fontFamily: ffName(pair.b) }}
      >
        {pair.desc}
      </p>
      <p
        className="mt-3 break-keep text-base"
        style={{ fontFamily: ffName(pair.s) }}
      >
        부제 · 가나다 AaBb 123
      </p>
    </button>
  );
}

function SavedCard({
  pair,
  onApply,
  onDelete,
}: {
  pair: SavedPair;
  onApply: () => void;
  onDelete: () => void;
}) {
  const hLabel = BY_FAMILY.get(pair.h)?.label ?? pair.h;
  const sLabel = BY_FAMILY.get(pair.s)?.label ?? pair.s;
  const bLabel = BY_FAMILY.get(pair.b)?.label ?? pair.b;
  return (
    <div className="flex flex-col rounded-xl border border-[var(--fp-border)] bg-[var(--fp-surface)] p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <MoodBadge mood={pair.mood} />
        <button
          type="button"
          onClick={onDelete}
          aria-label="저장한 페어 삭제"
          className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--fp-border)] text-[var(--fp-muted)] hover:text-[var(--fp-text)]"
        >
          <Trash2 className="h-4 w-4" aria-hidden />
        </button>
      </div>
      <button type="button" onClick={onApply} className="text-left">
        <p
          className="break-keep text-2xl leading-tight"
          style={{ fontFamily: ffName(pair.h), fontWeight: 700 }}
        >
          {hLabel}
        </p>
        <p
          className="mt-1.5 break-keep text-base"
          style={{ fontFamily: ffName(pair.s) }}
        >
          {sLabel}
        </p>
        <p
          className="mt-1.5 break-keep text-sm text-[var(--fp-muted)]"
          style={{ fontFamily: ffName(pair.b) }}
        >
          {bLabel} · 가나다 AaBb 123
        </p>
        <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-[var(--fp-accent)]">
          {pair.tuning ? "튜닝 포함 적용 →" : "이 페어 적용 →"}
        </span>
      </button>
    </div>
  );
}

// ── 공용 오버레이 셸 · Esc 닫기 훅 ──────────────────────────────────────
function OverlayShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-[var(--fp-bg)]"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="sticky top-0 flex items-center justify-between border-b border-[var(--fp-border)] px-4 py-3 sm:px-6">
        <h2 className="text-base font-semibold">{title}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="닫기"
          className="grid h-10 w-10 place-items-center rounded-lg border border-[var(--fp-border)] hover:bg-[var(--fp-surface-2)]"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">{children}</div>
    </div>
  );
}

function useEscClose(onClose: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
}
