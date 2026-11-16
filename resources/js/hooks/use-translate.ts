import { useCallback } from 'react';
import { translate } from '@/lib/translate';

export function useTranslate() {
  return useCallback((message: string, replacements?: Record<string, string | number>) =>
    translate(message, replacements), []);
}
