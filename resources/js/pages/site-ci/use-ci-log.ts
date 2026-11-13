import axios from 'axios';
import { useEffect, useState } from 'react';
import { ciError } from './ci-error';

export function useCiLog(base: string, runId: string | null, stage: string, active: boolean, enabled: boolean) {
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [limited, setLimited] = useState(false);

  useEffect(() => {
    setText('');
    setError(null);
    setLimited(false);
    if (!runId || !enabled) {
      setLoading(false);
      return;
    }
    let disposed = false;
    let cursor = 0;
    let received = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const controller = new AbortController();
    const load = async () => {
      setLoading(true);
      try {
        const response = await axios.get<{ text: string; cursor: number }>(`${base}/${runId}/log`, {
          params: { cursor, ...(stage ? { stage } : {}) },
          signal: controller.signal,
        });
        if (disposed) return;
        const chunk = response.data;
        if (typeof chunk.text !== 'string' || !Number.isSafeInteger(chunk.cursor) || chunk.cursor < cursor) {
          setError('The runner returned invalid log data. Refresh the page.');
          return;
        }
        const advanced = chunk.cursor > cursor;
        cursor = chunk.cursor;
        received += new TextEncoder().encode(chunk.text).byteLength;
        setText((previous) => (previous + chunk.text).slice(-262144));
        setError(null);
        if (received >= 262144) {
          setLimited(true);
        } else if (advanced || active) {
          timer = setTimeout(load, advanced ? 150 : 5000);
        }
      } catch (failure) {
        if (!disposed) {
          setError(ciError(failure));
          timer = setTimeout(load, 10000);
        }
      } finally {
        if (!disposed) setLoading(false);
      }
    };
    void load();
    return () => {
      disposed = true;
      controller.abort();
      if (timer) clearTimeout(timer);
    };
  }, [base, runId, stage, active, enabled]);

  return { text, error, loading, limited };
}
