// Shared UI recipes — keep these in one place so a button restyle is a one-file change.
//
// Visual language (v0.11):
//   - BTN_CHIP idle: **transparent**, just the text. Subtle hover bg.
//   - BTN_CHIP_ACTIVE: solid grey gradient ("pressed-in"). Used for the
//     currently-selected segment of a segmented control, free-mode chip
//     when paid is enabled, auto-speak when on, etc.
//   - BTN_HERO: the big mic. Keeps its full grey gradient + soft shadow —
//     it's the focal point, the one button that should stand out.
//
// Rationale: the prior grey-gradient-everywhere look made every chip
// compete for attention. Transparent idle chips let the *text* carry the
// affordance; the active state is the only thing that asserts itself
// visually. Easier to scan, calmer typography rhythm.

/** Primary action button — large, prominent. Used for the mic. */
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

/** Toolbar chip — transparent until interacted with. */
export const BTN_CHIP =
  "bg-transparent text-zinc-600 " +
  "border border-transparent " +
  "hover:bg-zinc-100 hover:text-zinc-900 " +
  "active:bg-zinc-200 " +
  "dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 dark:active:bg-zinc-700 " +
  "disabled:opacity-40 disabled:cursor-not-allowed " +
  "transition-colors duration-150";

/** Selected / pressed-in chip — solid grey gradient. Use on the active
 *  segment of a segmented control or for "on" toggles (e.g. free mode). */
export const BTN_CHIP_ACTIVE =
  "bg-gradient-to-b from-zinc-700 to-zinc-900 text-zinc-50 " +
  "border border-zinc-900/60 " +
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_2px_4px_rgba(0,0,0,0.25)] " +
  "dark:from-zinc-200 dark:to-zinc-400 dark:text-zinc-900 dark:border-zinc-100/40";
