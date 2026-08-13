import { QueryClient } from '@tanstack/react-query';

let currentUserId: number | null = null;
let queryClient: QueryClient | null = null;

export function getQueryClient(userId: number): QueryClient {
  if (!queryClient || currentUserId !== userId) {
    queryClient?.clear();
    queryClient = new QueryClient();
    currentUserId = userId;
  }

  return queryClient;
}

export function clearQueryClient(): void {
  queryClient?.clear();
  queryClient = null;
  currentUserId = null;
}
