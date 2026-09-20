import type { ProgrammingLanguage } from "@/types/domain";

/**
 * The document a learner's markup/styling renders as, for the live preview
 * next to an exercise's editor - or null when the language has nothing to
 * render. HTML previews as itself. CSS on its own has nothing to style, so an
 * exercise ships a small piece of markup (`previewMarkup`) for it to apply
 * to; without one there is no preview.
 */
export function buildPreviewDoc(
  language: ProgrammingLanguage,
  code: string,
  previewMarkup: string | null | undefined
): string | null {
  if (language === "html") return code;
  if (language === "css") return previewMarkup ? `<style>${code}</style>\n${previewMarkup}` : null;
  return null;
}
