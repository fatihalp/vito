export interface BackupRestore {
  id: number;
  backup_id: number;
  backup_file_name: string | null;
  server_id: number | null;
  server_name: string | null;
  target: 'latest' | 'backup' | 'time';
  target_time: string | null;
  status: string;
  status_color: 'gray' | 'success' | 'info' | 'warning' | 'danger';
  active: boolean;
  step: string | null;
  message: string | null;
  finished_at: string | null;
  created_at: string;
}

export interface RestoreRequirements {
  database_size: number | null;
  storage_gb: number | null;
  measured: boolean;
  cores: number | null;
  memory_gb: number | null;
  architecture: string | null;
  os: string;
  postgresql: string | null;
  source: string;
}
