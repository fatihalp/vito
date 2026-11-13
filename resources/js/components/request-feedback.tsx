import { useTranslate } from '@/hooks/use-translate';
import { router, usePage } from '@inertiajs/react';
import { useEffect } from 'react';
import { toast } from 'sonner';
import { httpErrorMessage } from '@/lib/request-error';

export function RequestFeedback() {
  const translateText = useTranslate();
  const { locale = 'en' } = usePage().props;

  useEffect(() => {
    document.documentElement.lang = String(locale);
  }, [locale]);
  useEffect(() => {
    const stopNetwork = router.on('networkError', (event) => {
      event.preventDefault();
      toast.error(translateText('The connection failed. Check your network and try again.'), { id: 'request-error' });
    });
    const stopHttp = router.on('httpException', (event) => {
      event.preventDefault();
      toast.error(translateText(httpErrorMessage(event.detail.response.status, 'The request could not be completed. Please try again.')), { id: 'request-error' });
    });

    return () => {
      stopNetwork();
      stopHttp();
    };
  }, [translateText]);

  return null;
}
