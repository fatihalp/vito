<?php

namespace App\Actions\Site;

use App\DTOs\SocketEventDTO;
use App\Enums\DeploymentStatus;
use App\Enums\DeploymentTrigger;
use App\Events\SocketEvent;
use App\Exceptions\DeploymentScriptIsEmptyException;
use App\Http\Resources\DeploymentResource;
use App\Jobs\Site\DeployJob;
use App\Models\Deployment;
use App\Models\ServerLog;
use App\Models\Site;
use App\Models\User;
use Illuminate\Support\Facades\Cache;
use Throwable;

class Deploy
{
    public function run(
        Site $site,
        bool $modern = true,
        ?User $user = null,
        DeploymentTrigger $trigger = DeploymentTrigger::MANUAL,
    ): Deployment
    {
        $site->type()->assertReadyToDeploy();

        if ($site->sourceControl) {
            $site->sourceControl->getRepo($site->repository);
        }

        if (! $site->deploymentScript?->content) {
            throw new DeploymentScriptIsEmptyException;
        }

        if ($site->isSelf()) {
            $this->recoverSelfWorker($site);
        }

        $log = ServerLog::newLog($site->server, 'deploy-'.strtotime('now'))
            ->forSite($site);
        $log->save();

        $lastCommit = $site->sourceControl?->provider()?->getLastCommit($site->repository, $site->branch);
        $isModern = $modern && ($site->type_data['modern_deployment'] ?? false);

        $deployment = new Deployment([
            'site_id' => $site->id,
            'deployment_script_id' => $site->deploymentScript->id,
            'log_id' => $log->id,
            'status' => DeploymentStatus::DEPLOYING,
            'user_id' => $user?->id,
            'trigger' => $trigger,
            'commit_id' => $lastCommit['commit_id'] ?? null,
            'commit_data' => $lastCommit['commit_data'] ?? null,
            'release' => $isModern ? now()->format('YmdHis') : null,
        ]);
        $deployment->setRelation('site', $site);
        $deployment->setRelation('log', $log);
        $deployment->setRelation('deploymentScript', $site->deploymentScript);
        if ($user) {
            $deployment->setRelation('user', $user);
        }
        $deployment->save();

        dispatch(new DeployJob($deployment, $isModern));

        $this->broadcastDeploymentCreated($site, $deployment);

        return $deployment;
    }

    private function recoverSelfWorker(Site $site): void
    {
        $site->deployments()
            ->where('status', DeploymentStatus::DEPLOYING)
            ->update([
                'status' => DeploymentStatus::FAILED,
                'finished_at' => now(),
            ]);

        Cache::lock("unique-queue:site-{$site->id}")->forceRelease();

        try {
            $site->server->ssh()->exec(
                'sudo -n pkill -f "supervisorctl restart worker" 2>/dev/null || true; '
                .'if sudo -n supervisorctl status worker:* 2>/dev/null | grep -q STOPPING; then sudo -n pkill -9 -f "artisan horizon" 2>/dev/null || true; fi; '
                .'sudo -n supervisorctl start worker:* 2>/dev/null || true'
            );
        } catch (Throwable) {
        }
    }

    private function broadcastDeploymentCreated(Site $site, Deployment $deployment): void
    {
        SocketEvent::dispatch(new SocketEventDTO(
            projectId: $site->server->project_id,
            type: 'deployment.created',
            data: new DeploymentResource($deployment),
        ));
    }
}
