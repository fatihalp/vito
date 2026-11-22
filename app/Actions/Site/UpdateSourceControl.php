<?php

namespace App\Actions\Site;

use App\DTOs\SocketEventDTO;
use App\Events\SocketEvent;
use App\Exceptions\RepositoryNotFound;
use App\Exceptions\RepositoryPermissionDenied;
use App\Exceptions\SourceControlIsNotConnected;
use App\Http\Resources\SiteResource;
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
            'repository' => ['nullable', 'string'],
            'branch' => ['nullable', 'string'],
        ])->validate();

        $newSourceControlId = (int) $input['source_control'];
        $newRepository = array_key_exists('repository', $input) && trim((string) $input['repository']) !== ''
            ? trim((string) $input['repository'])
            : $site->repository;
        $newBranch = array_key_exists('branch', $input) && trim((string) $input['branch']) !== ''
            ? trim((string) $input['branch'])
            : $site->branch;

        if (! $newRepository) {
            throw ValidationException::withMessages([
                'repository' => 'Repository is required.',
            ]);
        }

        if (
            $site->source_control_id === $newSourceControlId
            && $site->repository === $newRepository
            && $site->branch === $newBranch
        ) {
            return;
        }

        $newSourceControl = SourceControl::find($newSourceControlId);
        if (! $newSourceControl instanceof SourceControl) {
            throw ValidationException::withMessages([
                'source_control' => 'Source control not found',
            ]);
        }

        try {
            $newSourceControl->getRepo($newRepository);
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
        $oldRepository = $site->repository;
        $oldBranch = $site->branch;
        $oldDeployKeyId = $site->type_data['deploy_key_id'] ?? null;
        $oldGitHook = $site->gitHook;

        $this->swap($site, $newSourceControl, $newRepository, $newBranch, null);

        try {
            app(SyncSiteDeployKey::class)->setup($site);
            app(Git::class)->setRemote($site, $newSourceControl->provider()->fullRepoUrl($site->repository, $site->getSshKeyName()));
        } catch (Throwable $e) {
            $newDeployKeyId = $site->type_data['deploy_key_id'] ?? null;
            $this->swap($site, $oldSourceControl, $oldRepository, $oldBranch, $oldDeployKeyId);
            if ($newDeployKeyId) {
                $this->deleteDeployKey($site, $newSourceControl, (string) $newDeployKeyId, $newRepository);
            }

            throw $e;
        }

        if ($oldDeployKeyId && $oldSourceControl && $oldRepository) {
            $this->deleteDeployKey($site, $oldSourceControl, (string) $oldDeployKeyId, $oldRepository);
        }

        if ($oldGitHook && ($oldSourceControl?->id !== $newSourceControl->id || $oldRepository !== $newRepository)) {
            try {
                $oldGitHook->destroyHook();
            } catch (Throwable $e) {
                Log::warning('Failed to destroy old git hook on source-control swap', [
                    'site_id' => $site->id,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        SocketEvent::dispatch(new SocketEventDTO(
            projectId: $site->server->project_id,
            type: 'site.updated',
            data: new SiteResource($site->refresh()),
        ));
    }

    private function deleteDeployKey(Site $site, SourceControl $sourceControl, string $keyId, string $repository): void
    {
        try {
            $sourceControl->provider()->deleteDeployKey($keyId, $repository);
        } catch (Throwable $e) {
            Log::warning('Failed to delete deploy key on source-control swap', [
                'site_id' => $site->id,
                'deploy_key_id' => $keyId,
                'error' => $e->getMessage(),
            ]);
        }
    }

    private function swap(Site $site, ?SourceControl $sourceControl, ?string $repository, ?string $branch, int|string|null $deployKeyId): void
    {
        $site->source_control_id = $sourceControl?->id;
        $site->repository = $repository;
        $site->branch = $branch;
        $site->setRelation('sourceControl', $sourceControl);
        $site->jsonUpdate('type_data', 'deploy_key_id', $deployKeyId);
    }
}
