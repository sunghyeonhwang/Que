// 테마(라이트/다크) 공유 로직 — 설정(모양)과 헤더 토글이 함께 쓴다(DRY).
// 즉시 반영(html.dark 토글) + 쿠키 저장(다음 요청부터 SSR로 심어 첫 프레임 깜빡임 없음).
// 쿠키 규격은 font-settings의 setCookie와 동일: path=/; max-age=1yr; samesite=lax.
export type Theme = "light" | "dark";

const YEAR = 60 * 60 * 24 * 365;

export function setTheme(value: Theme) {
  document.documentElement.classList.toggle("dark", value === "dark");
  document.cookie = `theme=${value}; path=/; max-age=${YEAR}; samesite=lax`;
}
