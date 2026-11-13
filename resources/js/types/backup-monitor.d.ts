export interface BackupMonitor {
  id: number;
  server_id: number;
  server_name: string;
  label: string;
  status: 'unknown' | 'healthy' | 'running' | 'warning' | 'failed';
  status_color: 'gray' | 'success' | 'warning' | 'danger';
  last_checked_at: string | null;
  last_task: 'backup' | 'verify' | null;
  task_state: 'requested' | 'submitted' | 'failed' | null;
  task_requested_at: string | null;
  can_run_backup: boolean;
  can_run_verify: boolean;
  can_delete: boolean;
  details: {
    last_success_at?: string | null;
    restore_state?: 'passed' | 'failed' | 'running' | 'stale' | 'unknown';
    restore_verified_at?: string | null;
    snapshots?: string[];
    error_code?: string | null;
  };
}

export interface BackupMonitorServer {
  id: number;
  name: string;
}
