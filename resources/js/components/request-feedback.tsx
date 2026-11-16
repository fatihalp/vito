import { router } from '@inertiajs/react';
import { useEffect } from 'react';
import { toast } from 'sonner';
import { httpErrorMessage } from '@/lib/request-error';

export function RequestFeedback() {
  useEffect(() => {
    const stopNetwork = router.on('networkError', (event) => {
      event.preventDefault();
      toast.error('The connection failed. Check your network and try again.', { id: 'request-error' });
    });
    const stopHttp = router.on('httpException', (event) => {
      event.preventDefault();
      toast.error(httpErrorMessage(event.detail.response.status, 'The request could not be completed. Please try again.'), { id: 'request-error' });
    });

    return () => {
      stopNetwork();
      stopHttp();
    };
  }, []);

  return null;
}
