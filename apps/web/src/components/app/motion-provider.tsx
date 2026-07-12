"use client";

import { MotionConfig } from "motion/react";

// Motion(motion.dev) 전역 설정 — 시스템 '모션 줄이기'(prefers-reduced-motion)를 켠 사용자에게는
// 모든 motion 컴포넌트가 즉시 전환된다. (app)·(gantt) 셸 레이아웃이 감싼다.
// 모션 규약: 장식이 아니라 "내 행동이 반영됐다"는 상태 피드백에만 쓴다(운영 도구 톤).
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
