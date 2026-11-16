<?php

namespace App\Actions\Ci;

use App\Models\Site;
use App\Services\Ci\CiRunData;
use App\Services\Ci\CiRunnerClient;
use Illuminate\Validation\ValidationException;

class ListCiRuns
{
    public function __construct(
        private readonly ResolveCiRunner $resolveRunner,
        private readonly CiRunnerClient $client,
        private readonly CiRunData $presenter,
    ) {}

    public function list(Site $site): array
    {
        $runner = $this->resolveRunner->resolve($site);
        $runs = $this->client->request($runner, ['action' => 'list']);
        if (! array_is_list($runs) || count($runs) > 50) {
            throw ValidationException::withMessages(['ci' => 'The runner returned an invalid CI history.']);
        }
        $data = [];
        foreach ($runs as $run) {
            if (! is_array($run)) {
                throw ValidationException::withMessages(['ci' => 'The runner returned invalid CI result data.']);
            }
            $this->client->assertRun($runner, $run);
            $data[] = $this->presenter->present($run);
        }

        return ['runs' => $data, 'stages' => $this->client->info($runner)['stages']];
    }
}
