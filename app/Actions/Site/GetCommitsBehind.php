<?php

namespace App\Actions\Site;

use App\Enums\DeploymentStatus;
use App\Models\Site;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Validator;
use Throwable;

class GetCommitsBehind
{
    public function get(Site $site): ?array
    {
        $provider = $site->sourceControl?->provider();

        if (! $provider || ! $site->repository || ! $site->branch) {
            return null;
        }

        $commitId = $site->deployedCommitId();

        if (! $commitId) {
            return ['branch' => $site->branch, 'behind' => null];
        }

        try {
            $behind = Cache::remember(
                'site_commits_behind_'.$site->id.'_'.md5($commitId.$site->branch),
                60,
                fn (): int => $provider->countCommitsBehind($site->repository, $commitId, $site->branch)
            );
        } catch (Throwable $e) {
            return ['branch' => $site->branch, 'error' => $e->getMessage()];
        }

        return ['branch' => $site->branch, 'behind' => $behind];
    }

    public function filter(Builder $query, array $input): Builder
    {
        $status = Validator::make($input, ['git_status' => ['nullable', 'in:all,up_to_date,behind']])->validate()['git_status'] ?? 'all';

        if ($status === 'all') {
            return $query;
        }

        $ids = (clone $query)
            ->whereNotNull('repository')
            ->whereNotNull('branch')
            ->whereNotNull('source_control_id')
            ->whereHas('deployments', fn (Builder $deployments) => $deployments->whereIn('status', [DeploymentStatus::FINISHED, DeploymentStatus::DEPLOYING]))
            ->with('sourceControl')
            ->get()
            ->filter(function (Site $site) use ($status): bool {
                $behind = $this->get($site)['behind'] ?? null;

                return is_int($behind) && ($status === 'up_to_date' ? $behind === 0 : $behind > 0);
            })
            ->modelKeys();

        return $query->whereIn('sites.id', $ids);
    }
}
