export interface WorkerTemplate {
  id: string;
  label: string;
  name: string;
  command: string;
  description: string;
  numprocs?: string;
}

export const WORKER_TEMPLATES: WorkerTemplate[] = [
  {
    id: 'horizon',
    label: 'Laravel Horizon',
    name: 'horizon',
    command: 'php artisan horizon',
    description: 'Laravel Horizon queue manager and supervisor',
    numprocs: '1',
  },
  {
    id: 'queue-work',
    label: 'Queue Worker',
    name: 'queue-worker',
    command: 'php artisan queue:work --sleep=3 --tries=3 --max-time=3600',
    description: 'Standard Laravel queue processing daemon',
    numprocs: '1',
  },
  {
    id: 'schedule-work',
    label: 'Scheduler',
    name: 'schedule-worker',
    command: 'php artisan schedule:work',
    description: 'Executes Laravel scheduled tasks continuously',
    numprocs: '1',
  },
  {
    id: 'reverb',
    label: 'Reverb (WebSocket)',
    name: 'reverb',
    command: 'php artisan reverb:start',
    description: 'Laravel Reverb WebSocket server',
    numprocs: '1',
  },
  {
    id: 'queue-listen',
    label: 'Queue Listen',
    name: 'queue-listen',
    command: 'php artisan queue:listen',
    description: 'Queue listener with automatic code reloading',
    numprocs: '1',
  },
  {
    id: 'pulse',
    label: 'Laravel Pulse',
    name: 'pulse',
    command: 'php artisan pulse:check',
    description: 'Performance recording worker for Pulse',
    numprocs: '1',
  },
];
