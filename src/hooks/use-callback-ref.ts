"use client";

import { useCallback, useInsertionEffect, useRef } from "react";

/**
 * Returns a stable function identity that always calls the latest `callback`.
 * Useful when a callback is bound once (e.g. a chart event subscription set up
 * in a create-once effect) but must read fresh state/props on every invocation,
 * avoiding stale closures without re-subscribing.
 */
export function useCallbackRef<T extends (...args: never[]) => unknown>(callback: T): T {
  const ref = useRef(callback);

  // useInsertionEffect runs before layout/passive effects, so the ref is fresh
  // before any subscriber can fire during the same commit.
  useInsertionEffect(() => {
    ref.current = callback;
  });

  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useCallback(((...args) => ref.current(...args)) as T, []);
}
