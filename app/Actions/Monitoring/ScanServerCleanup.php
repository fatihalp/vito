<?php

namespace App\Actions\Monitoring;

use App\Models\Server;

class ScanServerCleanup
{
    public const array CATEGORIES = [
        'rotated_logs' => [
            'label' => 'Rotated and compressed logs',
            'description' => 'Old log archives such as syslog.1 or laravel.log.gz. They are no longer written to.',
            'risk' => 'safe',
        ],
        'large_logs' => [
            'label' => 'Large active logs',
            'description' => 'Log files above 10 MB from the system, services, Laravel and workers. They are emptied in place, so services keep writing to them.',
            'risk' => 'safe',
        ],
        'docker_logs' => [
            'label' => 'Docker container and volume logs',
            'description' => 'Container logs and log files inside Docker volumes. Emptied in place so running containers keep working.',
            'risk' => 'safe',
        ],
        'journal' => [
            'label' => 'System journal',
            'description' => 'Trims the systemd journal down to 200 MB, oldest entries first.',
            'risk' => 'safe',
        ],
        'apt_cache' => [
            'label' => 'Package download cache',
            'description' => 'Downloaded .deb packages that apt keeps after installing.',
            'risk' => 'safe',
        ],
        'tool_cache' => [
            'label' => 'Composer, npm, pip and Yarn caches',
            'description' => 'Download caches that are rebuilt automatically on the next install.',
            'risk' => 'safe',
        ],
        'puppeteer_cache' => [
            'label' => 'Puppeteer browser downloads',
            'description' => 'Downloaded Chrome binaries. Apps that use Puppeteer fail until the browser is installed again.',
            'risk' => 'caution',
        ],
    ];

    private const int LARGE_LOG_BYTES = 10 * 1024 * 1024;

    private const int JOURNAL_KEEP_BYTES = 200 * 1024 * 1024;

    private const int SAMPLES = 5;

    public function handle(Server $server): array
    {
        $groups = [];
        foreach ($this->items($server) as $item) {
            $groups[$item['category']][] = $item;
        }

        $categories = [];
        foreach ($groups as $key => $items) {
            usort($items, fn (array $a, array $b): int => $b['size'] <=> $a['size']);

            $categories[] = [
                'key' => $key,
                ...self::CATEGORIES[$key],
                'size_bytes' => array_sum(array_column($items, 'size')),
                'count' => count($items),
                'command' => $this->command($key, array_column($items, 'path')),
                'samples' => array_map(
                    fn (array $item): array => ['path' => $item['path'], 'size_bytes' => $item['size']],
                    array_slice($items, 0, self::SAMPLES),
                ),
            ];
        }

        usort($categories, fn (array $a, array $b): int => $b['size_bytes'] <=> $a['size_bytes']);

        return $categories;
    }

    public function items(Server $server): array
    {
        if (! $server->isReady()) {
            return [];
        }

        $output = $server->ssh()->exec(view('ssh.os.cleanup-scan'), timeout: 120);

        $items = [];
        foreach (preg_split('/\r\n|\r|\n/', trim($output)) as $line) {
            $parts = explode("\t", $line);
            if (count($parts) !== 3 || ! ctype_digit($parts[1])) {
                continue;
            }

            [$kind, $size, $path] = $parts;
            $size = (int) $size;
            $category = $this->categorize($kind, $path, $size);

            if ($category === 'journal') {
                $size -= self::JOURNAL_KEEP_BYTES;
            }

            if ($category === null || $size <= 0) {
                continue;
            }

            $items[] = ['category' => $category, 'path' => $path, 'size' => $size];
        }

        return $items;
    }

    private function command(string $category, array $paths): string
    {
        $arguments = implode(' ', array_map('escapeshellarg', $paths));

        return match ($category) {
            'large_logs', 'docker_logs' => "sudo truncate -s 0 -- {$arguments}",
            'rotated_logs' => "sudo rm -f -- {$arguments}",
            'journal' => 'sudo journalctl --vacuum-size=200M',
            'apt_cache' => 'sudo apt-get clean',
            default => "sudo rm -rf -- {$arguments}",
        };
    }

    public static function isDockerLogPath(string $path): bool
    {
        if (preg_match('#^/[A-Za-z0-9_@.+:/ -]+$#', $path) !== 1 || str_contains($path, '..')) {
            return false;
        }

        if (preg_match('#^/var/lib/docker/containers/[a-f0-9]{64}/([a-f0-9]{64}-json\.log(\.\d+)?(\.(gz|xz|bz2|zst))?|local-logs/container\.log(\.\d+)?(\.(gz|xz|bz2|zst))?)$#', $path) === 1) {
            return true;
        }

        if (preg_match('#^/var/lib/docker/volumes/[A-Za-z0-9_.-]+/_data/(.+)$#', $path, $matches) !== 1) {
            return false;
        }

        $relativePath = $matches[1];
        if (preg_match('#^(cdr-csv|cel-custom)/[^/]+\.csv$#', $relativePath) === 1) {
            return true;
        }

        $name = basename($relativePath);

        if (preg_match('/^(security|messages|full|queue_log|syslog|btmp|wtmp|debug)(\.\d+|\.old|\.gz|\.xz|\.bz2|\.zst)*$/', $name) === 1) {
            return true;
        }

        return preg_match('/^[A-Za-z0-9_.-]*[A-Za-z][A-Za-z0-9_.-]*\.log(\.\d+|\.old|\.gz|\.xz|\.bz2|\.zst)*$/', $name) === 1;
    }

    private function categorize(string $kind, string $path, int $size): ?string
    {
        if (preg_match('#^/[A-Za-z0-9_@.+:/ -]+$#', $path) !== 1 || str_contains($path, '..')) {
            return null;
        }

        if ($kind === 'dir') {
            return match (true) {
                $path === '/var/log/journal' => 'journal',
                preg_match('#^/home/[^/]+/\.cache/puppeteer$#', $path) === 1 => 'puppeteer_cache',
                preg_match('#^/home/[^/]+/(\.cache/(composer|pip|yarn|node-gyp)|\.composer/cache|\.npm/_cacache)$#', $path) === 1 => 'tool_cache',
                default => null,
            };
        }

        if (self::isDockerLogPath($path)) {
            return 'docker_logs';
        }

        if (str_starts_with($path, '/var/cache/apt/archives/') && str_ends_with($path, '.deb')) {
            return 'apt_cache';
        }

        $inLogDirectory = (str_starts_with($path, '/var/log/') && ! str_starts_with($path, '/var/log/journal/'))
            || preg_match('#^/home/[^/]+/(?:.+/)?(?:storage/logs|\.logs)/#', $path) === 1;

        if (! $inLogDirectory) {
            return null;
        }

        $name = basename($path);

        if (preg_match('/(\.\d+|\.old|\.gz|\.xz|\.bz2|\.zst)(\.(gz|xz|bz2|zst))?$/', $name) === 1) {
            return 'rotated_logs';
        }

        if ($size >= self::LARGE_LOG_BYTES && (str_ends_with($name, '.log') || in_array($name, ['syslog', 'messages', 'btmp'], true))) {
            return 'large_logs';
        }

        return null;
    }
}
