export interface Bucket {
  id: number;
  project_id: number;
  name: string;
  driver: string;
  endpoint: string;
  region: string;
  bucket: string;
  path_style: boolean;
  visibility: 'private' | 'public';
  allowed_origins: string[];
  created_at: string;
  updated_at: string;
}
