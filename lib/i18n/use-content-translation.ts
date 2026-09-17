"use client";

import { useEffect, useState } from "react";

import type { Locale } from "@/types/domain";
import { useLocale } from "@/lib/i18n/locale-context";

/**
 * Silently translates AI-generated content (learning paths, projects — see
 * convex/schema.ts's `contentTranslations` comment) when the learner's
 * current locale doesn't match the locale it was actually generated in.
 * Renders the original immediately; once the translate route resolves
 * (instantly on repeat views, since it's cached server-side after the
 * first), callers re-render with the translated bundle. Returns null
 * whenever no translation is needed or one isn't ready yet, so callers
 * always have a simple `translated?.field ?? original.field` fallback —
 * no loading state needs to be threaded through the UI.
 */
export function useContentTranslation<T>(
  endpoint: string,
  idKey: string,
  id: string,
  contentLocale: Locale | undefined
): T | null {
  const { locale } = useLocale();
  const [result, setResult] = useState<{ forLocale: Locale; translated: T | null } | null>(null);

  useEffect(() => {
    const sourceLocale = contentLocale ?? "en";
    if (sourceLocale === locale) return; // already in the right language
    if (result?.forLocale === locale) return; // already fetched (or fetching) this locale

    let cancelled = false;
    setResult({ forLocale: locale, translated: null }); // mark in-flight so this effect doesn't refire mid-request

    fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [idKey]: id }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return;
        setResult({ forLocale: locale, translated: (data?.translated ?? null) as T | null });
      })
      .catch(() => {
        if (!cancelled) setResult({ forLocale: locale, translated: null });
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale, contentLocale, endpoint, idKey, id]);

  if ((contentLocale ?? "en") === locale) return null;
  return result?.forLocale === locale ? result.translated : null;
}

/**
 * Same purpose as useContentTranslation above, but for a freely-mixed list
 * of independent rows (the practice board's exercises, the mistakes list)
 * rather than one always-viewed-together bundle — see
 * app/api/translate/exercise/route.ts's comment for why those batch
 * per-row instead of nesting like learning paths/projects do. Returns a
 * map from row id to its translated bundle, containing only entries whose
 * contentLocale doesn't already match the current locale (and only once
 * the batch request resolves) — callers do
 * `translatedById[row._id]?.field ?? row.field` per row.
 */
export function useBatchContentTranslation<T>(
  endpoint: string,
  idsKey: string,
  items: Array<{ id: string; contentLocale: Locale | undefined }>
): Record<string, T> {
  const { locale } = useLocale();
  const staleIds = items.filter((it) => (it.contentLocale ?? "en") !== locale).map((it) => it.id);
  // Stable string across renders unless the actual set of stale ids
  // changes — used as the effect dependency instead of the array itself,
  // which is a new reference every render.
  const idsSignature = [...staleIds].sort().join(",");

  const [result, setResult] = useState<{
    forLocale: Locale;
    forIds: string;
    translated: Record<string, T>;
  } | null>(null);

  useEffect(() => {
    if (idsSignature === "") return;
    if (result?.forLocale === locale && result.forIds === idsSignature) return;

    let cancelled = false;

    fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [idsKey]: idsSignature.split(",") }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return;
        setResult({ forLocale: locale, forIds: idsSignature, translated: (data?.translated ?? {}) as Record<string, T> });
      })
      .catch(() => {
        if (!cancelled) setResult({ forLocale: locale, forIds: idsSignature, translated: {} });
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale, idsSignature, endpoint, idsKey]);

  if (idsSignature === "") return {};
  return result?.forLocale === locale && result.forIds === idsSignature ? result.translated : {};
}
