"use client";

import { useEffect, type RefObject } from "react";

/**
 * Close-on-outside-click + close-on-Escape for popovers / dropdowns.
 *
 * Pass a ref to the wrapper that contains both the trigger button and the
 * popover content. While `active` is true, any pointerdown / touchstart
 * landing outside the wrapper — or an Escape keypress — calls `onClose`.
 *
 * Handlers attach only while `active` so there's zero idle cost.
 *
 * Use mousedown (not click) so the close fires before any rogue click handler
 * inside the popover; we still want clicks on items inside the popover to
 * work, which they do because contains() includes the popover (it's a
 * descendant of the same wrapper).
 */
export function useClickAway<T extends HTMLElement>(
  ref: RefObject<T | null>,
  active: boolean,
  onClose: () => void,
) {
  useEffect(() => {
    if (!active) return;
    const onPointer = (e: MouseEvent | TouchEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("touchstart", onPointer, { passive: true });
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("touchstart", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [active, onClose, ref]);
}
