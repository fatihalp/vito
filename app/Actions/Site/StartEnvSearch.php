<?php

namespace App\Actions\Site;

use App\Jobs\Site\SearchEnvKeyJob;
use App\Models\User;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

class StartEnvSearch
{
    private const TTL_MINUTES = 10;

    public function start(User $user, array $input): string
    {
        $validated = Validator::make($input, [
            'key' => ['required', 'string', 'max:255', 'regex:/^[A-Za-z_][A-Za-z0-9_]*$/'],
        ])->validate();

        $searchId = (string) Str::uuid();

        Cache::put("env-search-owner:{$searchId}", $user->id, now()->addMinutes(self::TTL_MINUTES));
        Cache::put("env-search-result:{$searchId}", ['status' => 'pending'], now()->addMinutes(self::TTL_MINUTES));

        SearchEnvKeyJob::dispatch($user, $validated['key'], $searchId)->onQueue('ssh');

        return $searchId;
    }

    /**
     * Results contain environment values, so only the user who started the search may read them.
     *
     * @return array<string, mixed>
     */
    public function status(User $user, string $searchId): array
    {
        if (Cache::get("env-search-owner:{$searchId}") !== $user->id) {
            return ['status' => 'not_found'];
        }

        return Cache::get("env-search-result:{$searchId}", ['status' => 'not_found']);
    }
}
