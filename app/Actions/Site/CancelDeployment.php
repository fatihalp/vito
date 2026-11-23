<?php

namespace App\Actions\Site;

use App\DTOs\SocketEventDTO;
use App\Enums\DeploymentStatus;
use App\Events\SocketEvent;
use App\Http\Resources\DeploymentResource;
use App\Models\Deployment;
use App\Models\Site;
use App\Models\User;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;
use Throwable;

class CancelDeployment
{
    public function cancel(Site $site, Deployment $deployment, ?User $user = null): Deployment
    {
        if ($deployment->site_id !== $site->id) {
            throw ValidationException::withMessages([
                'deployment' => 'This deployment does not belong to the selected site.',
            ]);
        }

        $updated = Deployment::query()
            ->whereKey($deployment->id)
            ->where('site_id', $site->id)
            ->where('status', DeploymentStatus::DEPLOYING)
            ->update([
                'status' => DeploymentStatus::CANCELLED,
                'finished_at' => now(),
            ]);

        if ($updated === 0) {
            throw ValidationException::withMessages([
                'status' => 'Only an in-progress deployment can be cancelled.',
            ]);
        }

        $deployment->refresh()->load(['log', 'user', 'deploymentScript']);
        $deployment->setRelation('site', $site);

        $actor = $user?->name ? " by {$user->name}" : '';
        $deployment->log?->write("\nDeployment cancelled{$actor}.\n");

        $this->broadcastDeploymentUpdate($site, $deployment);

        $this->terminateRemoteProcess($site, $deployment);
        $this->releaseOwnedLock($site, $deployment);

        return $deployment;
    }

    private function terminateRemoteProcess(Site $site, Deployment $deployment): void
    {
        try {
            $site->server->ssh()->exec(
                command: view('ssh.site.cancel-deployment', [
                    'pidFile' => $deployment->pidFile(),
                ]),
                timeout: 15,
            );
        } catch (Throwable $e) {
            Log::warning('Failed to terminate remote deployment process', [
                'deployment_id' => $deployment->id,
                'site_id' => $site->id,
                'message' => $e->getMessage(),
            ]);
        }
    }

    private function releaseOwnedLock(Site $site, Deployment $deployment): void
    {
        $lockOwner = Cache::pull($deployment->lockOwnerCacheKey());

        if (is_string($lockOwner) && $lockOwner !== '') {
            Cache::restoreLock("unique-queue:site-{$site->id}", $lockOwner)->release();
        }
    }

    private function broadcastDeploymentUpdate(Site $site, Deployment $deployment): void
    {
        SocketEvent::dispatch(new SocketEventDTO(
            projectId: $site->server->project_id,
            type: 'deployment.updated',
            data: new DeploymentResource($deployment),
        ));
    }
}
