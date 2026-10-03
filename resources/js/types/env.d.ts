export interface EnvVariable {
  id: string;
  key: string;
  value: string;
  isSecret: boolean;
  isNew?: boolean; 
  managedBy?: string;
}

export interface EnvVersion {
  id: number;
  site_id: number;
  path: string;
  source: string;
  source_color: 'gray' | 'info' | 'warning' | 'danger';
  user_name: string | null;
  restored_from_id: number | null;
  created_at: string;
  updated_at: string;
}
