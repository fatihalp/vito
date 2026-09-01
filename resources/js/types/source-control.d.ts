import { Project } from '@/types/project';
import { User } from '@/types/user';

export interface GithubAppDetails {
  account_login: string | null;
  account_type: string | null;
  html_url: string | null;
}

export interface SourceControl {
  id: number;
  user?: User | null;
  user_id?: number;
  project?: Project | null;
  project_id?: number | null;
  global: boolean;
  name: string;
  provider: string;
  external_identifier?: string | null;
  github_app?: GithubAppDetails;
  ssh_port?: number;
  created_at: string;
  updated_at: string;

  [key: string]: unknown;
}
