<?php

namespace App\Services\Ci;

use Illuminate\Support\Arr;
use Illuminate\Validation\ValidationException;

class CiRunData
{
    private const array STATUSES = ['queued', 'running', 'passed', 'failed', 'infrastructure_error', 'cancelled'];

    private const array STAGE_RESULTS = ['running', 'passed', 'failed', 'skipped', 'cancelled', 'infrastructure_error'];

    public function present(array $run): array
    {
        $hasValidShape = in_array($run['status'] ?? null, self::STATUSES, true)
            && is_array($run['stages'] ?? null)
            && count($run['stages']) <= 21
            && is_string($run['ref'] ?? null)
            && strlen($run['ref']) <= 200
            && $this->isValidSha($run['sha'] ?? null)
            && in_array($run['exit_code'] ?? null, [null, 0, 1, 2], true);
        if (! $hasValidShape) {
            $this->invalid();
        }
        $status = $run['status'];
        $code = $run['exit_code'] ?? null;
        $hasConsistentExitCode = match (true) {
            in_array($status, ['queued', 'running'], true) => $code === null,
            $status === 'passed' => $code === 0 && ! empty($run['sha']) && $run['stages'],
            $status === 'failed' => $code === 1,
            default => $code === 2,
        };
        if (! $hasConsistentExitCode) {
            $this->invalid();
        }
        $stages = array_values(array_map(
            fn (mixed $stage): array => $this->presentStage($stage, $status),
            $run['stages'],
        ));

        return [
            ...Arr::only($run, ['run_id', 'ref', 'sha', 'status', 'exit_code']),
            'created_at' => $this->number($run['created_at'] ?? null),
            'finished_at' => $this->number($run['finished_at'] ?? null),
            'failure_reason' => $status === 'infrastructure_error'
                ? $this->failureReason($run['error_code'] ?? null)
                : null,
            'stages' => $stages,
            'local_stack_mode' => in_array($run['local_stack_mode'] ?? null, ['fake', 'real'], true)
                ? $run['local_stack_mode']
                : null,
        ];
    }

    private function isValidSha(mixed $sha): bool
    {
        return $sha === null || (is_string($sha) && preg_match('/^[a-f0-9]{40}$/', $sha));
    }

    private function presentStage(mixed $stage, string $runStatus): array
    {
        $hasValidShape = is_array($stage)
            && is_string($stage['name'] ?? null)
            && preg_match('/^[a-z][a-z0-9-]{0,39}$/', $stage['name'])
            && in_array($stage['result'] ?? null, self::STAGE_RESULTS, true);
        if (! $hasValidShape || ($runStatus === 'passed' && $stage['result'] !== 'passed')) {
            $this->invalid();
        }

        return [
            ...Arr::only($stage, ['name', 'result']),
            'seconds' => $this->number($stage['seconds'] ?? null),
            'peak_mem_mb' => $this->number($stage['peak_mem_mb'] ?? null),
            'sampled_memory' => is_string($stage['measurement'] ?? null)
                && str_contains($stage['measurement'], 'sampled'),
        ];
    }

    private function failureReason(mixed $code): ?string
    {
        return match ($code) {
            'cache_measurement_unavailable' => __(
                'CI cache usage could not be measured. Check the worker disk measurement before retrying.'
            ),
            'disk_capacity' => __(
                'The CI worker reached its disk or cache limit. Clean up unused CI caches before retrying.'
            ),
            'command_timeout' => __('A CI command reached its time limit. Inspect the stage log before retrying.'),
            'container_runtime_or_memory' => __(
                'A CI container could not complete because of a runtime or memory limit error. '
                .'Inspect the worker and stage log.'
            ),
            'workflow_profile_changed' => __(
                'The repository workflow changed. Update the runner profile before retrying.'
            ),
            'dependency_access' => __(
                'CI could not download dependencies. Check package credentials and the worker network.'
            ),
            'worker_role' => __('The CI worker role could not be verified. Check the worker before running CI.'),
            default => null,
        };
    }

    private function number(mixed $value): ?float
    {
        if ($value === null) {
            return null;
        }
        $isNonNegativeNumber = (is_int($value) || is_float($value))
            && is_finite((float) $value)
            && $value >= 0
            && $value <= 100000000000;
        if (! $isNonNegativeNumber) {
            $this->invalid();
        }

        return (float) $value;
    }

    private function invalid(): never
    {
        throw ValidationException::withMessages(['ci' => __('The runner returned invalid CI result data.')]);
    }
}
