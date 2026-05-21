// Sentence + paragraph segmentation for the multi-view live translator.
//
// Translation APIs return one big string for source and one for target.
// To render them as paired chunks in the Paragraph and Stream views we
// slice each side by sentence boundary and zip by index. Counts won't
// always match (one source sentence can become two target sentences),
// so we use best-effort alignment + a `partial` flag the UI can display.

import { useCallback, useEffect, useRef } from "react";

const SENTENCE_END = /([^.!?\n]+[.!?\n]+|\S+$)/g;

/** Split text on sentence-ending punctuation, keeping the punctuation
 *  with the preceding sentence. Trims and drops empties. */
export function splitSentences(text: string): string[] {
  const matches = text.match(SENTENCE_END);
  return (matches ?? []).map((s) => s.trim()).filter(Boolean);
}

/** Group sentences into paragraphs of roughly `targetWords` words each.
 *  A paragraph closes once the running word count crosses the target;
 *  the trailing remainder is its own (shorter) paragraph. */
export function groupSentencesIntoParagraphs(
  sentences: string[],
  targetWords = 25,
): string[] {
  const paragraphs: string[] = [];
  let bucket: string[] = [];
  let words = 0;
  for (const s of sentences) {
    bucket.push(s);
    words += s.split(/\s+/).filter(Boolean).length;
    if (words >= targetWords) {
      paragraphs.push(bucket.join(" "));
      bucket = [];
      words = 0;
    }
  }
  if (bucket.length) paragraphs.push(bucket.join(" "));
  return paragraphs;
}

/** Best-effort pair of source paragraphs with target paragraphs by index.
 *  When counts differ we keep going until both lists are exhausted; the
 *  shorter side renders an empty string in the unmatched slot. */
export function pairParagraphs(srcPs: string[], tgtPs: string[]): Array<{ src: string; tgt: string }> {
  const n = Math.max(srcPs.length, tgtPs.length);
  const pairs: Array<{ src: string; tgt: string }> = [];
  for (let i = 0; i < n; i++) pairs.push({ src: srcPs[i] ?? "", tgt: tgtPs[i] ?? "" });
  return pairs;
}

/**
 * Sticky-bottom scroll hook. Auto-scrolls a container to the bottom when
 * content grows IF the user is already at (or near) the bottom. If they
 * scrolled up to read older content, we stop auto-scrolling — they get
 * to read in peace and a return to the bottom resumes the behaviour.
 *
 * `dep` should change whenever the content changes (e.g. pass the latest
 * source/target text length or a counter).
 */
export function useStickyBottom<T extends HTMLElement>(dep: unknown) {
  const ref = useRef<T | null>(null);
  const stickRef = useRef(true);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onScroll = () => {
      const slack = 24; // px tolerance — "near enough to bottom" counts as sticking
      stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < slack;
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (stickRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [dep]);

  return ref;
}

/**
 * Auto-grow textarea height to fit its content up to `maxRows`.
 *
 * Returns a *callback ref* so we re-measure both (a) whenever React mounts a
 * new textarea (e.g. after toggling out of speech mode) and (b) whenever the
 * value changes. Pass the live value as `value` so growth happens in step
 * with typing / programmatic updates.
 */
export function useAutoGrowTextarea(value: string, maxRows = 12) {
  const elRef = useRef<HTMLTextAreaElement | null>(null);

  const measure = useCallback(
    (el: HTMLTextAreaElement | null) => {
      if (!el) return;
      el.style.height = "auto";
      const line = parseFloat(getComputedStyle(el).lineHeight || "24");
      el.style.height = Math.min(el.scrollHeight, line * maxRows) + "px";
    },
    [maxRows],
  );

  const setRef = useCallback(
    (el: HTMLTextAreaElement | null) => {
      elRef.current = el;
      measure(el);
    },
    [measure],
  );

  useEffect(() => {
    measure(elRef.current);
  }, [value, measure]);

  return setRef;
}
