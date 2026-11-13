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
    private static array $liveTypesCache = [];

    private static array $projectCostCache = [];

    private const CATALOG = [
        'cx11' => ['cores' => 1, 'memory' => 2],
        'cx21' => ['cores' => 2, 'memory' => 4],
        'cx22' => ['cores' => 2, 'memory' => 4],
        'cx23' => ['cores' => 2, 'memory' => 4],
        'cx31' => ['cores' => 2, 'memory' => 8],
        'cx32' => ['cores' => 4, 'memory' => 8],
        'cx33' => ['cores' => 4, 'memory' => 8],
        'cx41' => ['cores' => 4, 'memory' => 16],
        'cx42' => ['cores' => 8, 'memory' => 16],
        'cx43' => ['cores' => 8, 'memory' => 16],
        'cx51' => ['cores' => 8, 'memory' => 32],
        'cx52' => ['cores' => 16, 'memory' => 32],
        'cx53' => ['cores' => 16, 'memory' => 32],
        'cpx11' => ['cores' => 2, 'memory' => 2],
        'cpx12' => ['cores' => 2, 'memory' => 2],
        'cpx21' => ['cores' => 3, 'memory' => 4],
        'cpx22' => ['cores' => 3, 'memory' => 4],
        'cpx31' => ['cores' => 4, 'memory' => 8],
        'cpx32' => ['cores' => 4, 'memory' => 8],
        'cpx41' => ['cores' => 8, 'memory' => 16],
        'cpx42' => ['cores' => 8, 'memory' => 16],
        'cpx51' => ['cores' => 16, 'memory' => 32],
        'cpx52' => ['cores' => 16, 'memory' => 32],
        'cax11' => ['cores' => 2, 'memory' => 4],
        'cax21' => ['cores' => 4, 'memory' => 8],
        'cax31' => ['cores' => 8, 'memory' => 16],
        'cax41' => ['cores' => 16, 'memory' => 32],
        'ccx13' => ['cores' => 2, 'memory' => 8],
        'ccx23' => ['cores' => 4, 'memory' => 16],
        'ccx33' => ['cores' => 8, 'memory' => 32],
        'ccx43' => ['cores' => 16, 'memory' => 64],
        'ccx53' => ['cores' => 32, 'memory' => 128],
        'ccx63' => ['cores' => 48, 'memory' => 192],
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

        if (array_key_exists($project->id, self::$projectCostCache)) {
            return self::$projectCostCache[$project->id];
        }

        $total = 0.0;
        $known = 0;

        foreach ($project->servers as $server) {
            $cost = $this->resolveCost($server);
            if ($cost !== null) {
                $total += $cost['amount'];
                $known++;
            }
        }

        if ($known === 0) {
            return self::$projectCostCache[$project->id] = null;
        }

        $total = round($total, 2);

        return self::$projectCostCache[$project->id] = [
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
        if ($region === null || $region === '') {
            return null;
        }

        return $this->fetchLiveServerTypes($serverProvider)[$plan]['prices'][$region] ?? null;
    }

    private function fetchLiveServerTypes(?ServerProvider $serverProvider): array
    {
        if (! $serverProvider || $serverProvider->provider !== Hetzner::id()) {
            return [];
        }

        if (isset(self::$liveTypesCache[$serverProvider->id])) {
            return self::$liveTypesCache[$serverProvider->id];
        }

        $cacheKey = 'hetzner_server_types_'.$serverProvider->id;

        $cached = Cache::get($cacheKey);
        if (is_array($cached) && $cached !== []) {
            return self::$liveTypesCache[$serverProvider->id] = $cached;
        }

        try {
            $token = $serverProvider->getCredentials()['token'] ?? null;
            if (! is_string($token) || $token === '') {
                return self::$liveTypesCache[$serverProvider->id] = [];
            }

            $mapped = [];
            $page = 1;
            $deadline = microtime(true) + 8;
            do {
                $remaining = $deadline - microtime(true);
                if ($remaining <= 0 || $page > 10) {
                    return self::$liveTypesCache[$serverProvider->id] = [];
                }
                $response = Http::connectTimeout(min(2, $remaining))->timeout(min(4, $remaining))
                    ->withToken($token)
                    ->get('https://api.hetzner.cloud/v1/server_types', ['per_page' => 50, 'page' => $page]);

                if (! $response->successful()) {
                    return self::$liveTypesCache[$serverProvider->id] = [];
                }

                foreach ($response->json('server_types') ?? [] as $type) {
                    $name = strtolower((string) ($type['name'] ?? ''));
                    if ($name === '') {
                        continue;
                    }
                    $prices = [];
                    foreach ($type['prices'] ?? [] as $priceRow) {
                        $location = strtolower((string) ($priceRow['location'] ?? ''));
                        $net = $priceRow['price_monthly']['net'] ?? null;
                        if ($location !== '' && is_numeric($net) && is_finite((float) $net) && (float) $net >= 0) {
                            $prices[$location] = round((float) $net, 2);
                        }
                    }
                    $mapped[$name] = ['cores' => (int) ($type['cores'] ?? 0), 'prices' => $prices];
                }

                $next = $response->json('meta.pagination.next_page');
                if ($next !== null && (! is_int($next) || $next <= $page)) {
                    return self::$liveTypesCache[$serverProvider->id] = [];
                }
                $page = $next;
            } while ($page !== null);

            if ($mapped !== []) {
                Cache::put($cacheKey, $mapped, now()->addHours(12));
            }

            return self::$liveTypesCache[$serverProvider->id] = $mapped;
        } catch (Throwable) {
            return self::$liveTypesCache[$serverProvider->id] = [];
        }
    }
}
