<?php

namespace App\Actions\Site;

use App\Enums\DeploymentStatus;
use App\Models\Site;
use Throwable;

class GetLatestCommit
{
    public function get(Site $site): ?array
    {
        $provider = $site->sourceControl?->provider();

        if (! $provider || ! $site->repository || ! $site->branch) {
            return null;
        }

        try {
            $commit = $provider->getLastCommit($site->repository, $site->branch);
        } catch (Throwable $e) {
            return ['error' => $e->getMessage()];
        }

        if (! $commit) {
            return null;
        }

        $deployedCommitId = $site->deployments()
            ->whereIn('status', [DeploymentStatus::FINISHED, DeploymentStatus::DEPLOYING])
            ->latest('id')
            ->value('commit_id');

        return [...$commit, 'deployed' => $commit['commit_id'] === $deployedCommitId];
    }
}
