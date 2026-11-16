<?php

namespace App\Actions\Site;

use App\Exceptions\RepositoryNotFound;
use App\Exceptions\RepositoryPermissionDenied;
use App\Exceptions\SourceControlIsNotConnected;
use App\Models\Site;
use App\Models\SourceControl;
use App\SSH\OS\Git;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;
use Throwable;

class UpdateSourceControl
{
    
    public function update(Site $site, array $input): void
    {
        Validator::make($input, [
            'source_control' => SourceControl::siteValidationRules($site->server),
        ])->validate();

        $newSourceControlId = (int) $input['source_control'];

        if ($site->source_control_id === $newSourceControlId) {
            return;
        }

        $newSourceControl = SourceControl::find($newSourceControlId);
        if (! $newSourceControl instanceof SourceControl) {
            throw ValidationException::withMessages([
                'source_control' => 'Source control not found',
            ]);
        }

        try {
            $newSourceControl->getRepo($site->repository);
        } catch (SourceControlIsNotConnected) {
            throw ValidationException::withMessages([
                'source_control' => 'Source control is not connected',
            ]);
        } catch (RepositoryPermissionDenied) {
            throw ValidationException::withMessages([
                'repository' => 'You do not have permission to access this repository',
            ]);
        } catch (RepositoryNotFound) {
            throw ValidationException::withMessages([
                'repository' => 'Repository not found',
            ]);
        }

        $oldSourceControl = $site->sourceControl;
        $oldDeployKeyId = $site->type_data['deploy_key_id'] ?? null;
        $oldGitHook = $site->gitHook;

        $this->swap($site, $newSourceControl, null);

        try {
            app(SyncSiteDeployKey::class)->setup($site);
            app(Git::class)->setRemote($site, $newSourceControl->provider()->fullRepoUrl($site->repository, $site->getSshKeyName()));
        } catch (Throwable $e) {
            $newDeployKeyId = $site->type_data['deploy_key_id'] ?? null;
            $this->swap($site, $oldSourceControl, $oldDeployKeyId);
            if ($newDeployKeyId) {
                $this->deleteDeployKey($site, $newSourceControl, (string) $newDeployKeyId);
            }

            throw $e;
        }

        if ($oldDeployKeyId && $oldSourceControl) {
            $this->deleteDeployKey($site, $oldSourceControl, (string) $oldDeployKeyId);
        }

        if ($oldGitHook) {
            try {
                $oldGitHook->destroyHook();
            } catch (Throwable $e) {
                Log::warning('Failed to destroy old git hook on source-control swap', [
                    'site_id' => $site->id,
                    'error' => $e->getMessage(),
                ]);
            }
        }
    }

    private function deleteDeployKey(Site $site, SourceControl $sourceControl, string $keyId): void
    {
        try {
            $sourceControl->provider()->deleteDeployKey($keyId, $site->repository);
        } catch (Throwable $e) {
            Log::warning('Failed to delete deploy key on source-control swap', [
                'site_id' => $site->id,
                'deploy_key_id' => $keyId,
                'error' => $e->getMessage(),
            ]);
        }
    }

    private function swap(Site $site, ?SourceControl $sourceControl, int|string|null $deployKeyId): void
    {
        $site->source_control_id = $sourceControl?->id;
        $site->setRelation('sourceControl', $sourceControl);
        $site->jsonUpdate('type_data', 'deploy_key_id', $deployKeyId);
    }
}
