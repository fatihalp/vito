import { CommandExecution } from '@/types/command-execution';

export interface CronJob {
  id: number;
  name: string | null;
  server_id: number;
  site_id: number | null;
  command: string;
  user: string;
  frequency: string;
  status: string;
  status_color: 'gray' | 'success' | 'info' | 'warning' | 'danger';
  last_execution?: CommandExecution | null;
  created_at: string;
  updated_at: string;
}
