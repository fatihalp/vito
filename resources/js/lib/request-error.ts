import axios from 'axios';

export function httpErrorMessage(status: number, fallback: string): string {
  const messages: Record<number, string> = {
    401: 'Your session has expired. Sign in again and retry.',
    403: 'You do not have permission to perform this action.',
    404: 'The requested page or resource could not be found.',
    419: 'Your session has expired. Refresh the page and retry.',
    429: 'Too many requests. Please wait a moment and retry.',
  };

  return messages[status] ?? fallback;
}

export function requestErrorMessage(error: unknown, fallback = 'Could not connect to the provider.'): string {
  if (!axios.isAxiosError(error)) return fallback;
  if (!error.response) return 'The connection failed. Check your network and try again.';

  const { status, data } = error.response;
  if ([401, 403, 404, 419, 429].includes(status)) return httpErrorMessage(status, fallback);
  if (status >= 500) return fallback;

  if (typeof data !== 'object' || data === null) return fallback;
  if (status === 422 && typeof data.errors === 'object' && data.errors !== null) {
    const message = Object.values(data.errors).flat().find((value): value is string => typeof value === 'string' && value.length > 0);
    if (message) return message;
  }

  return typeof data.message === 'string' && data.message.length > 0 ? data.message : fallback;
}
