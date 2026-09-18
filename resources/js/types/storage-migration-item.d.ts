export interface StorageMigrationItem {
  id: number;
  backup_file_id: number | null;
  source_key: string;
  target_key: string;
  size: number | null;
  copied_bytes: number | null;
  status: string;
  status_color: 'gray' | 'success' | 'info' | 'warning' | 'danger' | null;
  attempts: number;
  error: string | null;
  created_at: string;
  updated_at: string;

  [key: string]: unknown;
}
