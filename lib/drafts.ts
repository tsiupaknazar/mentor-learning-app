import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from "react";

/**
 * Best-effort persistence for in-progress work (an unsubmitted answer, the
 * files of a project task, an unfinished practice session), so a refresh,
 * a crashed tab or an accidental navigation doesn't throw it away.
 *
 * Deliberately localStorage rather than Convex: drafts are per-browser
 * scratch state, change on every keystroke, and are worthless once the work
 * is submitted. Every access is wrapped because storage can be unavailable
 * (private windows, blocked site data) or full - a draft failing to save
 * must never break the page, so failures are silently ignored.
 */

const PREFIX = "unsparing:draft:";

export const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

interface Envelope<T> {
  v: T;
  t: number;
}

function getStorage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

function readRaw(key: string): string | null {
  try {
    return getStorage()?.getItem(PREFIX + key) ?? null;
  } catch {
    return null;
  }
}

/** Pure decode of a stored envelope; null when missing, corrupt or older than `ttlMs`. */
function decode<T>(raw: string | null, ttlMs: number): T | null {
  if (!raw) return null;
  try {
    const envelope = JSON.parse(raw) as Envelope<T>;
    if (typeof envelope?.t !== "number" || Date.now() - envelope.t > ttlMs) return null;
    return envelope.v;
  } catch {
    return null;
  }
}

export function loadDraft<T>(key: string, ttlMs: number = DRAFT_TTL_MS): T | null {
  const raw = readRaw(key);
  const value = decode<T>(raw, ttlMs);
  if (raw && value === null) clearDraft(key); // expired or corrupt - don't keep it around
  return value;
}

export function saveDraft<T>(key: string, value: T): void {
  try {
    getStorage()?.setItem(PREFIX + key, JSON.stringify({ v: value, t: Date.now() } satisfies Envelope<T>));
  } catch {
    // Quota exceeded / storage blocked - drafts are best-effort.
  }
}

export function clearDraft(key: string): void {
  try {
    getStorage()?.removeItem(PREFIX + key);
  } catch {
    // Nothing to do.
  }
}

const SAVE_DEBOUNCE_MS = 400;

const noopSubscribe = () => () => {};

/**
 * Hook wrapper around the functions above for a single draft key.
 *
 * `ready` is false on the server and during hydration, and true afterwards -
 * callers should hold off rendering their editor until then and seed it from
 * `draft` once, rather than mounting empty and clobbering it afterwards.
 * Built on useSyncExternalStore so server and client markup stay identical.
 *
 * `draft` tracks what is in storage, so it changes after each save: treat it
 * as an *initial* value only (capture it when `ready` first becomes true,
 * e.g. by rendering an inner component that puts it in `useState`).
 *
 * `save` is debounced, and a pending write is flushed on unmount so the last
 * keystrokes aren't lost when the learner navigates away.
 */
export function useDraft<T>(key: string, ttlMs: number = DRAFT_TTL_MS) {
  const ready = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const raw = useSyncExternalStore(
    noopSubscribe,
    () => readRaw(key),
    () => null
  );
  const draft = useMemo(() => decode<T>(raw, ttlMs), [raw, ttlMs]);

  const pending = useRef<{ value: T } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (pending.current) {
      saveDraft(key, pending.current.value);
      pending.current = null;
    }
  }, [key]);

  const save = useCallback(
    (value: T) => {
      pending.current = { value };
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(flush, SAVE_DEBOUNCE_MS);
    },
    [flush]
  );

  const clear = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    pending.current = null;
    clearDraft(key);
  }, [key]);

  useEffect(() => flush, [flush]);

  return { ready, draft, save, clear };
}
