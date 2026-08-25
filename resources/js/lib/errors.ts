import axios from 'axios';

export function errorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    return error.response?.data?.message ?? error.response?.data?.error ?? fallback;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return fallback;
}
