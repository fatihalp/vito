<?php

namespace App\Actions\Ci;

use App\Models\Site;
use App\Services\Ci\CiRunnerClient;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class GetCiRunLog
{
    public function __construct(
        private readonly ResolveCiRunner $resolveRunner,
        private readonly CiRunnerClient $client,
    ) {}

    public function get(Site $site, string $runId, array $input): array
    {
        $runner = $this->resolveRunner->resolveVerifiedRun($site, $runId);
        $input = Validator::make($input, [
            'cursor' => ['sometimes', 'integer', 'min:0', 'max:17825792'],
            'stage' => ['nullable', 'string', Rule::in(['scaffold-check', ...$this->client->info($runner)['stages']])],
        ])->validate();
        $requestedCursor = (int) ($input['cursor'] ?? 0);
        $log = $this->client->request($runner, [
            'action' => 'log',
            'run_id' => $runId,
            'cursor' => $requestedCursor,
            'stage' => $input['stage'] ?? null,
        ]);
        $isValidLog = is_string($log['text'] ?? null)
            && strlen($log['text']) <= 131072
            && is_int($log['cursor'] ?? null)
            && $log['cursor'] >= $requestedCursor
            && $log['cursor'] <= 17825792;
        if (! $isValidLog) {
            throw ValidationException::withMessages(['ci' => 'The runner returned invalid log data.']);
        }

        return ['text' => $log['text'], 'cursor' => $log['cursor']];
    }
}
