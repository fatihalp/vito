import { router } from '@inertiajs/react';

export function withQuery(path: string, values: Record<string, unknown>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== null && value !== undefined) {
      query.set(key, typeof value === 'boolean' ? (value ? '1' : '0') : String(value));
    }
  }
  const search = query.toString();
  return search ? `${path}?${search}` : path;
}

export function readQueryParam(url: string, key: string): string | null {
  return new URLSearchParams(url.split('?')[1] ?? '').get(key);
}

export function replaceQueryParams(values: Record<string, string | null>): void {
  const url = new URL(window.location.href);
  for (const [key, value] of Object.entries(values)) {
    if (value === null) {
      url.searchParams.delete(key);
    } else {
      url.searchParams.set(key, value);
    }
  }
  if (url.href !== window.location.href) {
    router.replace({ url: url.pathname + url.search + url.hash, preserveState: true, preserveScroll: true });
  }
}
