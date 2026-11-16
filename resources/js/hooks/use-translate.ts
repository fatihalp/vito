import { usePage } from '@inertiajs/react';
import { useCallback } from 'react';
import { SharedData } from '@/types';
import { translate } from '@/lib/translate';

export function useTranslate() {
  const { locale = 'en' } = usePage<SharedData>().props;
  return useCallback((message: string, replacements?: Record<string, string | number>) =>
    translate(message, locale, replacements), [locale]);
}
