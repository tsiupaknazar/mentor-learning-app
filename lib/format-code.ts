import type { ProgrammingLanguage } from "@/types/domain";

/**
 * AI-generated code (project starter files, exercise starterCode) is a
 * plain string in the response JSON — nothing stops the model from
 * writing it as a single flattened line instead of properly indented,
 * multi-line source (this was reported: project starter files opening as
 * one unreadable row). Rather than trust the model to format nicely every
 * time, every editor formats on display via Prettier, so the learner
 * always sees readable code regardless of what the model produced.
 *
 * Prettier + its plugins are only dynamically imported when actually
 * needed (never in the initial bundle) since they're sizable and most
 * page loads don't touch a code editor at all.
 *
 * Python and SQL aren't included: Prettier has no first-party plugin for
 * either, and the community options are heavy/inconsistent enough that
 * silently "reformatting" someone's Python indentation (which is
 * semantically significant) is riskier than leaving it alone.
 */
const FORMATTABLE = new Set<ProgrammingLanguage>(["javascript", "typescript", "html", "css"]);

export function isFormattable(language: ProgrammingLanguage): boolean {
  return FORMATTABLE.has(language);
}

export async function formatCode(code: string, language: ProgrammingLanguage): Promise<string> {
  if (!code.trim() || !FORMATTABLE.has(language)) return code;

  try {
    const { format } = await import("prettier/standalone");

    switch (language) {
      case "javascript": {
        const [babel, estree] = await Promise.all([
          import("prettier/plugins/babel"),
          import("prettier/plugins/estree"),
        ]);
        return await format(code, { parser: "babel", plugins: [babel.default, estree.default] });
      }
      case "typescript": {
        const [typescript, estree] = await Promise.all([
          import("prettier/plugins/typescript"),
          import("prettier/plugins/estree"),
        ]);
        return await format(code, { parser: "typescript", plugins: [typescript.default, estree.default] });
      }
      case "html": {
        // The html parser only reformats the markup itself unless it's
        // also given plugins for whatever's embedded inside <script>/
        // <style> tags — without babel/estree/postcss here, Prettier
        // silently leaves any inline JS/CSS exactly as-is (no error, just
        // a no-op on that content), which looked like "format does
        // nothing" whenever a learner's HTML had inline script or style.
        const [html, babel, estree, postcss] = await Promise.all([
          import("prettier/plugins/html"),
          import("prettier/plugins/babel"),
          import("prettier/plugins/estree"),
          import("prettier/plugins/postcss"),
        ]);
        return await format(code, {
          parser: "html",
          plugins: [html.default, babel.default, estree.default, postcss.default],
        });
      }
      case "css": {
        const postcss = await import("prettier/plugins/postcss");
        return await format(code, { parser: "css", plugins: [postcss.default] });
      }
      default:
        return code;
    }
  } catch {
    // Mid-edit code is frequently syntactically incomplete (an unclosed
    // brace while typing) — Prettier throws on that. Fall back to
    // whatever was there rather than losing the learner's work.
    return code;
  }
}
