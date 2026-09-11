<?php

namespace App\Actions\Server;

use App\Enums\ServerStatus;
use App\Models\Server;
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

            $uptime = null;
            try {
                $uptime = trim($server->ssh()->exec('uptime -p 2>/dev/null || uptime', 'uptime'));
            } catch (Throwable) {
            }

            $server->status = ServerStatus::READY;
            $server->save();

            try {
                $server->latestMetric()->update(['reboot_required' => false]);
            } catch (Throwable) {
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
