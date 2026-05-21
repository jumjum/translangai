// Shared UI recipes — keep these in one place so a button restyle is a one-file change.
//
// All variants render as a grey-toned "chip" with a vertical gradient,
// a 1px inset highlight at top, and a soft drop-shadow. Active state inverts
// the gradient so the button reads as "pressed in".

/** Primary action button — large, high-contrast. Use for: mic, primary CTAs. */
export const BTN_HERO =
  "bg-gradient-to-b from-zinc-600 to-zinc-800 text-zinc-50 " +
  "border border-zinc-900/40 " +
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_4px_14px_rgba(0,0,0,0.3)] " +
  "hover:from-zinc-700 hover:to-zinc-900 " +
  "active:from-zinc-800 active:to-zinc-700 active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.4),0_1px_2px_rgba(0,0,0,0.2)] " +
  "dark:from-zinc-300 dark:to-zinc-500 dark:text-zinc-900 dark:border-zinc-100/30 " +
  "dark:hover:from-zinc-200 dark:hover:to-zinc-400 " +
  "dark:active:from-zinc-400 dark:active:to-zinc-200 " +
  "disabled:opacity-40 disabled:cursor-not-allowed " +
  "transition-[background,box-shadow] duration-150";

/** Secondary chip — smaller, for toolbar buttons (history, voice picker, auto-speak). */
export const BTN_CHIP =
  "bg-gradient-to-b from-zinc-100 to-zinc-200 text-zinc-700 " +
  "border border-zinc-300 " +
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_1px_2px_rgba(0,0,0,0.08)] " +
  "hover:from-zinc-50 hover:to-zinc-100 " +
  "active:from-zinc-200 active:to-zinc-100 active:shadow-[inset_0_1px_2px_rgba(0,0,0,0.15)] " +
  "dark:from-zinc-800 dark:to-zinc-900 dark:text-zinc-200 dark:border-zinc-700 " +
  "dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_1px_2px_rgba(0,0,0,0.4)] " +
  "dark:hover:from-zinc-700 dark:hover:to-zinc-800 " +
  "dark:active:from-zinc-900 dark:active:to-zinc-800 " +
  "disabled:opacity-40 disabled:cursor-not-allowed " +
  "transition-[background,box-shadow] duration-150";

/** Active chip — like CHIP but in the "selected / pressed" state (ModeSwitch active tab). */
export const BTN_CHIP_ACTIVE =
  "bg-gradient-to-b from-zinc-700 to-zinc-900 text-zinc-50 " +
  "border border-zinc-900/60 " +
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_2px_4px_rgba(0,0,0,0.25)] " +
  "dark:from-zinc-200 dark:to-zinc-400 dark:text-zinc-900 dark:border-zinc-100/40";
