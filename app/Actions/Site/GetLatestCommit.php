<?php

namespace App\Actions\Site;

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

        return [...$commit, 'deployed' => $commit['commit_id'] === $site->deployedCommitId()];
    }
}
