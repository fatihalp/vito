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
        } catch (Throwable) {
            return [
                'error' => 'Could not retrieve the latest commit. Check the source control connection and try again.',
            ];
        }

        if (! $commit) {
            return null;
        }

        $deployedCommitId = $site->deployedCommitId();
        $deployed = $commit['commit_id'] === $deployedCommitId;
        $behind = ! $deployed && $deployedCommitId
            ? (app(GetCommitsBehind::class)->refresh($site, $deployedCommitId)['behind'] ?? null)
            : null;

        return [
            ...$commit,
            'deployed' => $deployed,
            'behind' => $behind,
        ];
    }
}
