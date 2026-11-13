<?php

namespace App\Actions\RuntimeProcess;

use App\Enums\RuntimeProcessStatus;
use App\Models\RuntimeProcess;
use App\Models\Server;
use App\Services\RuntimeProcess\RuntimeCommand;
use Illuminate\Support\Collection;
use Throwable;

class RefreshRuntimeProcesses
{
    public function refresh(Server $server): void
    {
        $processes = RuntimeProcess::query()->where('server_id', $server->id)->get();
        foreach ($processes->groupBy(fn (RuntimeProcess $process): string => $process->driver.':'.$process->unix_user) as $group) {
            try {
                $states = $this->read($server, $group->first()->driver, $group, $group->first()->unix_user);
                foreach ($group as $process) {
                    $state = $states[$process->runtime_name] ?? ['status' => RuntimeProcessStatus::UNKNOWN, 'details' => []];
                    $process->update([...$state, 'last_checked_at' => now()]);
                }
            } catch (Throwable) {
                foreach ($group as $process) {
                    $process->update([
                        'status' => RuntimeProcessStatus::UNKNOWN,
                        'details' => ['error' => 'Status could not be verified. Check SSH access and service permissions.'],
                        'last_checked_at' => now(),
                    ]);
                }
            }
        }
    }

    private function read(Server $server, string $driver, Collection $processes, string $user): array
    {
        $commands = app(RuntimeCommand::class);
        foreach ($processes as $process) {
            $commands->validateName($driver, $process->runtime_name);
        }
        $prefix = $commands->prefix($server, $driver, $user);
        $ssh = $server->ssh()->clearLog();
        if (in_array($driver, ['systemd', 'systemd_user'], true)) {
            $names = $processes->map(fn (RuntimeProcess $process): string => escapeshellarg($process->runtime_name))->implode(' ');
            $output = $ssh->exec($prefix.' show '.$names.' -p Id -p LoadState -p ActiveState -p SubState -p UnitFileState -p MainPID -p LastTriggerUSec -p NextElapseUSecRealtime', timeout: 20, outputLimit: 1048576);

            return $this->parseSystemd($output);
        }
        if (in_array($driver, ['docker', 'rootless_docker'], true)) {
            return $this->parseDocker($ssh->exec($prefix." ps -a --format '{{.Names}}|{{.State}}|{{.Status}}'", timeout: 20, outputLimit: 1048576));
        }
        if ($driver === 'supervisor') {
            return $this->parseSupervisor($ssh->exec($prefix.' status || test "$?" -eq 3', timeout: 20, outputLimit: 1048576));
        }

        return [];
    }

    public function parseSystemd(string $output): array
    {
        $states = [];
        foreach (preg_split('/\n\s*\n/', trim($output)) as $block) {
            $values = [];
            foreach (explode("\n", $block) as $line) {
                $pair = explode('=', $line, 2);
                if (count($pair) === 2) {
                    $values[$pair[0]] = $pair[1];
                }
            }
            if (empty($values['Id'])) {
                continue;
            }
            $status = match (true) {
                ($values['LoadState'] ?? '') === 'not-found' => RuntimeProcessStatus::UNKNOWN,
                in_array($values['UnitFileState'] ?? '', ['masked', 'masked-runtime'], true) => RuntimeProcessStatus::MASKED,
                ($values['ActiveState'] ?? '') === 'failed' => RuntimeProcessStatus::FAILED,
                ($values['ActiveState'] ?? '') === 'active' => RuntimeProcessStatus::RUNNING,
                ($values['ActiveState'] ?? '') === 'inactive' => RuntimeProcessStatus::STOPPED,
                default => RuntimeProcessStatus::UNKNOWN,
            };
            $states[$values['Id']] = ['status' => $status, 'details' => array_intersect_key($values, array_flip([
                'ActiveState', 'SubState', 'UnitFileState', 'MainPID', 'LastTriggerUSec', 'NextElapseUSecRealtime',
            ]))];
        }

        return $states;
    }

    public function parseDocker(string $output): array
    {
        $states = [];
        foreach (explode("\n", trim($output)) as $line) {
            $parts = explode('|', $line, 3);
            if (count($parts) !== 3) {
                continue;
            }
            [$name, $state, $health] = $parts;
            $status = match (true) {
                str_contains($health, '(unhealthy)') => RuntimeProcessStatus::FAILED,
                $state === 'running' => RuntimeProcessStatus::RUNNING,
                in_array($state, ['exited', 'created', 'paused'], true) => RuntimeProcessStatus::STOPPED,
                $state === 'dead' => RuntimeProcessStatus::FAILED,
                default => RuntimeProcessStatus::UNKNOWN,
            };
            $states[$name] = ['status' => $status, 'details' => ['state' => $state, 'health' => mb_substr($health, 0, 160)]];
        }

        return $states;
    }

    public function parseSupervisor(string $output): array
    {
        $states = [];
        foreach (explode("\n", trim($output)) as $line) {
            if (! preg_match('/^(\S+)\s+(\S+)/', $line, $parts)) {
                continue;
            }
            $status = match ($parts[2]) {
                'RUNNING' => RuntimeProcessStatus::RUNNING,
                'STOPPED', 'EXITED' => RuntimeProcessStatus::STOPPED,
                'FATAL', 'BACKOFF' => RuntimeProcessStatus::FAILED,
                default => RuntimeProcessStatus::UNKNOWN,
            };
            $states[$parts[1]] = ['status' => $status, 'details' => ['state' => $parts[2]]];
        }

        return $states;
    }
}
