<?php

namespace App\Actions\Site;

use App\Models\Site;

class SyncSiteDeployKey
{
    public function setup(Site $site): void
    {
        if (! $site->sourceControl) {
            return;
        }

        if ($site->sourceControl->isGithubApp()) {
            return;
        }

        $os = $site->server->os();

        if (! $site->ssh_key) {
            $keyName = $site->getSshKeyName();
            $os->generateSSHKey($keyName, $site);
            $publicKey = $os->readSSHKey($keyName, $site);

            if (str_starts_with($keyName, 'iuser_') && $site->isolatedUser) {
                $site->isolatedUser->ssh_key = $publicKey;
                $site->isolatedUser->save();
                $site->setRelation('isolatedUser', $site->isolatedUser->fresh());
            } else {
                $site->ssh_key = $publicKey;
                $site->save();
            }
        }

        if (empty($site->type_data['deploy_key_id'])) {
            $keyId = $site->sourceControl?->provider()?->deployKey(
                $site->getDeployKeyName(),
                $site->repository,
                $site->ssh_key
            );
            $site->jsonUpdate('type_data', 'deploy_key_id', $keyId);
        }
    }
}
