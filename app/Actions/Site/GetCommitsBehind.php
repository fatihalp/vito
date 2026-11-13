<?php

namespace App\Actions\Site;

use App\Enums\DeploymentStatus;
use App\Jobs\Site\CheckCommitsBehindJob;
use App\Models\Site;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Validator;
use Throwable;

class GetCommitsBehind
{
    public function get(Site $site): ?array
    {
        if (! $site->sourceControl || ! $site->repository || ! $site->branch) {
            return null;
        }

        $commitId = $site->deployedCommitId();

        if (! $commitId) {
            return ['branch' => $site->branch, 'behind' => null];
        }

        return Cache::get($this->key($site, $commitId)) ?? $this->refresh($site, $commitId);
    }

    public function refresh(Site $site, string $commitId): array
    {
        try {
            $result = [
                'branch' => $site->branch,
                'behind' => $site->sourceControl->provider()->countCommitsBehind($site->repository, $commitId, $site->branch),
            ];
            Cache::put($this->key($site, $commitId), $result, now()->addMinutes(5));
        } catch (Throwable $e) {
            $result = ['branch' => $site->branch, 'error' => $e->getMessage()];
            Cache::put($this->key($site, $commitId), $result, now()->addMinute());
        }

        return $result;
    }

    public function scan(Builder $query, array $input): array
    {
        $validated = Validator::make($input, [
            'git_status' => ['nullable', 'in:all,up_to_date,behind'],
            'sort' => ['nullable', 'string'],
        ])->validate();
        $status = $validated['git_status'] ?? 'all';

        if ($status === 'all' && ltrim($validated['sort'] ?? '', '-') !== 'branch') {
            return ['query' => $query, 'checking' => 0, 'behind' => []];
        }

        $sites = (clone $query)
            ->whereNotNull('repository')
            ->whereNotNull('branch')
            ->whereNotNull('source_control_id')
            ->whereHas('deployments', fn (Builder $deployments) => $deployments->whereIn('status', [DeploymentStatus::FINISHED, DeploymentStatus::DEPLOYING]))
            ->get();

        $behindBySite = [];
        $checking = 0;

        foreach ($sites as $site) {
            $result = Cache::get($this->key($site, (string) $site->deployedCommitId()));

            if ($result === null) {
                $checking++;
                dispatch(new CheckCommitsBehindJob($site));

                continue;
            }

            if (is_int($result['behind'] ?? null)) {
                $behindBySite[$site->id] = $result['behind'];
            }
        }

        if ($status !== 'all') {
            $query->whereIn('sites.id', array_keys(array_filter($behindBySite, fn (int $behind): bool => $status === 'up_to_date' ? $behind === 0 : $behind > 0)));
        }

        return ['query' => $query, 'checking' => $checking, 'behind' => $behindBySite];
    }

    private function key(Site $site, string $commitId): string
    {
        return 'site:'.$site->id.':commits-behind:'.md5($commitId.$site->branch);
    }
}
