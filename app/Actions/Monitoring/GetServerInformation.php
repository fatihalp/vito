<?php

namespace App\Actions\Monitoring;

use App\Models\Server;
use Throwable;

class GetServerInformation
{
    public function handle(Server $server): array
    {
        try {
            $script = <<<'BASH'
echo "___SECTION_CPU___"
cat /proc/cpuinfo 2>/dev/null || lscpu 2>/dev/null
echo "___SECTION_UNAME___"
uname -a
echo "___SECTION_HOSTNAME___"
hostname 2>/dev/null || cat /etc/hostname
echo "___SECTION_UPTIME___"
uptime -p 2>/dev/null || uptime
echo "___SECTION_OS___"
cat /etc/os-release 2>/dev/null || cat /etc/issue 2>/dev/null
echo "___SECTION_MEMORY___"
free -b 2>/dev/null || free -m
echo "___SECTION_DISK___"
df -hP 2>/dev/null || df -h
echo "___SECTION_END___"
BASH;

            $output = $server->ssh('root')->exec($script);
            return $this->parseOutput($output);
        } catch (Throwable $e) {
            return [
                'processors' => [],
                'total_processors' => 0,
                'system' => [
                    'hostname' => $server->ip,
                    'kernel' => '',
                    'os' => '',
                    'uptime' => '',
                    'arch' => '',
                    'raw_uname' => '',
                ],
                'memory' => [
                    'total' => '-',
                    'used' => '-',
                    'free' => '-',
                    'shared' => '-',
                    'buff_cache' => '-',
                    'available' => '-',
                    'swap_total' => '-',
                    'swap_used' => '-',
                    'swap_free' => '-',
                    'usage_percent' => 0,
                    'swap_usage_percent' => 0,
                    'raw_free' => '',
                ],
                'disks' => [],
                'raw_report' => '',
                'error' => $e->getMessage(),
            ];
        }
    }

    private function parseOutput(string $output): array
    {
        $sections = [
            'cpu' => $this->extractSection($output, '___SECTION_CPU___', '___SECTION_UNAME___'),
            'uname' => $this->extractSection($output, '___SECTION_UNAME___', '___SECTION_HOSTNAME___'),
            'hostname' => $this->extractSection($output, '___SECTION_HOSTNAME___', '___SECTION_UPTIME___'),
            'uptime' => $this->extractSection($output, '___SECTION_UPTIME___', '___SECTION_OS___'),
            'os' => $this->extractSection($output, '___SECTION_OS___', '___SECTION_MEMORY___'),
            'memory' => $this->extractSection($output, '___SECTION_MEMORY___', '___SECTION_DISK___'),
            'disk' => $this->extractSection($output, '___SECTION_DISK___', '___SECTION_END___'),
        ];

        $processors = $this->parseCpuInfo($sections['cpu']);
        $system = $this->parseSystemInfo($sections['uname'], $sections['hostname'], $sections['uptime'], $sections['os']);
        $memory = $this->parseMemoryInfo($sections['memory']);
        $disks = $this->parseDiskInfo($sections['disk']);
        $rawReport = $this->generateRawReport($processors, $system, $memory, $disks);

        return [
            'processors' => $processors,
            'total_processors' => count($processors),
            'system' => $system,
            'memory' => $memory,
            'disks' => $disks,
            'raw_report' => $rawReport,
        ];
    }

    private function extractSection(string $text, string $startMarker, string $endMarker): string
    {
        $startPos = strpos($text, $startMarker);
        if ($startPos === false) {
            return '';
        }
        $startPos += strlen($startMarker);

        $endPos = strpos($text, $endMarker, $startPos);
        if ($endPos === false) {
            return trim(substr($text, $startPos));
        }

        return trim(substr($text, $startPos, $endPos - $startPos));
    }

    private function parseCpuInfo(string $cpuText): array
    {
        if ($cpuText === '') {
            return [];
        }

        $blocks = preg_split('/\n\s*\n/', trim($cpuText));
        $processors = [];

        foreach ($blocks as $block) {
            $lines = preg_split('/\r\n|\r|\n/', trim($block));
            $props = [];

            foreach ($lines as $line) {
                if (! str_contains($line, ':')) {
                    continue;
                }
                [$key, $val] = explode(':', $line, 2);
                $props[trim($key)] = trim($val);
            }

            if (isset($props['processor'])) {
                $idx = count($processors) + 1;
                $vendor = $props['vendor_id'] ?? $props['vendor'] ?? 'Unknown';
                $name = $props['model name'] ?? $props['Model name'] ?? 'Processor';
                $speed = isset($props['cpu MHz']) ? $props['cpu MHz'] . ' MHz' : ($props['CPU max MHz'] ?? '-');
                $cache = $props['cache size'] ?? $props['L3 cache'] ?? $props['L2 cache'] ?? '-';

                $processors[] = [
                    'index' => $idx,
                    'vendor' => $vendor,
                    'name' => $name,
                    'speed' => $speed,
                    'cache' => $cache,
                ];
            }
        }

        return $processors;
    }

    private function parseSystemInfo(string $uname, string $hostname, string $uptime, string $osText): array
    {
        $osName = '';
        if (preg_match('/PRETTY_NAME="([^"]+)"/', $osText, $m)) {
            $osName = $m[1];
        } elseif ($osText !== '') {
            $osLines = explode("\n", trim($osText));
            $osName = trim($osLines[0]);
        }

        $arch = '';
        if (preg_match('/\b(x86_64|aarch64|arm64|i686|i386)\b/i', $uname, $m)) {
            $arch = $m[1];
        }

        return [
            'hostname' => trim($hostname),
            'kernel' => trim($uname),
            'os' => $osName ?: 'Linux',
            'uptime' => trim($uptime),
            'arch' => $arch ?: 'x86_64',
            'raw_uname' => trim($uname),
        ];
    }

    private function parseMemoryInfo(string $memText): array
    {
        $lines = preg_split('/\r\n|\r|\n/', trim($memText));
        $memLine = '';
        $swapLine = '';

        foreach ($lines as $line) {
            $line = trim($line);
            if (str_starts_with($line, 'Mem:')) {
                $memLine = $line;
            } elseif (str_starts_with($line, 'Swap:')) {
                $swapLine = $line;
            }
        }

        $memParts = preg_split('/\s+/', $memLine);
        $swapParts = preg_split('/\s+/', $swapLine);

        $total = isset($memParts[1]) && is_numeric($memParts[1]) ? (float) $memParts[1] : 0;
        $used = isset($memParts[2]) && is_numeric($memParts[2]) ? (float) $memParts[2] : 0;
        $free = isset($memParts[3]) && is_numeric($memParts[3]) ? (float) $memParts[3] : 0;
        $shared = isset($memParts[4]) && is_numeric($memParts[4]) ? (float) $memParts[4] : 0;
        $buffCache = isset($memParts[5]) && is_numeric($memParts[5]) ? (float) $memParts[5] : 0;
        $available = isset($memParts[6]) && is_numeric($memParts[6]) ? (float) $memParts[6] : 0;

        $swapTotal = isset($swapParts[1]) && is_numeric($swapParts[1]) ? (float) $swapParts[1] : 0;
        $swapUsed = isset($swapParts[2]) && is_numeric($swapParts[2]) ? (float) $swapParts[2] : 0;
        $swapFree = isset($swapParts[3]) && is_numeric($swapParts[3]) ? (float) $swapParts[3] : 0;

        $usagePercent = $total > 0 ? round(($used / $total) * 100, 1) : 0;
        $swapUsagePercent = $swapTotal > 0 ? round(($swapUsed / $swapTotal) * 100, 1) : 0;

        return [
            'total' => $this->formatBytes($total),
            'used' => $this->formatBytes($used),
            'free' => $this->formatBytes($free),
            'shared' => $this->formatBytes($shared),
            'buff_cache' => $this->formatBytes($buffCache),
            'available' => $this->formatBytes($available),
            'swap_total' => $this->formatBytes($swapTotal),
            'swap_used' => $this->formatBytes($swapUsed),
            'swap_free' => $this->formatBytes($swapFree),
            'total_bytes' => $total,
            'used_bytes' => $used,
            'usage_percent' => $usagePercent,
            'swap_usage_percent' => $swapUsagePercent,
            'raw_free' => trim($memText),
        ];
    }

    private function parseDiskInfo(string $diskText): array
    {
        $lines = preg_split('/\r\n|\r|\n/', trim($diskText));
        if (empty($lines)) {
            return [];
        }

        array_shift($lines);

        $disks = [];
        foreach ($lines as $line) {
            $line = trim($line);
            if ($line === '') {
                continue;
            }

            $parts = preg_split('/\s+/', $line, 6);
            if (count($parts) < 6) {
                continue;
            }

            $disks[] = [
                'filesystem' => $parts[0],
                'size' => $parts[1],
                'used' => $parts[2],
                'avail' => $parts[3],
                'use_percent' => $parts[4],
                'mounted_on' => $parts[5],
            ];
        }

        return $disks;
    }

    private function generateRawReport(array $processors, array $system, array $memory, array $disks): string
    {
        $out = "Server Information\n";
        $out .= "Processor Information\n";
        $out .= "Total processors: " . count($processors) . "\n\n";

        foreach ($processors as $p) {
            $out .= "Processor #" . $p['index'] . "\n";
            $out .= "Vendor\n" . $p['vendor'] . "\n";
            $out .= "Name\n" . $p['name'] . "\n";
            $out .= "Speed\n" . $p['speed'] . "\n";
            $out .= "Cache\n" . $p['cache'] . "\n\n";
        }

        $out .= "System Information\n";
        $out .= $system['raw_uname'] . "\n\n";

        $out .= "Memory Information / Current Memory Usage\n";
        $out .= $memory['raw_free'] . "\n\n";

        $out .= "Physical Disks / Current Disk Usage\n";
        $out .= sprintf("%-24s %-8s %-8s %-8s %-6s %s\n", "Filesystem", "Size", "Used", "Avail", "Use%", "Mounted on");
        foreach ($disks as $d) {
            $out .= sprintf("%-24s %-8s %-8s %-8s %-6s %s\n", $d['filesystem'], $d['size'], $d['used'], $d['avail'], $d['use_percent'], $d['mounted_on']);
        }

        return $out;
    }

    private function formatBytes(float $bytes): string
    {
        if ($bytes <= 0) {
            return '0 B';
        }

        $units = ['B', 'KB', 'MB', 'GB', 'TB'];
        $i = (int) floor(log($bytes, 1024));
        $i = min($i, count($units) - 1);
        $val = $bytes / pow(1024, $i);

        return round($val, 2) . ' ' . $units[$i];
    }
}
