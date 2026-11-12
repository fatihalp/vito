import { ServerLog } from '@/types/server-log';

export interface DeploymentStep {
  group: string;
  line: number;
  command: string;
}

export interface DeploymentProgress {
  steps: DeploymentStep[];
  estimated_duration: number | null;
  samples: number;
}

export interface Deployment {
  id: number;
  site_id: number;
  deployment_script_id: number;
  log_id: number;
  log: ServerLog | null;
  commit_id: string;
  commit_id_short: string;
  is_duplicate?: boolean;
  original_deployment_id?: number | null;
  commit_data: {
    name?: string;
    email?: string;
    message?: string;
    url?: string;
    date?: string;
  };
  status: string;
  status_color: 'gray' | 'success' | 'info' | 'warning' | 'danger';
  release?: string;
  active: boolean;
  deployed_by: string | null;
  trigger: string | null;
  trigger_color: 'gray' | 'info' | 'warning' | null;
  finished_at: string | null;
  duration?: number | null;
  formatted_duration?: string | null;
  progress?: DeploymentProgress;
  created_at: string;
  updated_at: string;

  [key: string]: unknown;
}

export interface LatestCommit {
  commit_id?: string;
  commit_data?: Deployment['commit_data'];
  deployed?: boolean;
  error?: string;
}
