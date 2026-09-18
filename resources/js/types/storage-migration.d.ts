import { StorageProvider } from '@/types/storage-provider';

export interface StorageMigration {
  id: number;
  name: string | null;
  project_id: number;
  source_storage_id: number;
  source?: StorageProvider;
  target_storage_id: number;
  target?: StorageProvider;
  overwrite: boolean;
  worker_count: number;
  max_worker_count: number;
  worker_capacity: number;
  items_processing: number;
  status: string;
  status_color: 'gray' | 'success' | 'info' | 'warning' | 'danger' | null;
  progress: number;
  syncing: boolean;
  last_activity_at: string | null;
  items_total: number;
  items_copied: number;
  items_skipped: number;
  items_failed: number;
  bytes_total: number;
  bytes_copied: number;
  error: string | null;
  started_at: string | null;
  scan_completed_at: string | null;
  target_scan_completed_at: string | null;
  scan_paused: boolean;
  transfer_paused: boolean;
  finished_at: string | null;
  created_at: string;
  updated_at: string;

  [key: string]: unknown;
}
