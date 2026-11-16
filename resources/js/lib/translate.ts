export function translate(message: string, replacements: Record<string, string | number> = {}): string {
  return message.replace(/:([A-Za-z_][A-Za-z_0-9]*)/g, (match, key: string) =>
    Object.hasOwn(replacements, key) ? String(replacements[key]) : match,
  );
}
