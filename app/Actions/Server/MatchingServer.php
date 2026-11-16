<?php

namespace App\Actions\Server;

use App\Enums\ServerRole;
use App\Models\Server;
use App\Models\ServerProvider;
use App\Models\User;
use Illuminate\Validation\ValidationException;

class MatchingServer
{
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

    public function plan(?ServerProvider $provider, ?string $region, string $plan): ?array
    {
        return rescue(fn (): ?array => $provider?->provider()->plans($region)[$plan] ?? null, null, false);
    }

    public function check(array $requirements, ?array $plan, string $field = 'plan'): void
    {
        if (isset($plan['disk'], $requirements['storage_gb']) && $plan['disk'] < $requirements['storage_gb']) {
            throw ValidationException::withMessages([
                $field => 'This plan has '.$plan['disk'].' GB of disk, but it needs at least '.$requirements['storage_gb'].' GB.',
            ]);
        }

        if (isset($plan['architecture'], $requirements['architecture']) && $plan['architecture'] !== $requirements['architecture']) {
            throw ValidationException::withMessages([
                $field => $requirements['source'].' runs on '.$requirements['architecture'].'. PostgreSQL data files are not safe to copy to another processor architecture, so choose a '.$requirements['architecture'].' plan.',
            ]);
        }
    }

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
