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
