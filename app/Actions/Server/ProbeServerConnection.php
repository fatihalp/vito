<?php

namespace App\Actions\Server;

use App\Enums\ServerStatus;
use App\Models\Server;
use Illuminate\Support\Facades\Cache;
use Throwable;

class ProbeServerConnection
{
    public function probe(Server $server): array
    {
        $timestamp = now()->toTimeString();
        $ip = $server->ip;
        $port = $server->port ?: 22;

        $fp = @fsockopen($ip, $port, $errno, $errstr, 2);

        if (! $fp) {
            return [
                'online' => false,
                'stage' => 'offline',
                'message' => "Port {$port} unreachable. Server is rebooting...",
                'timestamp' => $timestamp,
            ];
        }

        fclose($fp);

        try {
            $server->ssh()->connect();

            $unverifiedReboot = $this->unverifiedReboot($server, $timestamp);
            if ($unverifiedReboot) {
                return $unverifiedReboot;
            }

            $uptime = null;
            try {
                $uptime = trim($server->ssh()->exec('uptime -p 2>/dev/null || uptime', timeout: 10));
            } catch (Throwable) {
            }

            if ($server->status === ServerStatus::DISCONNECTED) {
                $server->status = ServerStatus::READY;
                $server->save();
            }

            $this->refreshRebootRequired($server);

            app(BroadcastServerUpdate::class)->broadcast($server);

            return [
                'online' => true,
                'stage' => 'ready',
                'uptime' => $uptime,
                'message' => 'SSH connection established! Server is back online and ready.',
                'timestamp' => $timestamp,
            ];
        } catch (Throwable $e) {
            return [
                'online' => false,
                'stage' => 'starting',
                'message' => "Port {$port} open, SSH daemon initializing...",
                'timestamp' => $timestamp,
            ];
        }
    }

    private function unverifiedReboot(Server $server, string $timestamp): ?array
    {
        $cacheKey = 'server.pending-reboot.'.$server->id;
        $pending = Cache::get($cacheKey);

        if (! $pending) {
            return null;
        }

        $bootId = trim($server->ssh()->exec('cat /proc/sys/kernel/random/boot_id', timeout: 10));

        if (! hash_equals($pending['boot_id'], $bootId)) {
            Cache::forget($cacheKey);

            return null;
        }

        $waitedTooLong = now()->timestamp - $pending['requested_at'] > 180;

        return [
            'online' => false,
            'stage' => $waitedTooLong ? 'unconfirmed' : 'waiting',
            'message' => 'SSH is reachable, but a new boot session has not been verified.',
            'timestamp' => $timestamp,
        ];
    }

    private function refreshRebootRequired(Server $server): void
    {
        $command = 'if [ -f /var/run/reboot-required ]; then echo 1; else echo 0; fi';

        try {
            $required = trim($server->ssh()->exec($command, timeout: 10)) === '1';
            $server->latestMetric()->update(['reboot_required' => $required]);
        } catch (Throwable) {
            report(new \RuntimeException('Could not refresh reboot-required metadata for server '.$server->id));
        }
    }
}
