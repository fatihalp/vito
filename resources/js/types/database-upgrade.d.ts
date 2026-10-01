type BadgeColor = 'gray' | 'success' | 'info' | 'warning' | 'danger';

export interface UpgradeDatabase {
  name: string;
  size: number;
  tables: number;
  without_key: number;
  unlogged: number;
  materialized_views: number;
  large_objects: number;
  extensions: string[];
}

export interface DatabaseUpgrade {
  id: number;
  source_server_id: number;
  source_server_name: string | null;
  target_server_id: number | null;
  target_server_name: string | null;
  source_version: string | null;
  target_version: string;
  state: 'waiting_for_server' | 'preparing' | 'copying' | 'streaming' | 'finishing' | 'cancelling' | 'completed' | 'failed' | 'cancelled';
  status: string;
  status_color: BadgeColor;
  active: boolean;
  busy: boolean;
  step: string | null;
  message: string | null;
  progress: number | null;
  databases: UpgradeDatabase[];
  lag_bytes: number | null;
  restart_needed: boolean;
  warnings: string[];
  network: { name: string; kind: string; type: string } | null;
  caught_up_at: string | null;
  finished_at: string | null;
  created_at: string;
}

export interface UpgradeRequirements {
  version: number;
  versions: string[];
  databases: UpgradeDatabase[];
  database_size: number;
  storage_gb: number;
  cores: number | null;
  memory_gb: number | null;
  os: string;
  source: string;
  restart_needed: boolean;
  read_only: boolean;
  required_slots: number;
  required_senders: number;
  tables_without_key: string[];
  tables_without_key_count: number;
  warnings: string[];
}
