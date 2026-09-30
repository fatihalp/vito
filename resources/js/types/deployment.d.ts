import { ServerLog } from '@/types/server-log';

export interface Deployment {
  id: number;
  site_id: number;
  deployment_script_id: number;
  log_id: number;
  log: ServerLog | null;
  commit_id: string;
  commit_id_short: string;
  commit_data: {
    name?: string;
    email?: string;
    message?: string;
    url?: string;
  };
  status: string;
  status_color: 'gray' | 'success' | 'info' | 'warning' | 'danger';
  release?: string;
  active: boolean;
  deployed_by: string | null;
  trigger: string | null;
  trigger_color: 'gray' | 'info' | 'warning' | null;
  rolled_back_by: string | null;
  rolled_back_at: string | null;
  created_at: string;
  updated_at: string;

  [key: string]: unknown;
}
