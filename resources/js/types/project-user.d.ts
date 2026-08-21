export interface ProjectUser {
  id: number;
  user_id: number | null;
  project_id: number;
  project_name: string | null;
  name: string | null;
  email: string;
  role: string;
  type: 'user' | 'invitation';
}

export interface ProjectInvitee {
  id: number;
  name: string;
  email: string;
}
