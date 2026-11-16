<?php

namespace App\Actions\Ci;

use App\Models\CiRunner;
use App\Models\Site;
use App\Services\Ci\CiRunnerClient;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

class ConfigureCiRunner
{
    public function configure(Site $site, array $input): CiRunner
    {
        $data = Validator::make($input, [
            'server_id' => ['required', 'integer', Rule::exists('servers', 'id')->where('is_self', false)->where('status', 'ready')],
            'user' => ['required', 'string', 'max:32', 'regex:/^[a-z_][a-z0-9_-]*$/', Rule::notIn(['root'])],
            'executable' => ['required', 'string', 'max:255', 'regex:~^/usr/local/(?:bin|libexec)/[A-Za-z0-9_./-]+$~', 'not_regex:~(?:^|/)\.{1,2}(?:/|$)~'],
            'enabled' => ['required', 'boolean'],
        ])->validate();
        $client = app(CiRunnerClient::class);
        $data = [...$data, ...$client->sourceIdentity($site)];
        $data['repository'] = $client->repository($site->repository);
        $candidate = new CiRunner(['site_id' => $site->id, ...$data]);
        $client->info($candidate);

        return CiRunner::query()->updateOrCreate(['site_id' => $site->id], $data);
    }
}
