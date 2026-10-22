<?php

namespace App\Actions\Server;

use App\Actions\Service\ProbeServices;
use App\Actions\Service\SyncServiceStatus;
use App\Jobs\Server\CheckPhpVersionsJob;
use App\Models\Server;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use RuntimeException;
use Throwable;

class CheckPhpVersions
{
    public function filter(Builder $query, array $input): Builder
    {
        $validated = Validator::make($input, ['php_status' => ['nullable', 'in:all,outdated']])->validate();

        if (($validated['php_status'] ?? 'all') !== 'outdated') {
            return $query;
        }

        $ids = [];

        foreach ((clone $query)->select('servers.id')->lazyById(500)->chunk(500) as $servers) {
            $keys = $servers->map(fn (Server $server): string => $this->resultKey($server->id));
            $results = Cache::many($keys->all());

            foreach ($servers as $server) {
                if (($results[$this->resultKey($server->id)]['status'] ?? null) === 'outdated') {
                    $ids[] = $server->id;
                }
            }
        }

        return $query->whereIn('servers.id', $ids)
            ->whereHas('services', fn (Builder $services) => $services->where('type', 'php'));
    }

    public function dispatch(Builder $query): int
    {
        $run = (string) Str::uuid();
        $count = 0;

        foreach ((clone $query)->whereHas('services', fn (Builder $services) => $services->where('type', 'php'))->lazyById() as $server) {
            if (! Cache::add($this->pendingKey($server->id), true, now()->addHour())) {
                continue;
            }

            try {
                dispatch(new CheckPhpVersionsJob($server, $run))->onQueue('ssh');
            } catch (Throwable $e) {
                $this->failed($server);

                throw $e;
            }

            $count++;
        }

        return $count;
    }

    public function checking(Builder $query): bool
    {
        $keys = (clone $query)->pluck('id')->map(fn (int $id): string => $this->pendingKey($id))->all();

        return $keys !== [] && in_array(true, Cache::many($keys), true);
    }

    public function cached(int $serverId): array
    {
        $values = Cache::many([$this->resultKey($serverId), $this->pendingKey($serverId)]);

        return [
            ...($values[$this->resultKey($serverId)] ?? ['status' => 'unknown', 'versions' => [], 'checked_at' => null]),
            'checking' => (bool) $values[$this->pendingKey($serverId)],
        ];
    }

    public function handle(Server $server, string $run): void
    {
        $server->refresh();

        if (! $server->isReady()) {
            throw new RuntimeException('Server is not ready for PHP version checks.');
        }

        app(ProbeServices::class)->probe($server, phpOnly: true);

        $versions = [];

        foreach ($server->services()->where('type', 'php')->get() as $service) {
            if (! in_array($service->status, SyncServiceStatus::SETTLED_STATUSES, true)) {
                throw new RuntimeException('PHP installation or removal is in progress.');
            }

            $release = $this->release($service->version, $run);
            $installed = $service->installed_version;

            if (! is_string($installed) || ! preg_match('/^\d+\.\d+\.\d+$/', $installed)) {
                throw new RuntimeException('PHP version could not be detected.');
            }

            $versions[] = [
                'installed' => $installed,
                'latest' => $release['version'],
                'unsupported' => ! in_array($service->version, $release['supported_versions'], true),
                'outdated' => version_compare($installed, $release['version'], '<'),
            ];
        }

        $outdated = array_any($versions, fn (array $version): bool => $version['outdated'] || $version['unsupported']);

        Cache::put($this->resultKey($server->id), [
            'status' => $versions === [] ? 'no_php' : ($outdated ? 'outdated' : 'current'),
            'versions' => $versions,
            'checked_at' => now()->toIso8601String(),
        ], now()->addDays(7));
        Cache::forget($this->pendingKey($server->id));
    }

    public function failed(Server $server): void
    {
        $previous = $this->cached($server->id);
        unset($previous['checking']);

        Cache::put($this->resultKey($server->id), [...$previous, 'status' => 'error'], now()->addDays(7));
        Cache::forget($this->pendingKey($server->id));
    }

    private function release(string $branch, string $run): array
    {
        if (! preg_match('/^\d+\.\d+$/', $branch)) {
            throw new RuntimeException('Invalid PHP branch.');
        }

        $key = "php-releases:{$run}:{$branch}";

        return Cache::lock("{$key}:lock", 30)->block(15, function () use ($key, $branch): array {
            return Cache::remember($key, now()->addHour(), function () use ($branch): array {
                $release = Http::connectTimeout(5)->timeout(10)->get('https://www.php.net/releases/index.php', [
                    'json' => '',
                    'version' => $branch,
                ])->throw()->json();

                if (! is_array($release) || ! preg_match('/^'.preg_quote($branch, '/').'\.\d+$/', $release['version'] ?? '')
                    || ! is_array($release['supported_versions'] ?? null)) {
                    throw new RuntimeException('PHP release information is unavailable.');
                }

                return ['version' => $release['version'], 'supported_versions' => $release['supported_versions']];
            });
        });
    }

    private function resultKey(int $serverId): string
    {
        return "php-versions:{$serverId}";
    }

    private function pendingKey(int $serverId): string
    {
        return "php-versions:{$serverId}:checking";
    }
}
