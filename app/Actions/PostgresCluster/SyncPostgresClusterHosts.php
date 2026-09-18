<?php

namespace App\Actions\PostgresCluster;

use App\Models\PostgresCluster;
use App\Models\Server;

class SyncPostgresClusterHosts
{
    /**
     * Writes a vito-pg-<server id> alias for every cluster node into /etc/hosts on each node, so pgBackRest TLS
     * certificates can be checked by name, and lets services bind the private address before the tunnel is up.
     */
    public function sync(PostgresCluster $cluster): void
    {
        $nodes = $cluster->nodes();

        $hosts = $nodes
            ->mapWithKeys(fn (Server $server): array => [PostgresCluster::hostAlias($server) => $cluster->address($server)])
            ->filter(fn (?string $address): bool => filter_var($address, FILTER_VALIDATE_IP) !== false)
            ->all();

        foreach ($nodes as $server) {
            $server->ssh()->exec(view('ssh.postgres-cluster.hosts', ['hosts' => $hosts]), 'postgres-cluster-hosts');
        }
    }
}
