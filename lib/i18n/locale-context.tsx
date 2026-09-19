"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { useMutation } from "convex/react";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { Locale } from "@/types/domain";
import { dictionaries, type Dictionary } from "@/lib/i18n/dictionaries";

interface LocaleContextValue {
  locale: Locale;
  t: Dictionary;
  setLocale: (locale: Locale) => void;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

/**
 * Wraps the authenticated app so any client component can read/switch the
 * UI language. The initial value comes from the user's persisted Convex
 * preference (set server-side in app/(app)/layout.tsx); switching updates
 * local state immediately (no flash/reload) and persists it via the same
 * `updatePreferences` mutation the rest of Settings already uses, so it's
 * synced across devices/sessions. AI-generated content (lessons, exercises,
 * feedback) picks up the same preference server-side via LearnerContext.locale.
 */
export function LocaleProvider({
  userId,
  initialLocale,
  children,
}: {
  userId: Id<"users">;
  initialLocale: Locale;
  children: React.ReactNode;
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);
  const updatePreferences = useMutation(api.users.updatePreferences);

  const setLocale = useCallback(
    (next: Locale) => {
      if (next === locale) return;
      const previous = locale;
      setLocaleState(next); // optimistic — no reload needed
      updatePreferences({ userId, locale: next }).catch(() => setLocaleState(previous));
    },
    [locale, userId, updatePreferences]
  );

  const value = useMemo<LocaleContextValue>(
    () => ({ locale, t: dictionaries[locale], setLocale }),
    [locale, setLocale]
  );

  // The root <html lang> is fixed to "en", so mark the app's own language
  // here - it's what screen readers use to pick a voice and pronunciation.
  // `contents` keeps the wrapper out of the layout.
  return (
    <LocaleContext.Provider value={value}>
      <div lang={locale} className="contents">
        {children}
      </div>
    </LocaleContext.Provider>
  );
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useLocale must be used within a LocaleProvider");
  return ctx;
}
