export interface WorkerLog {
  id: number;
  worker_id: number;
  user_id: number | null;
  user_name: string | null;
  user?: {
    id: number;
    name: string;
    email: string;
  } | null;
  type: string;
  type_color: 'gray' | 'success' | 'info' | 'warning' | 'danger' | 'default';
  description: string | null;
  created_at: string;
}

export interface Worker {
  id: number;
  server_id: number;
  site_id: number | null;
  user_id?: number | null;
  created_by?: string | null;
  creator?: {
    id: number;
    name: string;
    email: string;
  } | null;
  name: string;
  command: string;
  directory?: string | null;
  user: string;
  auto_start: boolean;
  auto_restart: boolean;
  numprocs: number;
  status: string;
  status_color: 'gray' | 'success' | 'info' | 'warning' | 'danger';
  error: string | null;
  is_site_bootstrap: boolean;
  created_at: string;
  updated_at: string;
}
