<?php

namespace App\Actions\Worker;

use App\Enums\WorkerStatus;
use App\Models\Server;
use App\Models\Site;
use App\Models\Worker;
use Illuminate\Support\Collection;

class SyncWorkers
{
    /**
     * @return array{created: int, updated: int}
     */
    public function sync(Server $server, ?Site $site = null): array
    {
        $output = $server->ssh()->exec($this->command(), 'sync-workers', $site?->id);
        $programs = $this->programs($output);
        $sites = $server->sites()->get(['id', 'path']);
        $created = 0;
        $updated = 0;

        foreach ($programs as $program) {
            $siteId = $this->siteId($program, $sites);
            if ($site && $siteId !== $site->id) {
                continue;
            }

            $worker = Worker::query()
                ->where('server_id', $server->id)
                ->where(function ($query) use ($program): void {
                    $query->where('process_name', $program['process_name']);
                    if (ctype_digit($program['process_name'])) {
                        $query->orWhere('id', (int) $program['process_name']);
                    }
                })
                ->first();

            $worker ??= new Worker([
                'server_id' => $server->id,
                'process_name' => $program['process_name'],
                'name' => $program['process_name'],
            ]);

            $worker->fill([
                'server_id' => $server->id,
                'site_id' => $siteId,
                'process_name' => $program['process_name'],
                'command' => $program['command'],
                'user' => $program['user'] ?: $server->getSshUser(),
                'auto_start' => $program['auto_start'],
                'auto_restart' => $program['auto_restart'],
                'numprocs' => $program['numprocs'],
                'stdout_logfile' => $program['stdout_logfile'],
                'status' => $program['status'],
            ]);

            $worker->exists ? $updated++ : $created++;
            $worker->save();
        }

        return compact('created', 'updated');
    }

    private function command(): string
    {
        return <<<'BASH'
bash <<'VITO_SYNC_WORKERS'
printf '__VITO_STATUS__\n'
sudo supervisorctl status || true
printf '__VITO_CONFIGS__\n'
sudo find /etc/supervisor/conf.d -maxdepth 1 -type f -name '*.conf' -print0 | while IFS= read -r -d '' file; do
    printf '__VITO_FILE__%s\n' "$file"
    sudo cat "$file"
    printf '\n__VITO_END_FILE__\n'
done
VITO_SYNC_WORKERS
BASH;
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function programs(string $output): array
    {
        [$statusOutput, $configOutput] = array_pad(explode('__VITO_CONFIGS__', $output, 2), 2, '');
        $statuses = $this->statuses(str_replace('__VITO_STATUS__', '', $statusOutput));
        $programs = [];

        preg_match_all('/__VITO_FILE__(?<file>[^\n]+)\n(?<body>.*?)__VITO_END_FILE__/s', $configOutput, $matches, PREG_SET_ORDER);
        foreach ($matches as $match) {
            $config = $this->config($match['body']);
            if (! $config) {
                continue;
            }

            $processName = $config['program'];
            $programs[] = [
                'process_name' => $processName,
                'command' => $config['command'] ?? '',
                'user' => $config['user'] ?? '',
                'auto_start' => $this->bool($config['autostart'] ?? true),
                'auto_restart' => $this->bool($config['autorestart'] ?? true),
                'numprocs' => max(1, (int) ($config['numprocs'] ?? 1)),
                'stdout_logfile' => $config['stdout_logfile'] ?? null,
                'directory' => $config['directory'] ?? null,
                'status' => $statuses[$processName] ?? WorkerStatus::STOPPED,
            ];
        }

        return $programs;
    }

    /**
     * @return array<string, WorkerStatus>
     */
    private function statuses(string $output): array
    {
        $statuses = [];
        foreach (preg_split('/\R/', trim($output)) ?: [] as $line) {
            if (! preg_match('/^(?<name>\S+)\s+(?<status>[A-Z]+)/', trim($line), $match)) {
                continue;
            }

            $name = explode(':', $match['name'])[0];
            $statuses[$name] = match ($match['status']) {
                'RUNNING', 'STARTING' => WorkerStatus::RUNNING,
                'STOPPED' => WorkerStatus::STOPPED,
                default => WorkerStatus::FAILED,
            };
        }

        return $statuses;
    }

    /**
     * @return array<string, string>|null
     */
    private function config(string $body): ?array
    {
        if (! preg_match('/^\[program:(?<program>[^\]]+)]/m', $body, $match)) {
            return null;
        }

        $config = ['program' => trim($match['program'])];
        foreach (preg_split('/\R/', $body) ?: [] as $line) {
            $line = trim($line);
            if ($line === '' || str_starts_with($line, '[') || str_starts_with($line, ';') || ! str_contains($line, '=')) {
                continue;
            }

            [$key, $value] = array_map('trim', explode('=', $line, 2));
            $config[strtolower($key)] = $value;
        }

        return $config;
    }

    private function bool(mixed $value): bool
    {
        return ! in_array(strtolower((string) $value), ['0', 'false', 'no'], true);
    }

    /**
     * @param  Collection<int, Site>  $sites
     */
    private function siteId(array $program, Collection $sites): ?int
    {
        $directory = $program['directory'] ?? null;
        if ($directory && $site = $sites->firstWhere('path', $directory)) {
            return $site->id;
        }

        $command = $program['command'] ?? '';

        return $sites->first(fn (Site $site) => str_contains($command, $site->path))?->id;
    }
}
