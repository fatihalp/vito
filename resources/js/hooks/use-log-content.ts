import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useSocketListener } from '@/hooks/use-socket-events';
import { appendLogContent, lastStepMarker, LogStep, stripStepMarkers } from '@/lib/log';

type UseLogContentOptions = {
  
  serverId: number;
  
  logId: number;
  
  enabled?: boolean;
};

type UseLogContentReturn = {
  content: string;
  step: LogStep | null;
  isLoading: boolean;
  error: string | null;
};


export function useLogContent({ serverId, logId, enabled = true }: UseLogContentOptions): UseLogContentReturn {
  const [raw, setRaw] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  
  useEffect(() => {
    if (!enabled || !logId) {
      return;
    }

    const controller = new AbortController();
    setIsLoading(true);
    setError(null);
    setRaw('');

    axios
      .get(`/servers/${serverId}/logs/${logId}`, { signal: controller.signal })
      .then((response) => {
        if (controller.signal.aborted) return;
        const data = typeof response.data === 'string' ? response.data : JSON.stringify(response.data, null, 2);
        setRaw(data);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        if (axios.isAxiosError(err)) {
          setError(err.response?.data?.error || 'An error occurred while fetching the log');
        } else {
          setError('Unknown error occurred');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });

    return () => controller.abort();
  }, [enabled, serverId, logId]);

  
  useSocketListener((event) => {
    if (!enabled || event.type !== 'server-log.content') return;
    if (!event.data || (event.data as { id?: number }).id !== logId) return;

    const buf = (event.data as { content?: string }).content;
    if (buf) {
      setRaw((prev) => appendLogContent(prev, buf));
    }
  });

  const content = useMemo(() => stripStepMarkers(raw), [raw]);
  const step = useMemo(() => lastStepMarker(raw), [raw]);

  return { content, step, isLoading: enabled && !!logId && isLoading, error };
}
