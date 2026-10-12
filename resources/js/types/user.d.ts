import { Project } from '@/types/project';

export interface UserProjectAccess {
  project_id: number;
  name: string | null;
  role: string;
  role_color: string;
}

export interface User {
  id: number;
  name: string;
  email: string;
  avatar?: string;
  email_verified_at: string | null;
  password_changed_at?: string | null;
  last_login_browser?: string | null;
  last_login_language?: string | null;
  last_login_user_agent?: string | null;
  project_access?: UserProjectAccess[];
  last_login_at: string | null;
  last_activity_at: string | null;
  created_at: string;
  updated_at: string;
  timezone: string;
  projects?: Project[];
  two_factor_enabled: boolean;
  is_admin: boolean;
  must_change_password: boolean;
  [key: string]: unknown; 
}
