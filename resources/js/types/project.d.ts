import { ProjectUser } from '@/types/project-user';

export interface Project {
  id: number;
  name: string;
  owner?: ProjectUser;
  users: ProjectUser[];
  role: string;
  servers_count?: number;
  sites_count?: number;
  monthly_cost?: {
    amount: number;
    currency: string;
    formatted: string;
  } | null;
  created_at: string;
  updated_at: string;

  [key: string]: unknown;
}
