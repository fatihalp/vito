import { Backup } from '@/types/backup';

type BadgeColor = 'gray' | 'success' | 'info' | 'warning' | 'danger';

export interface DatabaseReplicaMetric {
  date: string;
  health: string;
  health_color: BadgeColor;
  state: string | null;
  lag_bytes: number | null;
  replay_delay_seconds: number | null;
  write_lag_ms: number | null;
  flush_lag_ms: number | null;
  replay_lag_ms: number | null;
  slot_retained_bytes: number | null;
  slot_wal_status: string | null;
}

export interface DatabaseReplica {
  id: number;
  postgres_cluster_id: number;
  primary_server_id: number;
  primary_server_name: string | null;
  replica_server_id: number;
  replica_server_name: string | null;
  status: 'pending' | 'waiting_for_backup' | 'configuring' | 'seeding' | 'ready' | 'failed' | 'needs_rebuild' | 'promoting' | 'deleting';
  status_color: BadgeColor;
  health: 'healthy' | 'warning' | 'critical' | 'unknown';
  health_color: BadgeColor;
  health_reasons: string[];
  private_address: string | null;
  slot_name: string;
  username: string;
  max_slot_wal_keep_size_gb: number;
  progress: number | null;
  message: string | null;
  setup_step: string | null;
  latest_metric?: DatabaseReplicaMetric;
  last_checked_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PostgresCluster {
  id: number;
  stanza: string;
  status: 'active' | 'failing_over';
  status_color: BadgeColor;
  primary_server_id: number;
  primary_server_name: string | null;
  network: {
    id: number;
    name: string;
    type: string;
    kind: string;
    managed: boolean;
    cidr: string | null;
    nodes: {
      server_id: number;
      name: string;
      role: 'primary' | 'replica';
      ip: string | null;
      status: string;
      connected: boolean | null;
      last_handshake_at: string | null;
    }[];
  } | null;
  backup: Backup | null;
  tls_expires_at: string | null;
  backups_from_replicas: boolean;
  failover_enabled: boolean;
  failover: { step: string; error: string | null; force: boolean; new_primary_server_id: number; started_at: string | null } | null;
}
