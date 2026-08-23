<?php

namespace App\Actions\Monitoring;

use App\Models\Server;
use Throwable;

class GetServerProcesses
{
    public function handle(Server $server): array
    {
        try {
            $output = $server->ssh()->exec("ps -eo pid,user,ni,pcpu,pmem,args --sort=-pcpu 2>/dev/null || ps aux 2>/dev/null");
            return $this->parseOutput($output);
        } catch (Throwable $e) {
            return [
                'processes' => [],
                'users' => [],
                'error' => $e->getMessage(),
            ];
        }
    }

    private function parseOutput(string $output): array
    {
        $lines = preg_split('/\r\n|\r|\n/', trim($output));
        if (empty($lines)) {
            return ['processes' => [], 'users' => []];
        }

        // Detect format from header line
        $header = strtolower(trim($lines[0] ?? ''));
        $isPsAux = str_starts_with($header, 'user') || str_contains($header, 'vsz');

        // Remove header
        array_shift($lines);

        $processes = [];
        $users = [];

        foreach ($lines as $line) {
            $line = trim($line);
            if ($line === '') {
                continue;
            }

            if ($isPsAux) {
                // ps aux format: USER PID %CPU %MEM VSZ RSS TTY STAT START TIME COMMAND
                $parts = preg_split('/\s+/', $line, 11);
                if (count($parts) < 11) {
                    continue;
                }
                $pid = (int) $parts[1];
                $user = $parts[0];
                $cpu = is_numeric($parts[2]) ? (float) $parts[2] : 0.0;
                $memory = is_numeric($parts[3]) ? (float) $parts[3] : 0.0;
                $command = $parts[10];
                $priority = 0;
            } else {
                // ps -eo pid,user,ni,pcpu,pmem,args format
                $parts = preg_split('/\s+/', $line, 6);
                if (count($parts) < 6) {
                    continue;
                }
                $pid = (int) $parts[0];
                $user = $parts[1];
                $priority = is_numeric($parts[2]) ? (int) $parts[2] : 0;
                $cpu = is_numeric($parts[3]) ? (float) $parts[3] : 0.0;
                $memory = is_numeric($parts[4]) ? (float) $parts[4] : 0.0;
                $command = $parts[5];
            }

            if ($pid <= 0) {
                continue;
            }

            $processes[] = [
                'pid' => $pid,
                'user' => $user,
                'priority' => $priority,
                'cpu' => $cpu,
                'memory' => $memory,
                'command' => $command,
            ];

            if ($user !== '' && ! in_array($user, $users, true)) {
                $users[] = $user;
            }
        }

        sort($users, SORT_NATURAL | SORT_FLAG_CASE);

        return [
            'processes' => $processes,
            'users' => $users,
        ];
    }
}
