<?php

namespace App\Actions\Site;

use App\Helpers\EnvParser;
use App\Models\Site;
use App\Models\User;
use Illuminate\Support\Facades\Validator;

class SearchEnvKey
{

    public function search(User $user, string $key): array
    {
        $validated = Validator::make(['key' => $key], [
            'key' => ['required', 'string', 'max:255', 'regex:/^[A-Za-z_][A-Za-z0-9_]*$/'],
        ])->validate();

        $sites = Site::query()
            ->with('server')
            ->orderBy('domain')
            ->get();

        return $sites->map(function (Site $site) use ($validated): array {
            $variables = EnvParser::parse($site->getEnv());
            $match = collect($variables)->firstWhere('key', $validated['key']);

            return [
                'site_id' => $site->id,
                'domain' => $site->domain,
                'server_id' => $site->server_id,
                'server_name' => $site->server->name,
                'found' => $match !== null,
                'value' => $match['value'] ?? null,
            ];
        })->all();
    }
}
