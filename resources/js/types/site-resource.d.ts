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
  role_value: 'database' | 'cache';
  role_color: 'gray' | 'success' | 'info' | 'warning' | 'danger' | 'default';
}
