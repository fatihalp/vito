<?php

namespace App\Actions\Server;

use App\Models\Project;
use App\Models\Server;
use App\Models\ServerProvider;
use App\ServerProviders\Hetzner;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Throwable;

class ResolveHetznerServerSpecs
{
    /**
     * @var array<string, array{cores: int, memory: int, prices: array{eu: float, us: float, sin: float}}>
     */
    private const CATALOG = [
        'cx11' => ['cores' => 1, 'memory' => 2, 'prices' => ['eu' => 3.29, 'us' => 3.79, 'sin' => 5.49]],
        'cx21' => ['cores' => 2, 'memory' => 4, 'prices' => ['eu' => 4.85, 'us' => 5.59, 'sin' => 7.99]],
        'cx22' => ['cores' => 2, 'memory' => 4, 'prices' => ['eu' => 3.79, 'us' => 4.49, 'sin' => 5.99]],
        'cx23' => ['cores' => 2, 'memory' => 4, 'prices' => ['eu' => 3.49, 'us' => 4.49, 'sin' => 5.99]],
        'cx31' => ['cores' => 2, 'memory' => 8, 'prices' => ['eu' => 9.55, 'us' => 10.99, 'sin' => 15.49]],
        'cx32' => ['cores' => 4, 'memory' => 8, 'prices' => ['eu' => 6.80, 'us' => 8.49, 'sin' => 11.49]],
        'cx33' => ['cores' => 4, 'memory' => 8, 'prices' => ['eu' => 5.49, 'us' => 8.49, 'sin' => 11.49]],
        'cx41' => ['cores' => 4, 'memory' => 16, 'prices' => ['eu' => 17.45, 'us' => 19.99, 'sin' => 28.49]],
        'cx42' => ['cores' => 8, 'memory' => 16, 'prices' => ['eu' => 16.40, 'us' => 18.99, 'sin' => 25.99]],
        'cx43' => ['cores' => 8, 'memory' => 16, 'prices' => ['eu' => 9.49, 'us' => 18.99, 'sin' => 25.99]],
        'cx51' => ['cores' => 8, 'memory' => 32, 'prices' => ['eu' => 32.45, 'us' => 37.49, 'sin' => 52.49]],
        'cx52' => ['cores' => 16, 'memory' => 32, 'prices' => ['eu' => 32.40, 'us' => 36.99, 'sin' => 50.99]],
        'cx53' => ['cores' => 16, 'memory' => 32, 'prices' => ['eu' => 17.49, 'us' => 36.99, 'sin' => 50.99]],
        'cpx11' => ['cores' => 2, 'memory' => 2, 'prices' => ['eu' => 3.85, 'us' => 4.49, 'sin' => 5.99]],
        'cpx12' => ['cores' => 2, 'memory' => 2, 'prices' => ['eu' => 3.85, 'us' => 4.49, 'sin' => 5.99]],
        'cpx21' => ['cores' => 3, 'memory' => 4, 'prices' => ['eu' => 7.05, 'us' => 8.49, 'sin' => 11.49]],
        'cpx22' => ['cores' => 3, 'memory' => 4, 'prices' => ['eu' => 7.05, 'us' => 8.49, 'sin' => 11.49]],
        'cpx31' => ['cores' => 4, 'memory' => 8, 'prices' => ['eu' => 13.10, 'us' => 15.49, 'sin' => 21.49]],
        'cpx32' => ['cores' => 4, 'memory' => 8, 'prices' => ['eu' => 13.10, 'us' => 15.49, 'sin' => 21.49]],
        'cpx41' => ['cores' => 8, 'memory' => 16, 'prices' => ['eu' => 24.70, 'us' => 28.99, 'sin' => 40.49]],
        'cpx42' => ['cores' => 8, 'memory' => 16, 'prices' => ['eu' => 24.70, 'us' => 28.99, 'sin' => 40.49]],
        'cpx51' => ['cores' => 16, 'memory' => 32, 'prices' => ['eu' => 54.40, 'us' => 61.99, 'sin' => 86.49]],
        'cpx52' => ['cores' => 16, 'memory' => 32, 'prices' => ['eu' => 54.40, 'us' => 61.99, 'sin' => 86.49]],
        'cax11' => ['cores' => 2, 'memory' => 4, 'prices' => ['eu' => 3.29, 'us' => 3.79, 'sin' => 5.49]],
        'cax21' => ['cores' => 4, 'memory' => 8, 'prices' => ['eu' => 5.99, 'us' => 6.99, 'sin' => 9.99]],
        'cax31' => ['cores' => 8, 'memory' => 16, 'prices' => ['eu' => 11.99, 'us' => 13.99, 'sin' => 19.99]],
        'cax41' => ['cores' => 16, 'memory' => 32, 'prices' => ['eu' => 23.99, 'us' => 27.99, 'sin' => 39.99]],
        'ccx13' => ['cores' => 2, 'memory' => 8, 'prices' => ['eu' => 11.99, 'us' => 13.99, 'sin' => 19.99]],
        'ccx23' => ['cores' => 4, 'memory' => 16, 'prices' => ['eu' => 23.99, 'us' => 27.99, 'sin' => 39.99]],
        'ccx33' => ['cores' => 8, 'memory' => 32, 'prices' => ['eu' => 47.99, 'us' => 54.99, 'sin' => 79.99]],
        'ccx43' => ['cores' => 16, 'memory' => 64, 'prices' => ['eu' => 95.99, 'us' => 109.99, 'sin' => 159.99]],
        'ccx53' => ['cores' => 32, 'memory' => 128, 'prices' => ['eu' => 191.99, 'us' => 219.99, 'sin' => 319.99]],
        'ccx63' => ['cores' => 48, 'memory' => 192, 'prices' => ['eu' => 287.99, 'us' => 329.99, 'sin' => 479.99]],
    ];

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

        $liveTypes = $this->fetchLiveServerTypes($server->serverProvider);
        if (isset($liveTypes[$plan]['cores'])) {
            return (int) $liveTypes[$plan]['cores'];
        }

        return self::CATALOG[$plan]['cores'] ?? null;
    }

    /**
     * @return array{amount: float, currency: string, formatted: string, plan: string, region: string|null}|null
     */
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

    /**
     * @return array{amount: float, currency: string, formatted: string}|null
     */
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

    public function projectCostOrderSql(): string
    {
        $servers = Server::query()
            ->where('provider', Hetzner::id())
            ->with('serverProvider')
            ->get(['id', 'project_id', 'provider', 'provider_id', 'provider_data']);

        $totals = [];
        foreach ($servers as $server) {
            $cost = $this->resolveCost($server);
            if ($cost !== null && $server->project_id !== null) {
                $totals[$server->project_id] = round(($totals[$server->project_id] ?? 0.0) + $cost['amount'], 2);
            }
        }

        if ($totals === []) {
            return '0';
        }

        $cases = [];
        foreach ($totals as $projectId => $amount) {
            if ($amount > 0) {
                $cases[] = sprintf('WHEN %d THEN %s', (int) $projectId, number_format($amount, 2, '.', ''));
            }
        }

        if ($cases === []) {
            return '0';
        }

        return 'CASE projects.id '.implode(' ', $cases).' ELSE 0 END';
    }

    public function serverCostOrderSql(): string
    {
        $servers = Server::query()
            ->where('provider', Hetzner::id())
            ->with('serverProvider')
            ->get(['id', 'project_id', 'provider', 'provider_id', 'provider_data']);

        $cases = [];
        foreach ($servers as $server) {
            $cost = $this->resolveCost($server);
            if ($cost !== null && $cost['amount'] > 0) {
                $cases[] = sprintf('WHEN %d THEN %s', (int) $server->id, number_format($cost['amount'], 2, '.', ''));
            }
        }

        if ($cases === []) {
            return '0';
        }

        return 'CASE servers.id '.implode(' ', $cases).' ELSE 0 END';
    }

    private function resolvePlanPrice(?ServerProvider $serverProvider, string $plan, ?string $region): ?float
    {
        $liveTypes = $this->fetchLiveServerTypes($serverProvider);

        if (isset($liveTypes[$plan])) {
            $prices = $liveTypes[$plan]['prices'] ?? [];
            if ($region !== null && isset($prices[$region])) {
                return (float) $prices[$region];
            }
            if ($prices !== []) {
                return (float) reset($prices);
            }
        }

        if (! isset(self::CATALOG[$plan])) {
            return null;
        }

        $zone = match ($region) {
            'ash', 'hil' => 'us',
            'sin' => 'sin',
            default => 'eu',
        };

        return self::CATALOG[$plan]['prices'][$zone] ?? self::CATALOG[$plan]['prices']['eu'];
    }

    /**
     * @return array<string, array{cores: int, prices: array<string, float>}>
     */
    private function fetchLiveServerTypes(?ServerProvider $serverProvider): array
    {
        if (! $serverProvider || $serverProvider->provider !== Hetzner::id()) {
            return [];
        }

        $cacheKey = 'hetzner_server_types_'.$serverProvider->id;

        return Cache::remember($cacheKey, now()->addHours(12), function () use ($serverProvider): array {
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

                $types = $response->json('server_types') ?? [];
                $mapped = [];

                foreach ($types as $type) {
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
        });
    }
}
