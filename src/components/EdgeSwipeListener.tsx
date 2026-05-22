"use client";

import { useEffect } from "react";

/**
 * Edge-swipe detector — pulls the history panel open with a swipe from
 * the left edge of the screen, ChatGPT/Drawer style. Also closes it with
 * a left-going swipe while open.
 *
 * - Open trigger: touchstart at x < 20px and a horizontal travel of
 *   >= 80px to the right (and dominant over vertical motion).
 * - Close trigger (when open): touchmove with -80px horizontal travel
 *   (swipe-left while panel is on screen).
 *
 * Touch-only — desktop users use the header button. Falls back gracefully:
 * on devices without TouchEvent the listeners simply never fire.
 */
export default function EdgeSwipeListener({
  open,
  onOpen,
  onClose,
}: {
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("ontouchstart" in window)) return;

    let startX = 0;
    let startY = 0;
    let tracking = false;
    let armedForOpen = false; // touchstart was at the left edge

    const EDGE = 20;
    const TRAVEL = 80;

    const onStart = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!t) return;
      startX = t.clientX;
      startY = t.clientY;
      tracking = true;
      armedForOpen = !open && startX <= EDGE;
    };
    const onMove = (e: TouchEvent) => {
      if (!tracking) return;
      const t = e.touches[0];
      if (!t) return;
      const dx = t.clientX - startX;
      const dy = Math.abs(t.clientY - startY);
      // Horizontal motion has to dominate or this is a scroll, not a swipe.
      if (Math.abs(dx) < dy) return;
      if (armedForOpen && dx >= TRAVEL) {
        tracking = false;
        onOpen();
      } else if (open && dx <= -TRAVEL) {
        tracking = false;
        onClose();
      }
    };
    const onEnd = () => {
      tracking = false;
      armedForOpen = false;
    };

    document.addEventListener("touchstart", onStart, { passive: true });
    document.addEventListener("touchmove", onMove, { passive: true });
    document.addEventListener("touchend", onEnd, { passive: true });
    document.addEventListener("touchcancel", onEnd, { passive: true });
    return () => {
      document.removeEventListener("touchstart", onStart);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onEnd);
      document.removeEventListener("touchcancel", onEnd);
    };
  }, [open, onOpen, onClose]);

  return null;
}
