import axios from 'axios';

export function ciError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    if (error.response?.status === 422) {
      const errors = error.response.data?.errors;
      if (errors && typeof errors === 'object') {
        const message = Object.values(errors).flat().find((value) => typeof value === 'string');
        if (typeof message === 'string') return message;
      }
    }
    if (error.response?.status === 403) return 'You do not have permission to perform this CI action.';
    if (error.response?.status === 401 || error.response?.status === 419) return 'Your session expired. Sign in again.';
    if (error.response?.status === 429) return 'Too many CI requests. Wait a moment and retry.';
  }
  return 'Could not load CI data. Check your connection and retry.';
}
