export interface Command {
  id: number;
  server_id: number;
  site_id: number;
  name: string;
  command: string;
  is_raw: boolean;
  variables: string[];
  created_at: string;
  updated_at: string;

  [key: string]: unknown;
}
