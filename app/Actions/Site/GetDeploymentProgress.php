<?php

namespace App\Actions\Site;

use App\Enums\DeploymentStatus;
use App\Models\Deployment;
use App\Models\DeploymentScript;
use App\Models\Site;

class GetDeploymentProgress
{
    private const int SAMPLE_SIZE = 10;

    private static array $stepsCache = [];

    private static array $durationCache = [];

    public function get(Deployment $deployment): array
    {
        if ($deployment->rolled_back_at || ! ($site = $deployment->site) instanceof Site) {
            return ['steps' => [], 'estimated_duration' => null, 'samples' => 0];
        }

        $steps = $deployment->release
            ? [
                ...$this->steps('build', $site->buildScript),
                ...$this->steps('pre-flight', $site->preFlightScript),
            ]
            : $this->steps('deploy', $deployment->deploymentScript ?? $site->deploymentScript);

        [$estimatedDuration, $samples] = self::$durationCache[$deployment->site_id] ??= $this->resolveDuration($deployment);

        return [
            'steps' => $steps,
            'estimated_duration' => $estimatedDuration,
            'samples' => $samples,
        ];
    }

    private function resolveDuration(Deployment $deployment): array
    {
        $durations = Deployment::query()
            ->where('site_id', $deployment->site_id)
            ->where('status', DeploymentStatus::FINISHED)
            ->whereNotNull('finished_at')
            ->where('id', '!=', $deployment->id)
            ->latest('id')
            ->limit(self::SAMPLE_SIZE)
            ->get(['created_at', 'finished_at'])
            ->map(fn (Deployment $previous): int => (int) abs($previous->finished_at->diffInSeconds($previous->created_at)))
            ->filter(fn (int $seconds): bool => $seconds > 0 && $seconds <= 1800)
            ->values();

        return [
            $durations->isEmpty() ? null : (int) round($durations->avg()),
            $durations->count(),
        ];
    }

    private function steps(string $group, mixed $script): array
    {
        if (! $script instanceof DeploymentScript || ! $script->content) {
            return [];
        }

        $cacheKey = $group.':'.$script->id.':'.md5($script->content);
        if (isset(self::$stepsCache[$cacheKey])) {
            return self::$stepsCache[$cacheKey];
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

        return self::$stepsCache[$cacheKey] = $steps;
    }
}
