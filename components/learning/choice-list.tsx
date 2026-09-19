"use client";

import { useRef } from "react";

import { cn } from "@/lib/utils";

/**
 * Single-choice answers as a proper radio group: screen readers announce
 * "radio, 2 of 4, selected", Tab lands on the group once (roving tabindex),
 * and arrow keys move the selection - instead of a stack of anonymous
 * buttons. `secondary` is an extra, visually quieter option (used for
 * "I don't know") that takes part in the same group.
 */
export function ChoiceList({
  choices,
  value,
  onChange,
  label,
  secondary,
}: {
  choices: string[];
  value: string;
  onChange: (value: string) => void;
  /** Accessible name for the group (e.g. the question). */
  label: string;
  secondary?: { value: string; label: string };
}) {
  const options = [
    ...choices.map((c) => ({ value: c, label: c, quiet: false })),
    ...(secondary ? [{ ...secondary, quiet: true }] : []),
  ];
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  const selectedIndex = options.findIndex((o) => o.value === value);
  // Roving tabindex: the selected option is the tab stop; with none selected, the first.
  const tabStop = selectedIndex === -1 ? 0 : selectedIndex;

  function handleKeyDown(e: React.KeyboardEvent, index: number) {
    let next: number | null = null;
    if (e.key === "ArrowDown" || e.key === "ArrowRight") next = (index + 1) % options.length;
    else if (e.key === "ArrowUp" || e.key === "ArrowLeft") next = (index - 1 + options.length) % options.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = options.length - 1;
    if (next === null) return;
    e.preventDefault();
    onChange(options[next]!.value);
    refs.current[next]?.focus();
  }

  return (
    <div role="radiogroup" aria-label={label} className="grid gap-2">
      {options.map((option, i) => {
        const checked = option.value === value;
        return (
          <button
            key={option.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={i === tabStop ? 0 : -1}
            onClick={() => onChange(option.value)}
            onKeyDown={(e) => handleKeyDown(e, i)}
            className={cn(
              "rounded-md border px-3 py-2 text-left text-sm transition-colors",
              checked
                ? "border-accent bg-accent/10 text-foreground"
                : "border-border bg-surface hover:bg-muted",
              option.quiet && !checked && "text-muted-foreground"
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
