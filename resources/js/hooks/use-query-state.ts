import { useEffect, useState } from 'react';
import { usePage } from '@inertiajs/react';
import { readQueryParam, replaceQueryParams } from '@/lib/url';

export function useQueryState<T extends string = string>(key: string, defaultValue: NoInfer<T>): [T, (value: T) => void] {
  const { url } = usePage();
  const [value, setValue] = useState<T>(() => (readQueryParam(url, key) as T | null) ?? defaultValue);

  useEffect(() => {
    const timer = window.setTimeout(() => replaceQueryParams({ [key]: value === defaultValue ? null : value }), 300);

    return () => window.clearTimeout(timer);
  }, [key, value, defaultValue]);

  return [value, setValue];
}

export function useQueryFlag(key: string, defaultValue: boolean): [boolean, (value: boolean) => void] {
  const [value, setValue] = useQueryState(key, defaultValue ? '1' : '0');

  return [value === '1', (next: boolean) => setValue(next ? '1' : '0')];
}
