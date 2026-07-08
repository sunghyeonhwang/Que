"use client";

import { useState } from "react";
import { Moon, Sun } from "lucide-react";
import { setTheme, type Theme } from "@/lib/theme";
import { IconButton } from "./icon-button";

/** 헤더 전역 다크/라이트 토글(조회성 — core 무관).
 *  설정(모양)과 같은 메커니즘(lib/theme.setTheme)을 공유한다.
 *  초기 아이콘은 layout이 넘긴 initialTheme(쿠키)로 그려 SSR 깜빡임을 피한다. */
export function ThemeToggle({ initialTheme }: { initialTheme: Theme }) {
  const [theme, setThemeState] = useState<Theme>(initialTheme);
  const isDark = theme === "dark";

  const toggle = () => {
    const next: Theme = isDark ? "light" : "dark";
    setTheme(next);
    setThemeState(next);
  };

  const label = isDark ? "라이트 모드로" : "다크 모드로";

  return (
    <IconButton label={label} onClick={toggle} variant="outline">
      {isDark ? (
        <Sun className="size-4" aria-hidden />
      ) : (
        <Moon className="size-4" aria-hidden />
      )}
    </IconButton>
  );
}
