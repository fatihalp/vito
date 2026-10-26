<?php

namespace App\Actions\Site;

use App\DTOs\SocketEventDTO;
use App\Enums\DeploymentStatus;
use App\Enums\DeploymentTrigger;
use App\Events\SocketEvent;
use App\Exceptions\DeploymentScriptIsEmptyException;
use App\Exceptions\ReverseProxyNotConfiguredException;
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

        $deployment = new Deployment([
            'site_id' => $site->id,
            'deployment_script_id' => $site->deploymentScript->id,
            'status' => DeploymentStatus::DEPLOYING,
            'user_id' => $user?->id,
            'trigger' => $trigger,
        ]);
        $log = ServerLog::newLog($site->server, 'deploy-'.strtotime('now'))
            ->forSite($site);
        $log->save();
        $deployment->log_id = $log->id;
        $deployment->save();
        $lastCommit = $site->sourceControl?->provider()?->getLastCommit($site->repository, $site->branch);
        if ($lastCommit) {
            $deployment->commit_id = $lastCommit['commit_id'];
            $deployment->commit_data = $lastCommit['commit_data'];
        }
        $deployment->save();

        $typeData = $site->type_data;

        if (! $modern || ! isset($typeData['modern_deployment']) || ! $typeData['modern_deployment']) {
            return $this->deployClassic($site, $deployment, $log);
        }

        return $this->deployModern($site, $deployment, $log);
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
        $deployment->loadMissing('log', 'user');

        SocketEvent::dispatch(new SocketEventDTO(
            projectId: $site->server->project_id,
            type: 'deployment.created',
            data: new DeploymentResource($deployment),
        ));
    }

    private function deployClassic(Site $site, Deployment $deployment, ServerLog $log): Deployment
    {
        dispatch(new DeployJob($deployment, false));

        $this->broadcastDeploymentCreated($site, $deployment);

        return $deployment;
    }

    private function deployModern(Site $site, Deployment $deployment, ServerLog $log): Deployment
    {
        $deployment->release = now()->format('YmdHis');
        $deployment->save();

        dispatch(new DeployJob($deployment, true));

        $this->broadcastDeploymentCreated($site, $deployment);

        return $deployment;
    }
}
