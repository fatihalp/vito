<?php

namespace App\Actions\Database;

use App\Jobs\Database\RefreshDatabaseSizesJob;
use App\Models\Server;
use App\Services\Database\Postgresql;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Validator;
use RuntimeException;
use Throwable;

class RefreshDatabaseSizes
{
    public function dispatch(Server $server): void
    {
        Validator::make(['database' => $server->database()?->name], [
            'database' => ['required', 'in:postgresql'],
        ])->validate();

        if (! Cache::add($this->pendingKey($server), true, now()->addHour())) {
            return;
        }

        try {
            RefreshDatabaseSizesJob::dispatch($server)->onQueue('ssh-checks');
        } catch (Throwable $e) {
            $this->failed($server);

            throw $e;
        }
    }

    public function cached(Server $server): array
    {
        return [
            ...Cache::get($this->resultKey($server), ['sizes' => [], 'checked_at' => null, 'failed' => false]),
            'checking' => Cache::has($this->pendingKey($server)),
        ];
    }

    public function handle(Server $server): void
    {
        $server->refresh();
        $handler = $server->database()?->handler();

        if (! $server->isReady() || ! $handler instanceof Postgresql) {
            throw new RuntimeException('A ready PostgreSQL server is required to calculate database sizes.');
        }

        $sizes = $handler->getDatabaseSizes();
        $names = $server->databases()->pluck('name')->all();

        Cache::forever($this->resultKey($server), [
            'sizes' => array_intersect_key($sizes, array_flip($names)),
            'checked_at' => now()->toIso8601String(),
            'failed' => false,
        ]);
        Cache::forget($this->pendingKey($server));
    }

    public function failed(Server $server): void
    {
        $previous = $this->cached($server);
        unset($previous['checking']);

        Cache::forever($this->resultKey($server), [...$previous, 'failed' => true]);
        Cache::forget($this->pendingKey($server));
    }

    private function resultKey(Server $server): string
    {
        return "database-sizes:{$server->id}";
    }

    private function pendingKey(Server $server): string
    {
        return "database-sizes:{$server->id}:checking";
    }
}
