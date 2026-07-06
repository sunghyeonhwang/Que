import confetti from "canvas-confetti";

/** 완료 순간 대상 요소 위치에서 폭죽(confetti). reduced-motion이면 자동 생략.
 *  작업 완료 원형 버튼과 결제 입금 완료 버튼이 같은 연출을 공유한다. */
export function burstConfetti(el: HTMLElement) {
  const rect = el.getBoundingClientRect();
  confetti({
    particleCount: 70,
    spread: 60,
    startVelocity: 32,
    gravity: 0.9,
    ticks: 120,
    scalar: 0.85,
    origin: {
      x: (rect.left + rect.width / 2) / window.innerWidth,
      y: (rect.top + rect.height / 2) / window.innerHeight,
    },
    colors: ["#16a34a", "#22c55e", "#4ade80", "#86efac", "#3b5bd9"],
    disableForReducedMotion: true,
  });
}
