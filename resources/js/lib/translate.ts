import turkish from '../../../lang/tr.json';

export type Locale = 'en' | 'tr';

export function translate(message: string, locale: Locale, replacements: Record<string, string | number> = {}): string {
  const translated = locale === 'tr' && Object.hasOwn(turkish, message) ? (turkish as Record<string, string>)[message] : message;

  return translated.replace(/:([A-Za-z_][A-Za-z_0-9]*)/g, (match, key: string) =>
    Object.hasOwn(replacements, key) ? String(replacements[key]) : match,
  );
}
