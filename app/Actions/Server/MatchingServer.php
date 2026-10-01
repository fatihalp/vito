<?php

namespace App\Actions\Server;

use App\Enums\ServerRole;
use App\Models\Server;
use App\Models\ServerProvider;
use App\Models\User;
use Illuminate\Validation\ValidationException;

/**
 * Creates a server shaped like one that already exists: the same operating system, PostgreSQL version and processor
 * architecture, with room for its databases. Restores to a new server, replicas and version upgrades all start here.
 */
class MatchingServer
{
    /**
     * What the new server needs. Storage covers the databases plus 20% growth, WAL replay and the operating system;
     * before a database size is known, the disk the source server uses stands in for it. vCPU, memory and architecture
     * come from the source server's plan, else from its latest metrics.
     *
     * @return array{database_size: ?int, storage_gb: ?int, measured: bool, cores: ?int, memory_gb: ?float, architecture: ?string, os: string, postgresql: ?string, source: string}
     */
    public function requirements(Server $source, ?int $databaseSize = null, ?string $version = null): array
    {
        $metric = $source->latestMetric()->first();
        $basis = $databaseSize ?? ($metric !== null ? $metric->disk_used * 1048576 : null);
        $plan = $this->plan($source->serverProvider, $source->provider_data['region'] ?? null, $source->provider_data['plan'] ?? '');

        return [
            'database_size' => $databaseSize === null ? null : (int) $databaseSize,
            'storage_gb' => $basis === null ? null : (int) ceil($basis / 1073741824 * 1.2 + ($databaseSize !== null ? 12 : 5)),
            'measured' => $databaseSize !== null,
            'cores' => $plan['cores'] ?? $metric?->cpu_cores,
            'memory_gb' => $plan['memory'] ?? ($metric !== null ? round($metric->memory_total / 1048576, 1) : null),
            'architecture' => $plan['architecture'] ?? null,
            'os' => $source->os->value,
            'postgresql' => $version ?? $source->database()?->version,
            'source' => $source->name,
        ];
    }

    /**
     * The plan as the provider describes it, or null when it cannot be read.
     *
     * @return array<string, mixed>|null
     */
    public function plan(?ServerProvider $provider, ?string $region, string $plan): ?array
    {
        return rescue(fn (): ?array => $provider?->provider()->plans($region)[$plan] ?? null, null, false);
    }

    /**
     * Refuses a plan that cannot hold the databases, or that runs on another processor architecture: PostgreSQL data
     * files are only safe on the architecture they were written on.
     *
     * @param  array<string, mixed>  $requirements
     * @param  array<string, mixed>|null  $plan
     */
    public function check(array $requirements, ?array $plan, string $field = 'plan'): void
    {
        if (isset($plan['disk'], $requirements['storage_gb']) && $plan['disk'] < $requirements['storage_gb']) {
            throw ValidationException::withMessages([
                $field => __('This plan has :disk GB of disk, but it needs at least :required GB.', ['disk' => $plan['disk'], 'required' => $requirements['storage_gb']]),
            ]);
        }

        if (isset($plan['architecture'], $requirements['architecture']) && $plan['architecture'] !== $requirements['architecture']) {
            throw ValidationException::withMessages([
                $field => __(':source runs on :architecture. PostgreSQL data files are not safe to copy to another processor architecture, so choose a :architecture plan.', [
                    'source' => $requirements['source'],
                    'architecture' => $requirements['architecture'],
                ]),
            ]);
        }
    }

    /**
     * Creates the server at the provider with PostgreSQL and the monitoring agent, and nothing else.
     *
     * @param  array{name: string, server_provider: int|string, region: string, plan: string}  $validated
     * @param  array<string, mixed>  $requirements
     */
    public function create(User $user, Server $source, array $validated, array $requirements): Server
    {
        $provider = ServerProvider::query()->find($validated['server_provider']);

        return app(CreateServer::class)->create($user, $source->project, [
            'provider' => $provider?->provider,
            'server_provider' => $validated['server_provider'],
            'region' => $validated['region'],
            'plan' => $validated['plan'],
            'name' => $validated['name'],
            'os' => $requirements['os'],
            'role' => ServerRole::DATABASE->value,
            'services' => [
                ['type' => 'database', 'name' => 'postgresql', 'version' => (string) $requirements['postgresql']],
                ['type' => 'monitoring', 'name' => 'remote-monitor', 'version' => 'latest'],
            ],
        ]);
    }
}
