<?php

namespace App\Actions\Ci;

use App\Models\Site;
use App\Services\Ci\CiRunnerClient;

class CancelCiRun
{
    public function __construct(
        private readonly ResolveCiRunner $resolveRunner,
        private readonly CiRunnerClient $client,
    ) {}

    public function cancel(Site $site, string $runId): bool
    {
        $runner = $this->resolveRunner->resolveVerifiedRun($site, $runId);
        $result = $this->client->request($runner, ['action' => 'cancel', 'run_id' => $runId]);

        return ($result['cancel_requested'] ?? false) === true;
    }
}
