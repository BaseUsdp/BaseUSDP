/**
 * Tiny celebration helper — fires a confetti burst the first time it's
 * called in a tab session, no-ops on subsequent calls in the same session.
 *
 * Uses sessionStorage so each new tab/window gets its own first-time
 * moment. Wrapped in a function so other "first X of session" actions
 * can reuse the same idempotency pattern later.
 */

import confetti from "canvas-confetti";

const SESSION_FLAG_PREFIX = "baseusdp_celebrated_";

export type CelebrationKey = "send";

export function celebrateOncePerSession(key: CelebrationKey): void {
  const flag = `${SESSION_FLAG_PREFIX}${key}`;
  try {
    if (sessionStorage.getItem(flag)) return;
    sessionStorage.setItem(flag, "1");
  } catch {
    // sessionStorage unavailable (Safari private mode etc.) — fire anyway.
  }

  // Two-cone effect: confetti shoots up from the bottom corners so it
  // doesn't cover the centered success card.
  const fire = (angle: number, originX: number) => {
    confetti({
      particleCount: 60,
      spread: 65,
      startVelocity: 50,
      angle,
      origin: { x: originX, y: 1 },
      ticks: 200,
      gravity: 1.1,
      decay: 0.92,
      scalar: 0.9,
      colors: ["#0052FF", "#22c55e", "#f59e0b", "#ec4899", "#a855f7"],
    });
  };

  fire(60, 0.15); // bottom-left cone aimed up-right
  fire(120, 0.85); // bottom-right cone aimed up-left
}
