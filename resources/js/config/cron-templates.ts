export interface CronJobTemplate {
  id: string;
  label: string;
  name: string;
  getCommand: (sitePath?: string) => string;
  frequency: string;
  custom?: string;
  description: string;
  isOfficial?: boolean;
}

export const CRONJOB_TEMPLATES: CronJobTemplate[] = [
  {
    id: 'laravel-scheduler',
    label: 'Laravel Scheduler',
    name: 'Laravel Scheduler',
    getCommand: (sitePath) =>
      sitePath
        ? `cd ${sitePath} && php artisan schedule:run >> /dev/null 2>&1`
        : 'cd /path-to-your-project && php artisan schedule:run >> /dev/null 2>&1',
    frequency: '* * * * *',
    description: 'Official Laravel Task Scheduler (runs every minute)',
    isOfficial: true,
  },
  {
    id: 'queue-prune-batches',
    label: 'Prune Batches',
    name: 'Prune Queue Batches',
    getCommand: (sitePath) =>
      sitePath
        ? `cd ${sitePath} && php artisan queue:prune-batches --hours=48 >> /dev/null 2>&1`
        : 'cd /path-to-your-project && php artisan queue:prune-batches --hours=48 >> /dev/null 2>&1',
    frequency: '0 0 * * *',
    description: 'Prune stale queue batches from database daily',
  },
  {
    id: 'queue-prune-failed',
    label: 'Prune Failed Jobs',
    name: 'Prune Failed Queue Jobs',
    getCommand: (sitePath) =>
      sitePath
        ? `cd ${sitePath} && php artisan queue:prune-failed --hours=168 >> /dev/null 2>&1`
        : 'cd /path-to-your-project && php artisan queue:prune-failed --hours=168 >> /dev/null 2>&1',
    frequency: '0 0 * * *',
    description: 'Prune failed queue jobs older than 7 days daily',
  },
  {
    id: 'model-prune',
    label: 'Model Prune',
    name: 'Prune Models',
    getCommand: (sitePath) =>
      sitePath
        ? `cd ${sitePath} && php artisan model:prune >> /dev/null 2>&1`
        : 'cd /path-to-your-project && php artisan model:prune >> /dev/null 2>&1',
    frequency: '0 0 * * *',
    description: 'Prune models with Prunable trait daily',
  },
  {
    id: 'sanctum-prune',
    label: 'Prune Sanctum Tokens',
    name: 'Prune Sanctum Tokens',
    getCommand: (sitePath) =>
      sitePath
        ? `cd ${sitePath} && php artisan sanctum:prune-expired --hours=24 >> /dev/null 2>&1`
        : 'cd /path-to-your-project && php artisan sanctum:prune-expired --hours=24 >> /dev/null 2>&1',
    frequency: '0 0 * * *',
    description: 'Prune expired personal access tokens daily',
  },
  {
    id: 'telescope-prune',
    label: 'Prune Telescope',
    name: 'Prune Telescope',
    getCommand: (sitePath) =>
      sitePath
        ? `cd ${sitePath} && php artisan telescope:prune --hours=48 >> /dev/null 2>&1`
        : 'cd /path-to-your-project && php artisan telescope:prune --hours=48 >> /dev/null 2>&1',
    frequency: '0 0 * * *',
    description: 'Prune entries older than 48 hours from Telescope database',
  },
  {
    id: 'horizon-snapshot',
    label: 'Horizon Snapshot',
    name: 'Horizon Snapshot',
    getCommand: (sitePath) =>
      sitePath
        ? `cd ${sitePath} && php artisan horizon:snapshot >> /dev/null 2>&1`
        : 'cd /path-to-your-project && php artisan horizon:snapshot >> /dev/null 2>&1',
    frequency: 'custom',
    custom: '*/5 * * * *',
    description: 'Record Horizon queue metrics every 5 minutes',
  },
  {
    id: 'optimize-clear',
    label: 'Optimize Clear',
    name: 'Optimize Clear Cache',
    getCommand: (sitePath) =>
      sitePath
        ? `cd ${sitePath} && php artisan optimize:clear >> /dev/null 2>&1`
        : 'cd /path-to-your-project && php artisan optimize:clear >> /dev/null 2>&1',
    frequency: '0 0 * * 0',
    description: 'Clear cached configurations and views weekly',
  },
];
