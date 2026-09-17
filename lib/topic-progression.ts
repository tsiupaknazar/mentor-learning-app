/**
 * A small curated "what usually comes next" map, used to suggest a next
 * topic after finishing one — e.g. JavaScript -> TypeScript -> React /
 * Angular / Vue. This is deliberately a hand-written map, not an AI call:
 * "what's a sensible next step in this career track" is stable domain
 * knowledge, not something specific to the individual learner, so there's
 * no reason to spend a Gemini call (or introduce non-determinism) on it.
 * It's a *suggestion*, never a requirement — the topic picker it feeds
 * always also offers the full preset list and a free-text field, so a
 * learner who wants to go a completely different direction always can.
 *
 * Keys are matched case-insensitively against the learner's current (or
 * most recent) learning path's `topic` string, which is free text, so this
 * is intentionally a "does it look like X" pattern match rather than an
 * exact key.
 */
const PROGRESSION: { pattern: RegExp; next: string[] }[] = [
  { pattern: /\b(html|css)\b/i, next: ["JavaScript", "Responsive Design", "Tailwind CSS"] },
  { pattern: /\bjavascript\b|\bjs\b/i, next: ["TypeScript", "React", "Node.js"] },
  { pattern: /\btypescript\b|\bts\b/i, next: ["React", "Angular", "Vue"] },
  { pattern: /\breact\b/i, next: ["TypeScript", "Next.js", "Testing (Jest & RTL)"] },
  { pattern: /\bangular\b/i, next: ["TypeScript", "RxJS", "Testing (Jasmine & Karma)"] },
  { pattern: /\bvue\b/i, next: ["TypeScript", "Nuxt.js", "Pinia & State Management"] },
  { pattern: /\bnode(\.js)?\b/i, next: ["TypeScript", "SQL", "System Design"] },
  { pattern: /\bpython\b/i, next: ["SQL", "Django", "Data Structures & Algorithms"] },
  { pattern: /\bsql\b|\bdatabase/i, next: ["Python", "Database Design", "Data Analysis"] },
  { pattern: /\bdata structures?\b|\balgorithms?\b/i, next: ["System Design", "Interview Prep"] },
];

/** Returns up to 3 suggested next topics for `currentTopic`, or `[]` if nothing in the map matches (a genuinely new/unusual topic — the picker's full list covers that case). */
export function suggestNextTopics(currentTopic: string | null | undefined): string[] {
  if (!currentTopic) return [];
  const entry = PROGRESSION.find((e) => e.pattern.test(currentTopic));
  return entry?.next ?? [];
}
