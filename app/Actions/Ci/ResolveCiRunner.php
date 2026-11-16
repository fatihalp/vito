<?php

namespace App\Actions\Ci;

use App\Models\CiRunner;
use App\Models\Site;
use App\Services\Ci\CiRunnerClient;

class ResolveCiRunner
{
    public function resolve(Site $site): CiRunner
    {
        return CiRunner::query()->where('site_id', $site->id)->with(['site', 'server'])->firstOrFail();
    }

    public function resolveVerifiedRun(Site $site, string $runId): CiRunner
    {
        $runner = $this->resolve($site);
        abort_unless(preg_match('/^[a-f0-9]{16}$/', $runId), 404);
        $client = app(CiRunnerClient::class);
        $client->assertRun($runner, $client->request($runner, ['action' => 'status', 'run_id' => $runId]));

        return $runner;
    }
}
