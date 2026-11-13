export type CiStage = {
  name: string;
  result: string;
  seconds: number | null;
  peak_mem_mb: number | null;
  sampled_memory: boolean;
};

export type CiRun = {
  run_id: string;
  ref: string;
  sha: string | null;
  status: string;
  exit_code: number | null;
  created_at: number | null;
  finished_at: number | null;
  failure_reason?: string | null;
  local_stack_mode: 'fake' | 'real' | null;
  stages: CiStage[];
};

export type CiRunner = {
  server_id: number;
  server_name: string;
  repository: string;
  enabled: boolean;
  user?: string;
  executable?: string;
};
