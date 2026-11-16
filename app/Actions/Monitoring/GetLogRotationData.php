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

        $paths = array_map(fn (ServiceLog $log) => escapeshellarg($log->target), $fileLogs);
        $pathsStr = implode(' ', $paths);

        $script = [];
        if ($pathsStr !== '') {
            $script[] = "for f in {$pathsStr}; do if sudo test -f \"\$f\"; then sudo stat --format=\"service\t%s\t%n\" \"\$f\" 2>/dev/null || printf 'service\t0\t%s\n' \"\$f\"; else printf 'service\t-1\t%s\n' \"\$f\"; fi; done";
        }
        $script[] = "if sudo test -d /var/lib/docker/containers; then sudo find /var/lib/docker/containers -xdev -maxdepth 3 -type f \\( -name '*-json.log' -o -path '*/local-logs/container.log' \\) -printf 'docker\t%s\t%p\n' 2>/dev/null; fi";
        $script[] = "if sudo test -d /var/lib/docker/volumes; then sudo find /var/lib/docker/volumes -xdev -maxdepth 4 -type f \\( -name '*[A-Za-z]*.log' -o -name 'security' -o -name 'messages' -o -name 'full' -o -name 'queue_log' -o -name 'syslog' -o -name 'btmp' -o -name 'wtmp' -o -name 'debug' -o -path '*/cdr-csv/*.csv' -o -path '*/cel-custom/*.csv' \\) -printf 'docker\t%s\t%p\n' 2>/dev/null; fi";

        try {
            $output = $server->isReady() ? $server->ssh()->exec(implode(' ; ', $script)) : '';
        } catch (Throwable) {
            $output = '';
        }

        $sizes = [];
        $dockerLogs = [];
        foreach (preg_split('/\r\n|\r|\n/', trim($output)) as $line) {
            $line = trim($line);
            if ($line === '') {
                continue;
            }
            $parts = explode("\t", $line, 3);
            if (count($parts) !== 3) {
                continue;
            }
            [$kind, $sizeStr, $path] = $parts;
            $size = (int) $sizeStr;
            if ($kind === 'service') {
                $sizes[$path] = $size;
            } elseif ($kind === 'docker' && ScanServerCleanup::isDockerLogPath($path)) {
                $dockerLogs[$path] = $size;
            }
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

        foreach ($dockerLogs as $path => $bytes) {
            $result[] = [
                'key' => 'docker:'.$path,
                'service_label' => 'Docker',
                'label' => $this->dockerLogLabel($path),
                'path' => $path,
                'exists' => true,
                'size_bytes' => max($bytes, 0),
                'size_human' => $this->formatBytes(max($bytes, 0)),
                'clearable' => $bytes > 0,
            ];
        }

        return $result;
    }

    private function dockerLogLabel(string $path): string
    {
        if (preg_match('#^/var/lib/docker/containers/([a-f0-9]{12})[a-f0-9]{52}/(.+)$#', $path, $matches) === 1) {
            return 'Container '.$matches[1].' ('.basename($matches[2]).')';
        }

        if (preg_match('#^/var/lib/docker/volumes/([^/]+)/_data/(.+)$#', $path, $matches) === 1) {
            $volume = preg_match('/^[a-f0-9]{64}$/', $matches[1]) === 1
                ? substr($matches[1], 0, 12)
                : $matches[1];

            return 'Volume '.$volume.' ('.$matches[2].')';
        }

        return basename($path);
    }

    private function formatBytes(int $bytes): string
    {
        if ($bytes <= 0) {
            return '0 B';
        }
        $units = ['B', 'KB', 'MB', 'GB'];
        $i = (int) floor(log($bytes, 1024));
        $i = min($i, count($units) - 1);
        return round($bytes / pow(1024, $i)) . ' ' . $units[$i];
    }
}
