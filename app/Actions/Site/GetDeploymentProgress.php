<?php

namespace App\Actions\Site;

use App\Enums\DeploymentStatus;
use App\Models\Deployment;
use App\Models\DeploymentScript;
use App\Models\Site;
use Illuminate\Database\Eloquent\Model;

class GetDeploymentProgress
{
    private const int SAMPLE_SIZE = 10;

    /**
     * @return array{
     *     steps: list<array{group: string, line: int, command: string}>,
     *     estimated_duration: ?int,
     *     samples: int
     * }
     */
    public function get(Deployment $deployment): array
    {
        if ($deployment->rolled_back_at) {
            return ['steps' => [], 'estimated_duration' => null, 'samples' => 0];
        }

        /** @var Site|null $site */
        $site = $deployment->site;
        if (! $site) {
            return ['steps' => [], 'estimated_duration' => null, 'samples' => 0];
        }

        if ($deployment->release) {
            $steps = [
                ...$this->steps('build', $site->buildScript),
                ...$this->steps('pre-flight', $site->preFlightScript),
            ];
        } else {
            $script = $deployment->deploymentScript ?? $site->deploymentScript;
            $steps = $this->steps('deploy', $script);
        }

        $durations = Deployment::query()
            ->where('site_id', $deployment->site_id)
            ->where('status', DeploymentStatus::FINISHED)
            ->whereNotNull('finished_at')
            ->where('id', '!=', $deployment->id)
            ->latest('id')
            ->limit(self::SAMPLE_SIZE)
            ->get(['created_at', 'finished_at'])
            ->map(function (Deployment $previous): int {
                return (int) abs($previous->finished_at->diffInSeconds($previous->created_at));
            })
            ->filter(fn (int $seconds): bool => $seconds > 0 && $seconds <= 1800)
            ->values();

        return [
            'steps' => $steps,
            'estimated_duration' => $durations->isEmpty() ? null : (int) round($durations->avg()),
            'samples' => $durations->count(),
        ];
    }

    /**
     * Executable lines of a script, matching the line markers emitted by the run-script template.
     *
     * @return list<array{group: string, line: int, command: string}>
     */
    private function steps(string $group, mixed $script): array
    {
        if (! $script instanceof DeploymentScript || ! $script->content) {
            return [];
        }

        $steps = [];
        $continued = false;

        foreach (explode("\n", $script->content) as $index => $line) {
            $command = trim($line);
            $isContinuation = $continued;
            $continued = str_ends_with($command, '\\');

            if ($isContinuation || $command === '' || str_starts_with($command, '#') || preg_match('/^(then|else|fi|do|done|esac|;;|\{|\})$/', $command)) {
                continue;
            }

            $steps[] = ['group' => $group, 'line' => $index + 1, 'command' => rtrim($command, '\\ ')];
        }

        return $steps;
    }
}
