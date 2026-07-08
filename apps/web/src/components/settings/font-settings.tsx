"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { setTheme, type Theme } from "@/lib/theme";
import { cn } from "@/lib/utils";

// 폰트 옵션 — value는 html[data-ko]/[data-latin] 및 쿠키 값, css는 미리보기용 font-family.
// globals.css의 :root[data-*] 규칙과 값이 일치해야 한다.
type FontOption = { value: string; label: string; css: string };

const KO_FONTS: FontOption[] = [
  { value: "suit", label: "SUIT", css: "var(--font-suit)" },
  { value: "pretendard", label: "Pretendard", css: "var(--font-pretendard)" },
  { value: "noto", label: "Noto Sans KR", css: "var(--font-noto-kr)" },
  { value: "paperlogy", label: "페이퍼로지", css: "'Paperozi'" },
  { value: "freesentation", label: "프리젠테이션", css: "'Presentation'" },
  { value: "system", label: "시스템", css: "ui-sans-serif, system-ui, sans-serif" },
];
const LATIN_FONTS: FontOption[] = [
  { value: "inter", label: "Inter Tight", css: "var(--font-inter-tight)" },
  { value: "paperlogy", label: "Paperlogy", css: "'Paperozi'" },
  { value: "freesentation", label: "Freesentation", css: "'Presentation'" },
  { value: "system", label: "System", css: "ui-sans-serif, system-ui, sans-serif" },
];

type Choice = { value: string; label: string; hint: string };

const THEMES: Choice[] = [
  { value: "light", label: "라이트", hint: "밝은 배경(기본)" },
  { value: "dark", label: "다크", hint: "어두운 배경" },
];
const DENSITIES: Choice[] = [
  { value: "default", label: "기본", hint: "여유 있는 간격" },
  { value: "compact", label: "컴팩트", hint: "정보 밀도 우선" },
];

const YEAR = 60 * 60 * 24 * 365;

function setCookie(name: string, value: string) {
  document.cookie = `${name}=${value}; path=/; max-age=${YEAR}; samesite=lax`;
}

/** 모양 설정 — 테마/밀도/폰트. 선택 즉시 화면 반영(html attr) + 쿠키 저장(다음 로드 SSR). */
export function FontSettings({
  initialKo,
  initialLatin,
  initialTheme,
  initialDensity,
}: {
  initialKo: string;
  initialLatin: string;
  initialTheme: string;
  initialDensity: string;
}) {
  const [ko, setKo] = useState(initialKo);
  const [latin, setLatin] = useState(initialLatin);
  const [theme, setThemeState] = useState(initialTheme);
  const [density, setDensity] = useState(initialDensity);

  function apply(kind: "ko" | "latin", value: string) {
    // 1) 즉시 반영(깜빡임 없이 현재 페이지에 적용)
    document.documentElement.dataset[kind] = value;
    // 2) 쿠키 저장 → 다음 요청부터 SSR로 심어져 첫 프레임 깜빡임 없음
    setCookie(`font-${kind}`, value);
    if (kind === "ko") setKo(value);
    else setLatin(value);
  }

  function applyTheme(value: string) {
    // 즉시 반영 + 쿠키 저장은 공유 모듈(lib/theme)에 위임 — 헤더 토글과 동일 규격.
    setTheme(value as Theme);
    setThemeState(value);
  }

  function applyDensity(value: string) {
    document.documentElement.dataset.density = value;
    setCookie("density", value);
    setDensity(value);
  }

  return (
    <section className="flex flex-col gap-6">
      <div className="rounded-xl border border-[var(--que-border)] bg-[var(--que-bg)] p-5 shadow-[var(--que-shadow-sm)]">
        <h2 className="text-base font-semibold text-[var(--que-text)]">테마와 밀도</h2>
        <p className="mt-0.5 text-sm text-[var(--que-text-secondary)]">
          화면 밝기와 정보 밀도를 고릅니다. 이 브라우저에만 적용됩니다.
        </p>

        <ChoiceGroup
          legend="테마"
          options={THEMES}
          selected={theme}
          onSelect={applyTheme}
        />
        <ChoiceGroup
          legend="밀도"
          options={DENSITIES}
          selected={density}
          onSelect={applyDensity}
        />
      </div>

      <div className="rounded-xl border border-[var(--que-border)] bg-[var(--que-bg)] p-5 shadow-[var(--que-shadow-sm)]">
        <h2 className="text-base font-semibold text-[var(--que-text)]">폰트</h2>
        <p className="mt-0.5 text-sm text-[var(--que-text-secondary)]">
          한글과 영문·숫자 폰트를 따로 고를 수 있습니다. 이 브라우저에만 적용됩니다.
        </p>

        {/* 라이브 미리보기 */}
        <div className="mt-4 rounded-lg border border-[var(--que-border)] bg-[var(--que-canvas)] px-4 py-3.5">
          <p className="text-lg leading-snug text-[var(--que-text)]">
            다람쥐 헌 쳇바퀴에 타고파
          </p>
          <p className="mt-1 text-sm text-[var(--que-text-secondary)] tabular-nums">
            The quick brown fox jumps · 0123456789
          </p>
        </div>

        <FontGroup
          legend="한글 폰트"
          options={KO_FONTS}
          selected={ko}
          sample="가나다라 마바사"
          onSelect={(v) => apply("ko", v)}
        />
        <FontGroup
          legend="영문·숫자 폰트"
          options={LATIN_FONTS}
          selected={latin}
          sample="Abcd 0123"
          onSelect={(v) => apply("latin", v)}
        />
      </div>
    </section>
  );
}

/** 테마/밀도 같은 단순 선택지 라디오(2열 카드). */
function ChoiceGroup({
  legend,
  options,
  selected,
  onSelect,
}: {
  legend: string;
  options: Choice[];
  selected: string;
  onSelect: (value: string) => void;
}) {
  return (
    <fieldset className="mt-5">
      <legend className="mb-2 text-sm font-medium text-[var(--que-text-secondary)]">
        {legend}
      </legend>
      <div role="radiogroup" aria-label={legend} className="grid gap-2 sm:grid-cols-2">
        {options.map((opt) => {
          const active = opt.value === selected;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onSelect(opt.value)}
              className={cn(
                "flex min-h-14 items-center justify-between gap-3 rounded-lg border px-3.5 py-2.5 text-left transition-colors",
                "focus-visible:outline-2 focus-visible:outline-[var(--que-brand)]",
                active
                  ? "border-[var(--que-brand)] bg-[var(--que-brand-subtle)]"
                  : "border-[var(--que-border)] bg-[var(--que-bg)] hover:bg-[var(--que-bg-muted)]",
              )}
            >
              <span className="min-w-0">
                <span className="block text-sm font-medium text-[var(--que-text)]">
                  {opt.label}
                </span>
                <span className="block truncate text-sm text-[var(--que-text-tertiary)]">
                  {opt.hint}
                </span>
              </span>
              {active ? (
                <Check className="size-4 shrink-0 text-[var(--que-brand)]" aria-hidden />
              ) : null}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function FontGroup({
  legend,
  options,
  selected,
  sample,
  onSelect,
}: {
  legend: string;
  options: FontOption[];
  selected: string;
  sample: string;
  onSelect: (value: string) => void;
}) {
  return (
    <fieldset className="mt-5">
      <legend className="mb-2 text-sm font-medium text-[var(--que-text-secondary)]">
        {legend}
      </legend>
      <div role="radiogroup" aria-label={legend} className="grid gap-2 sm:grid-cols-2">
        {options.map((opt) => {
          const active = opt.value === selected;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onSelect(opt.value)}
              className={cn(
                "flex min-h-14 items-center justify-between gap-3 rounded-lg border px-3.5 py-2.5 text-left transition-colors",
                "focus-visible:outline-2 focus-visible:outline-[var(--que-brand)]",
                active
                  ? "border-[var(--que-brand)] bg-[var(--que-brand-subtle)]"
                  : "border-[var(--que-border)] bg-[var(--que-bg)] hover:bg-[var(--que-bg-muted)]",
              )}
            >
              <span className="min-w-0">
                <span className="block text-sm font-medium text-[var(--que-text)]">
                  {opt.label}
                </span>
                <span
                  className="block truncate text-sm text-[var(--que-text-tertiary)]"
                  style={{ fontFamily: opt.css }}
                >
                  {sample}
                </span>
              </span>
              {active ? (
                <Check className="size-4 shrink-0 text-[var(--que-brand)]" aria-hidden />
              ) : null}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
