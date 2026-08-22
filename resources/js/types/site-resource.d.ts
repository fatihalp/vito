import { Bucket } from '@/types/bucket';

export interface SiteResource {
  id: number;
  site_id: number;
  type: string;
  type_value: 'database' | 'cache' | 'bucket';
  type_color: 'gray' | 'success' | 'info' | 'warning' | 'danger' | 'default';
  status: 'connecting' | 'ready' | 'failed';
  status_color: 'success' | 'warning' | 'danger';
  server: {
    id: number;
    name: string;
    ip: string;
    local_ip: string | null;
    role: string;
  } | null;
  bucket: Bucket | null;
  environment?: Record<string, string>;
  environment_keys: string[];
  created_at: string;
  updated_at: string;
}

export interface SiteResourceServerOption {
  id: number;
  name: string;
  ip: string;
  role: string;
  role_value: string;
  role_color: 'gray' | 'success' | 'info' | 'warning' | 'danger' | 'default';
  has_database: boolean;
  has_cache: boolean;
  database_status: string | null;
  cache_status: string | null;
}
