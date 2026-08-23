<?php

namespace App\Actions\Monitoring;

use App\Actions\Server\GetServiceLogs;
use App\DTOs\ServiceLog;
use App\Models\Server;
use Throwable;

class GetLogRotationData
{
    public function handle(Server $server): array
    {
        $logs = app(GetServiceLogs::class)->handle($server);

        $fileLogs = array_filter($logs, fn (ServiceLog $log) => $log->source === ServiceLog::SOURCE_FILE);

        if (empty($fileLogs)) {
            return [];
        }

        $paths = array_map(fn (ServiceLog $log) => escapeshellarg($log->target), $fileLogs);
        $pathsStr = implode(' ', $paths);

        try {
            $output = $server->ssh('root')->exec(
                "for f in {$pathsStr}; do if [ -f \"\$f\" ]; then stat --format=\"%n %s\" \"\$f\" 2>/dev/null || echo \"\$f 0\"; else echo \"\$f -1\"; fi; done"
            );
        } catch (Throwable) {
            $output = '';
        }

        $sizes = [];
        foreach (preg_split('/\r\n|\r|\n/', trim($output)) as $line) {
            $line = trim($line);
            if ($line === '') {
                continue;
            }
            $lastSpace = strrpos($line, ' ');
            if ($lastSpace === false) {
                continue;
            }
            $path = substr($line, 0, $lastSpace);
            $size = (int) substr($line, $lastSpace + 1);
            $sizes[$path] = $size;
        }

        $result = [];
        foreach ($fileLogs as $log) {
            $bytes = $sizes[$log->target] ?? -1;
            $result[] = [
                'key' => $log->key,
                'service_label' => $log->serviceLabel,
                'label' => $log->label,
                'path' => $log->target,
                'exists' => $bytes >= 0,
                'size_bytes' => max($bytes, 0),
                'size_human' => $bytes < 0 ? '-' : $this->formatBytes($bytes),
                'clearable' => $bytes > 0,
            ];
        }

        return $result;
    }

    private function formatBytes(int $bytes): string
    {
        if ($bytes <= 0) {
            return '0 B';
        }
        $units = ['B', 'KB', 'MB', 'GB'];
        $i = (int) floor(log($bytes, 1024));
        $i = min($i, count($units) - 1);
        return round($bytes / pow(1024, $i), 2) . ' ' . $units[$i];
    }
}
