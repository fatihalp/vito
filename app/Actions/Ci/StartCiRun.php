<?php

namespace App\Actions\Ci;

use App\Models\Site;
use App\Services\Ci\CiRunData;
use App\Services\Ci\CiRunnerClient;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

class StartCiRun
{
    public function __construct(
        private readonly ResolveCiRunner $resolveRunner,
        private readonly CiRunnerClient $client,
        private readonly CiRunData $presenter,
    ) {}

    public function start(Site $site, array $input): array
    {
        $runner = $this->resolveRunner->resolve($site);
        $data = Validator::make($input, [
            'ref' => ['required', 'string', 'max:200'],
            'stages' => ['required', 'array', 'min:1', 'max:20'],
            'stages.*' => ['required', 'string', 'distinct', Rule::in($this->client->info($runner)['stages'])],
        ])->validate();
        $data['ref'] = $this->client->reference($data['ref']);
        $run = $this->client->request($runner, ['action' => 'run', ...$data]);
        $this->client->assertRun($runner, $run);

        return $this->presenter->present($run);
    }
}
