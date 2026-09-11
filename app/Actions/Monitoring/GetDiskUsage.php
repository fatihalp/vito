<?php

namespace App\Actions\Monitoring;

use App\Models\Server;
use Throwable;

class GetDiskUsage
{
    public function handle(Server $server, string $path = '/', int $limit = 10): array
    {
        $normalizedPath = $this->sanitizePath($path);
        $limit = max(5, min(100, $limit));
        $breadcrumbs = $this->buildBreadcrumbs($normalizedPath);
        $parentPath = $this->resolveParentPath($normalizedPath);

        if (! $server->isReady()) {
            return [
                'folders' => [],
                'files' => [],
                'path' => $normalizedPath,
                'parent_path' => $parentPath,
                'breadcrumbs' => $breadcrumbs,
                'target_size' => null,
                'target_size_bytes' => 0,
                'error' => 'Disk usage analysis is unavailable while the server is offline. Reconnect the server to refresh live data.',
            ];
        }

        try {
            $escapedPath = escapeshellarg($normalizedPath);
            $folderLimit = $limit + 1;

            $command = sprintf(
                'echo "===FOLDERS===" && sudo du -xhd 1 %s 2>/dev/null | sort -rh | head -n %d && echo "===FILES===" && sudo find %s -xdev -type f -exec du -h {} + 2>/dev/null | sort -rh | head -n %d',
                $escapedPath,
                $folderLimit,
                $escapedPath,
                $limit
            );

            $output = $server->ssh()->exec($command);

            return $this->parseOutput($output, $normalizedPath, $parentPath, $breadcrumbs, $limit);
        } catch (Throwable $e) {
            return [
                'folders' => [],
                'files' => [],
                'path' => $normalizedPath,
                'parent_path' => $parentPath,
                'breadcrumbs' => $breadcrumbs,
                'target_size' => null,
                'target_size_bytes' => 0,
                'error' => $e->getMessage(),
            ];
        }
    }

    public function sanitizePath(string $path): string
    {
        $path = trim($path);

        if ($path === '' || ! str_starts_with($path, '/') || preg_match('/[;&|`$\n\r]/', $path)) {
            return '/';
        }

        $segments = [];
        foreach (explode('/', $path) as $part) {
            if ($part === '' || $part === '.') {
                continue;
            }
            if ($part === '..') {
                array_pop($segments);
            } else {
                $segments[] = $part;
            }
        }

        return empty($segments) ? '/' : '/' . implode('/', $segments);
    }

    public function resolveParentPath(string $path): ?string
    {
        if ($path === '/') {
            return null;
        }

        $parent = dirname($path);

        return $parent === '.' ? '/' : $parent;
    }

    public function buildBreadcrumbs(string $path): array
    {
        $parts = array_values(array_filter(explode('/', $path)));
        $breadcrumbs = [['name' => '/', 'path' => '/']];
        $current = '';

        foreach ($parts as $p) {
            $current .= '/' . $p;
            $breadcrumbs[] = [
                'name' => $p,
                'path' => $current,
            ];
        }

        return $breadcrumbs;
    }

    public function parseHumanToBytes(string $human): int
    {
        $human = trim($human);
        if ($human === '') {
            return 0;
        }

        $unit = strtoupper(substr($human, -1));
        $numStr = substr($human, 0, -1);

        if (! is_numeric($numStr)) {
            return is_numeric($human) ? (int) $human : 0;
        }

        $val = (float) $numStr;

        return match ($unit) {
            'T' => (int) ($val * 1024 * 1024 * 1024 * 1024),
            'G' => (int) ($val * 1024 * 1024 * 1024),
            'M' => (int) ($val * 1024 * 1024),
            'K' => (int) ($val * 1024),
            default => (int) $human,
        };
    }

    private function parseOutput(
        string $output,
        string $scannedPath,
        ?string $parentPath,
        array $breadcrumbs,
        int $limit
    ): array {
        $foldersSection = '';
        $filesSection = '';

        if (str_contains($output, '===FOLDERS===') && str_contains($output, '===FILES===')) {
            $parts = explode('===FILES===', $output);
            $foldersPart = $parts[0] ?? '';
            $filesSection = $parts[1] ?? '';

            $folderParts = explode('===FOLDERS===', $foldersPart);
            $foldersSection = $folderParts[1] ?? '';
        }

        $targetSize = null;
        $targetSizeBytes = 0;
        $rawFolders = [];

        foreach (preg_split('/\r\n|\r|\n/', trim($foldersSection)) as $line) {
            $line = trim($line);
            if ($line === '') {
                continue;
            }

            $parts = preg_split('/\s+/', $line, 2);
            if (count($parts) < 2) {
                continue;
            }

            $size = $parts[0];
            $folderPath = $parts[1];
            $isTarget = ($folderPath === $scannedPath) || (rtrim($folderPath, '/') === rtrim($scannedPath, '/'));

            if ($isTarget && $targetSize === null) {
                $targetSize = $size;
                $targetSizeBytes = $this->parseHumanToBytes($size);
                continue;
            }

            $sizeBytes = $this->parseHumanToBytes($size);
            $name = basename($folderPath);

            $rawFolders[] = [
                'size' => $size,
                'size_bytes' => $sizeBytes,
                'path' => $folderPath,
                'name' => $name !== '' ? $name : $folderPath,
            ];
        }

        $folders = [];
        $slicedFolders = array_slice($rawFolders, 0, $limit);
        $baseFolderBytes = $targetSizeBytes > 0
            ? $targetSizeBytes
            : (! empty($rawFolders) ? max(array_column($rawFolders, 'size_bytes')) : 0);

        foreach ($slicedFolders as $f) {
            $percentage = $baseFolderBytes > 0
                ? min(100.0, round(($f['size_bytes'] / $baseFolderBytes) * 100, 1))
                : 0.0;

            $folders[] = [
                ...$f,
                'percentage' => $percentage,
            ];
        }

        $files = [];
        $rawFiles = [];

        foreach (preg_split('/\r\n|\r|\n/', trim($filesSection)) as $line) {
            $line = trim($line);
            if ($line === '') {
                continue;
            }

            $parts = preg_split('/\s+/', $line, 2);
            if (count($parts) < 2) {
                continue;
            }

            $size = $parts[0];
            $filePath = $parts[1];
            $sizeBytes = $this->parseHumanToBytes($size);

            $relativePath = ltrim(substr($filePath, strlen(rtrim($scannedPath, '/'))), '/');
            $relativeDir = dirname($relativePath);
            if ($relativeDir === '.') {
                $relativeDir = '';
            }

            $rawFiles[] = [
                'size' => $size,
                'size_bytes' => $sizeBytes,
                'path' => $filePath,
                'name' => basename($filePath),
                'relative_path' => $relativePath,
                'relative_dir' => $relativeDir,
            ];
        }

        $slicedFiles = array_slice($rawFiles, 0, $limit);
        $baseFileBytes = $targetSizeBytes > 0
            ? $targetSizeBytes
            : (! empty($rawFiles) ? max(array_column($rawFiles, 'size_bytes')) : 0);

        foreach ($slicedFiles as $f) {
            $percentage = $baseFileBytes > 0
                ? min(100.0, round(($f['size_bytes'] / $baseFileBytes) * 100, 1))
                : 0.0;

            $files[] = [
                ...$f,
                'percentage' => $percentage,
            ];
        }

        return [
            'folders' => $folders,
            'files' => $files,
            'path' => $scannedPath,
            'parent_path' => $parentPath,
            'breadcrumbs' => $breadcrumbs,
            'target_size' => $targetSize,
            'target_size_bytes' => $targetSizeBytes,
            'error' => null,
        ];
    }
}
