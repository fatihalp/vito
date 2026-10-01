<?php

namespace App\Actions\PostgresCluster;

use App\Actions\Service\SyncServiceStatus;
use App\Enums\ServiceStatus;
use App\Jobs\Service\ToggleNetworkingJob;
use App\Models\DatabaseUpgrade;
use App\Models\PostgresCluster;
use App\Models\Server;
use App\Services\SupportsNetworking;
use RuntimeException;

class SyncPostgresListenAddresses
{
    /**
     * The private addresses PostgreSQL on this server must answer on: the one of its cluster, and the one of a version
     * upgrade it takes part in. A server can have both, on different networks, and must listen on each — leaving the
     * upgrade out made the new server unable to reach it, with nothing to see but a step that never finished.
     *
     * @return list<string>
     */
    public static function privateAddresses(Server $server): array
    {
        return collect([
            PostgresCluster::forServer($server)?->address($server),
            DatabaseUpgrade::forServer($server)?->address($server),
        ])->filter()->unique()->values()->all();
    }

    public static function privateAddress(Server $server): ?string
    {
        return self::privateAddresses($server)[0] ?? null;
    }

    /**
     * Makes PostgreSQL on the server listen on the given private address, or on its private cluster address.
     * This restarts PostgreSQL once. Returns false until PostgreSQL listens there.
     */
    public function ensure(Server $server, ?string $address = null): bool
    {
        $address ??= self::privateAddress($server);
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
