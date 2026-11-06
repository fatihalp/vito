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

            $pending = Cache::get('server.pending-reboot.'.$server->id);
            if ($pending) {
                $bootId = trim($server->ssh()->exec('cat /proc/sys/kernel/random/boot_id', timeout: 10));
                if (hash_equals($pending['boot_id'], $bootId)) {
                    return [
                        'online' => false,
                        'stage' => now()->timestamp - $pending['requested_at'] > 180 ? 'unconfirmed' : 'waiting',
                        'message' => 'SSH is reachable, but a new boot session has not been verified.',
                        'timestamp' => $timestamp,
                    ];
                }
                Cache::forget('server.pending-reboot.'.$server->id);
            }

            $uptime = null;
            try {
                $uptime = trim($server->ssh()->exec('uptime -p 2>/dev/null || uptime', timeout: 10));
            } catch (Throwable) {
                $uptime = null;
            }

            $server->status = ServerStatus::READY;
            $server->save();

            try {
                $required = trim($server->ssh()->exec('if [ -f /var/run/reboot-required ]; then echo 1; else echo 0; fi', timeout: 10)) === '1';
                $server->latestMetric()->update(['reboot_required' => $required]);
            } catch (Throwable) {
                report(new \RuntimeException('Could not refresh reboot-required metadata for server '.$server->id));
            }

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
}
