import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

import { errorMessage } from '@/api';
import { getDataVersion } from '@/api/client';
import { toast } from '@/components/Toast';

/**
 * Minimal data loader: fetches when the screen gains focus (if the data is older
 * than `staleMs` — keeps request volume down, the API is rate-limited), exposes a
 * pull-to-refresh handler, and keeps showing stale data while reloading.
 * Failures are shown as an error toast with a Retry action.
 */
export function useQuery<T>(
  fetcher: () => Promise<T>,
  deps: unknown[] = [],
  { staleMs = 60_000 }: { staleMs?: number } = {},
) {
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const requestId = useRef(0);
  const fetcherRef = useRef(fetcher);
  const depsKey = JSON.stringify(deps);
  const lastFetch = useRef<{ key: string; at: number; version: number } | null>(null);

  useEffect(() => {
    fetcherRef.current = fetcher;
  });

  const load = useCallback(
    async function run(mode: 'focus' | 'refresh' | 'silent' = 'silent'): Promise<void> {
      const last = lastFetch.current;
      const fresh =
        last && last.key === depsKey && last.version === getDataVersion() && Date.now() - last.at < staleMs;
      if (mode === 'focus' && fresh) return;
      const version = getDataVersion();
      const id = ++requestId.current;
      if (mode === 'refresh') setRefreshing(true);
      try {
        const result = await fetcherRef.current();
        if (id === requestId.current) {
          setData(result);
          setError(null);
          lastFetch.current = { key: depsKey, at: Date.now(), version };
        }
      } catch (e) {
        if (id === requestId.current) {
          const message = errorMessage(e);
          setError(message);
          toast.error(message, { action: { label: 'Retry', onPress: () => run('refresh') } });
        }
      } finally {
        if (id === requestId.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    // depsKey re-creates load (and so re-fetches via the focus effect) when inputs change
    [depsKey, staleMs],
  );

  useFocusEffect(
    useCallback(() => {
      load('focus');
    }, [load]),
  );

  return {
    data,
    error,
    loading: loading && data === undefined,
    refreshing,
    refresh: () => load('refresh'),
    reload: () => load('silent'),
    setData,
  };
}

/** Debounce a changing value (for search boxes). */
export function useDebounced<T>(value: T, ms = 500) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}
