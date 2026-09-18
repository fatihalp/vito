import { BackupFile } from '@/types/backup-file';
import { StorageProvider } from '@/types/storage-provider';
import { Database } from '@/types/database';

export interface Backup {
  id: number;
  server_id: number;
  storage_id: number;
  storage: StorageProvider;
  database_id: number | null;
  database: Database | null;
  path: string | null;
  type: string;
  keep_backups: number;
  interval: string;
  files_count: number;
  status: string | null;
  status_color: 'gray' | 'success' | 'info' | 'warning' | 'danger' | null;
  enabled: boolean;
  created_at: string;
  updated_at: string;
  last_file?: BackupFile;
  problems: string[];
  pgbackrest: {
    stanza: string | null;
    cluster_id: number | null;
    strategy: 'standard' | 'custom' | null;
    schedules: { full: string; diff: string | null; incr: string | null } | null;
    retention: { full: number; diff: number | null } | null;
    verify_schedule: string | null;
    last_verified_at: string | null;
    last_verify_result: 'passed' | 'failed' | null;
    last_checked_at: string | null;
    last_check_result: 'passed' | 'failed' | null;
    process_max: number | null;
    wal_queue_max_gb: number | null;
  } | null;
  [key: string]: unknown;
}
