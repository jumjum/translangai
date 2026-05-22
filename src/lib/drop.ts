// File-drop helpers for the source text field.
//
// Phase 1 (v0.11.6): text-like files only — .txt, .md, .srt, .vtt, .csv,
// and any text/*. Audio handled in a follow-up turn once we wire Whisper
// (see DESIGN §16).
//
// Each helper resolves to the *string* that should land in the source
// field. Use insertOrReplace() with the current source text + selection
// to decide whether to append, replace, or insert at the cursor.

const TEXT_EXTS = new Set([
  "txt", "md", "markdown", "csv", "tsv", "json", "log",
  "srt", "vtt",   // captions — strip timestamps later if needed
  "html", "htm",
]);

/** True iff this File looks like plain text we can safely render. */
export function isTextDroppable(file: File): boolean {
  if (file.type && file.type.startsWith("text/")) return true;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return TEXT_EXTS.has(ext);
}

/** Read a text file fully. Rejects non-text files. */
export function readTextFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!isTextDroppable(file)) {
      reject(new Error(`${file.name}: not a text file (audio support coming).`));
      return;
    }
    const r = new FileReader();
    r.onload = () => resolve(typeof r.result === "string" ? r.result : "");
    r.onerror = () => reject(r.error ?? new Error("read failed"));
    r.readAsText(file);
  });
}

/** Read all dropped files in parallel, concatenate with double-newline. */
export async function readDroppedText(files: FileList | File[]): Promise<string> {
  const arr = Array.from(files);
  const out: string[] = [];
  for (const f of arr) {
    try {
      const t = await readTextFile(f);
      out.push(t.trim());
    } catch {
      // Skip unsupported files quietly — UI will surface a hint elsewhere.
    }
  }
  return out.filter(Boolean).join("\n\n");
}
