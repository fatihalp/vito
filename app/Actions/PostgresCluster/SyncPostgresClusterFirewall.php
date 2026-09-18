<?php

namespace App\Actions\PostgresCluster;

use App\Actions\FirewallRule\ManageRule;
use App\Enums\FirewallRuleStatus;
use App\Models\DatabaseReplica;
use App\Models\FirewallRule;
use App\Models\PostgresCluster;
use App\SSH\PgBackRest;
use RuntimeException;

class SyncPostgresClusterFirewall
{
    /**
     * @var array<int, string>
     */
    private const PORTS = [5432 => 'postgres-replica', PgBackRest::TLS_PORT => 'pgbackrest-tls'];

    /**
     * Allows PostgreSQL and the pgBackRest TLS server on the primary only from each replica's private address,
     * and removes rules this cluster created that no longer apply. Returns false until all rules are applied.
     */
    public function sync(PostgresCluster $cluster): bool
    {
        $primary = $cluster->primary;
        $desired = [];

        if ($primary->firewall()) {
            $cluster->streamingReplicas()->each(function (DatabaseReplica $replica) use ($cluster, $primary, &$desired): void {
                $address = $cluster->address($replica->replica);

                if ($address === null) {
                    return;
                }

                foreach (self::PORTS as $port => $name) {
                    $desired[$this->note($cluster, $replica->replica_server_id, $port)] = [
                        'server' => $primary,
                        'input' => [
                            'name' => $name,
                            'type' => 'allow',
                            'protocol' => 'tcp',
                            'port' => (string) $port,
                            'source_any' => false,
                            'source' => $address,
                            'mask' => str_contains($address, ':') ? 128 : 32,
                        ],
                    ];
                }
            });
        }

        $existing = FirewallRule::query()
            ->where('note', 'like', 'vito-pg:'.$cluster->id.':%')
            ->where('status', '!=', FirewallRuleStatus::DELETING)
            ->get();

        foreach ($existing as $rule) {
            $wanted = $desired[$rule->note] ?? null;

            if ($wanted === null || $rule->server_id !== $wanted['server']->id || $rule->source !== $wanted['input']['source']) {
                app(ManageRule::class)->delete($rule);

                continue;
            }

            unset($desired[$rule->note]);
        }

        foreach ($desired as $note => $wanted) {
            $rule = app(ManageRule::class)->create($wanted['server'], $wanted['input']);
            $rule->update(['note' => $note]);
        }

        $rules = FirewallRule::query()->where('note', 'like', 'vito-pg:'.$cluster->id.':%')->get();

        if ($rules->contains(fn (FirewallRule $rule): bool => $rule->status === FirewallRuleStatus::FAILED)) {
            throw new RuntimeException(__('Applying the PostgreSQL replication firewall rules on :server failed.', ['server' => $primary->name]));
        }

        return $rules->every(fn (FirewallRule $rule): bool => $rule->status === FirewallRuleStatus::READY);
    }

    private function note(PostgresCluster $cluster, int $serverId, int $port): string
    {
        return 'vito-pg:'.$cluster->id.':'.$serverId.':'.$port;
    }
}
