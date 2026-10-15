<?php

namespace App\Actions\PostgresCluster;

use App\Models\PostgresCluster;
use App\Models\Server;

class SyncPostgresClusterHosts
{
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
