<?php

namespace App\Actions\PostgresCluster;

use App\Actions\Service\SyncServiceStatus;
use App\Enums\ServiceStatus;
use App\Jobs\Service\ToggleNetworkingJob;
use App\Models\PostgresCluster;
use App\Models\Server;
use App\Services\SupportsNetworking;
use RuntimeException;

class SyncPostgresListenAddresses
{
    public static function privateAddress(Server $server): ?string
    {
        return PostgresCluster::forServer($server)?->address($server);
    }

    /**
     * Makes PostgreSQL on the server listen on its private cluster address. This restarts PostgreSQL once.
     * Returns false until PostgreSQL listens there.
     */
    public function ensure(Server $server): bool
    {
        $address = self::privateAddress($server);
        $service = $server->database();
        $handler = $service?->hasHandler() ? $service->handler() : null;

        if ($address === null || ! $handler instanceof SupportsNetworking) {
            throw new RuntimeException(__('PostgreSQL on :server has no private cluster address to listen on.', ['server' => $server->name]));
        }

        if ($service->status === ServiceStatus::FAILED || $handler->networkingFailed()) {
            throw new RuntimeException(__('Could not update the listen addresses of PostgreSQL on :server.', ['server' => $server->name]));
        }

        if (! in_array($service->status, SyncServiceStatus::SETTLED_STATUSES, true)) {
            return false;
        }

        $listening = collect(explode(',', $server->ssh()->clearLog()->exec($handler->networkingProbeCommand())))
            ->map(fn (string $value): string => trim($value));

        if ($listening->intersect([$address, '*', '0.0.0.0', '::'])->isNotEmpty()) {
            return true;
        }

        $previous = $service->status;
        $service->status = ServiceStatus::RESTARTING;
        $service->save();

        dispatch(new ToggleNetworkingJob($service, $handler->networkingEnabled(), $previous))->onQueue('ssh');

        return false;
    }
}
