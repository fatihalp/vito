<?php

namespace App\Actions\Server;

use App\Models\Project;
use App\Models\Server;
use App\Models\ServerProvider;
use App\ServerProviders\Hetzner;
use DateTimeInterface;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Throwable;

class ResolveHetznerServerSpecs
{
    public function resolveCores(Server $server): ?int
    {
        $metricCores = $server->getAttribute('cpu_cores') ?? $server->latestMetric?->cpu_cores;

        if (is_numeric($metricCores) && (int) $metricCores > 0) {
            return (int) $metricCores;
        }

        if ($server->provider !== Hetzner::id()) {
            return null;
        }

        $plan = strtolower((string) ($server->provider_data['plan'] ?? ''));

        if ($plan === '') {
            return null;
        }

        $cores = $this->fetchLiveServerTypes($server->serverProvider)[$plan]['cores'] ?? null;

        return $cores === null ? null : (int) $cores;
    }

    public function resolveCost(Server $server): ?array
    {
        if ($server->provider !== Hetzner::id()) {
            return null;
        }

        $plan = strtolower((string) ($server->provider_data['plan'] ?? ''));
        $region = isset($server->provider_data['region']) ? strtolower((string) $server->provider_data['region']) : null;

        if ($plan === '') {
            return null;
        }

        $amount = $this->resolvePlanPrice($server->serverProvider, $plan, $region);

        if ($amount === null) {
            return null;
        }

        return [
            'amount' => $amount,
            'currency' => 'EUR',
            'formatted' => '€'.number_format($amount, 2).'/mo',
            'plan' => strtoupper($plan),
            'region' => $region,
        ];
    }

    public function resolveProjectCost(Project $project): ?array
    {
        if (! $project->relationLoaded('servers')) {
            return null;
        }

        $total = 0.0;

        foreach ($project->servers as $server) {
            $cost = $this->resolveCost($server);
            if ($cost !== null) {
                $total += $cost['amount'];
            }
        }

        $total = round($total, 2);

        return [
            'amount' => $total,
            'currency' => 'EUR',
            'formatted' => '€'.number_format($total, 2).'/mo',
        ];
    }

    public function projectCostOrderSql(Builder $servers): string
    {
        $totals = [];

        foreach ($this->costs($servers) as $cost) {
            $totals[$cost['project_id']] = round(($totals[$cost['project_id']] ?? 0.0) + $cost['amount'], 2);
        }

        return $this->caseSql('projects.id', $totals);
    }

    public function serverCostOrderSql(Builder $servers): string
    {
        return $this->caseSql('servers.id', array_column($this->costs($servers), 'amount', 'server_id'));
    }

    private function costs(Builder $servers): array
    {
        return $servers
            ->where('provider', Hetzner::id())
            ->with('serverProvider')
            ->get(['id', 'project_id', 'provider', 'provider_id', 'provider_data'])
            ->map(fn (Server $server): array => [
                'server_id' => $server->id,
                'project_id' => $server->project_id,
                'amount' => $this->resolveCost($server)['amount'] ?? 0.0,
            ])
            ->filter(fn (array $cost): bool => $cost['amount'] > 0)
            ->all();
    }

    private function caseSql(string $column, array $amounts): string
    {
        if ($amounts === []) {
            return '0';
        }

        $cases = [];
        foreach ($amounts as $id => $amount) {
            $cases[] = sprintf('WHEN %d THEN %s', (int) $id, number_format($amount, 2, '.', ''));
        }

        return 'CASE '.$column.' '.implode(' ', $cases).' ELSE 0 END';
    }

    private function resolvePlanPrice(?ServerProvider $serverProvider, string $plan, ?string $region): ?float
    {
        $prices = $this->fetchLiveServerTypes($serverProvider)[$plan]['prices'] ?? [];
        $price = $prices[(string) $region] ?? reset($prices);

        return $price === false ? null : (float) $price;
    }

    private function fetchLiveServerTypes(?ServerProvider $serverProvider): array
    {
        if (! $serverProvider || $serverProvider->provider !== Hetzner::id()) {
            return [];
        }

        return Cache::memo()->remember(
            'hetzner_server_types_'.$serverProvider->id,
            fn (array $types): DateTimeInterface => $types === [] ? now()->addMinute() : now()->addHours(12),
            fn (): array => $this->requestServerTypes($serverProvider),
        );
    }

    private function requestServerTypes(ServerProvider $serverProvider): array
    {
        try {
            $token = $serverProvider->getCredentials()['token'] ?? null;
            if (! is_string($token) || $token === '') {
                return [];
            }

            $response = Http::timeout(4)
                ->withToken($token)
                ->get('https://api.hetzner.cloud/v1/server_types', ['per_page' => 50]);

            if (! $response->successful()) {
                return [];
            }

            $mapped = [];

            foreach ($response->json('server_types') ?? [] as $type) {
                $name = strtolower((string) ($type['name'] ?? ''));
                if ($name === '') {
                    continue;
                }

                $prices = [];
                foreach ($type['prices'] ?? [] as $priceRow) {
                    $loc = strtolower((string) ($priceRow['location'] ?? ''));
                    $net = $priceRow['price_monthly']['net'] ?? null;
                    if ($loc !== '' && is_numeric($net)) {
                        $prices[$loc] = round((float) $net, 2);
                    }
                }

                $mapped[$name] = [
                    'cores' => (int) ($type['cores'] ?? 0),
                    'prices' => $prices,
                ];
            }

            return $mapped;
        } catch (Throwable) {
            return [];
        }
    }
}
