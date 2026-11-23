<?php

namespace App\Jobs\Site;

use App\Actions\Site\BroadcastSiteUpdate;
use App\Actions\Worker\RestartSiteWorkers;
use App\DTOs\SocketEventDTO;
use App\Enums\DeploymentStatus;
use App\Events\SocketEvent;
use App\Exceptions\DeploymentCancelled;
use App\Facades\Notifier;
use App\Http\Resources\DeploymentResource;
use App\Jobs\Worker\ResyncSiteToWorkerServersJob;
use App\Models\Deployment;
use App\Models\ServerLog;
use App\Models\Site;
use App\Notifications\DeploymentCompleted;
use App\SSH\OS\Git;
use App\Traits\UniqueQueue;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Cache;
use Throwable;

class DeployJob implements ShouldQueue
{
    use Queueable;
    use UniqueQueue;

    private bool $released = false;

    public function __construct(
        protected Deployment $deployment,
        protected bool $isModern = true,
        protected bool $finishing = false,
    ) {
        $this->onQueue('ssh');
    }

    public function handle(): void
    {
        if ($this->isCancelled()) {
            return;
        }

        $site = $this->deployment->site;
        $log = ServerLog::find($this->deployment->log_id);
        $this->released = false;

        $this->run("site-{$site->id}", function () use ($site, $log): void {
            if ($this->currentLockOwner !== null) {
                Cache::put(
                    $this->deployment->lockOwnerCacheKey(),
                    $this->currentLockOwner,
                    $this->lockSeconds(),
                );
            }

            try {
                $this->abortIfCancelled();

                if ($this->finishing) {
                    $this->finish($site);

                    return;
                }

                if ($this->isModern) {
                    $this->deployment->pruneOldReleases();
                    $this->abortIfCancelled();
                    $this->handleModernDeployment($site, $log);
                } else {
                    $this->handleClassicDeployment($site, $log);
                }

                $this->abortIfCancelled();

                if ($site->isSelf()) {
                    dispatch(new self($this->deployment, $this->isModern, finishing: true));

                    return;
                }

                $this->finish($site);
            } catch (DeploymentCancelled) {
                $this->rollbackIfReleased($site);
            } catch (Throwable $e) {
                if ($this->isCancelled()) {
                    $this->rollbackIfReleased($site);

                    return;
                }

                throw $e;
            } finally {
                Cache::forget($this->deployment->lockOwnerCacheKey());
            }
        });
    }

    private function finish(Site $site): void
    {
        $this->abortIfCancelled();

        $site->type()->afterDeploy($this->deployment);

        if ($site->type_data['composer_install_failed'] ?? false) {
            $site->jsonForget('type_data', 'composer_install_failed');
        }

        $updated = Deployment::query()
            ->whereKey($this->deployment->id)
            ->where('status', DeploymentStatus::DEPLOYING)
            ->update([
                'status' => DeploymentStatus::FINISHED,
                'finished_at' => now(),
            ]);

        if ($updated === 0) {
            throw new DeploymentCancelled;
        }

        $this->deployment->refresh();
        dispatch(new CheckAppDebugJob($site));
        dispatch(new CheckCommitsBehindJob($site));
        $this->deployment->activate();
        $this->broadcastDeploymentUpdate();
        app(BroadcastSiteUpdate::class)->broadcast($site);
        Notifier::send($site, new DeploymentCompleted($this->deployment, $site));

        if ($site->workers()->whereNotNull('server_id')->where('server_id', '!=', $site->server_id)->exists()) {
            dispatch(new ResyncSiteToWorkerServersJob($site));
        }
    }

    public function failed(Throwable $e): void
    {
        $site = $this->deployment->site;

        if ($this->isCancelled()) {
            $this->rollbackIfReleased($site);

            return;
        }

        $this->deployment->status = DeploymentStatus::FAILED;
        $this->deployment->finished_at = now();
        $this->deployment->save();
        $this->deployment->log?->write("Deployment failed: {$e->getMessage()}");

        if ($this->isModern) {
            $this->rollbackModernRelease($site);
        }

        $this->broadcastDeploymentUpdate();
        Notifier::send($site, new DeploymentCompleted($this->deployment, $site));
    }

    private function isCancelled(): bool
    {
        return Deployment::query()
            ->whereKey($this->deployment->id)
            ->where('status', DeploymentStatus::CANCELLED)
            ->exists();
    }

    private function abortIfCancelled(): void
    {
        if ($this->isCancelled()) {
            throw new DeploymentCancelled;
        }
    }

    private function rollbackIfReleased(Site $site): void
    {
        if ($this->isModern && $this->released) {
            $this->rollbackModernRelease($site);
        }
    }

    private function rollbackModernRelease(Site $site): void
    {
        $current = $site->deployments()->where('active', 1)->whereNotNull('release')->first();

        if (! $current) {
            return;
        }

        try {
            $this->deployment->site->server->ssh($site->user)->exec(
                view('ssh.modern-deployment.release', [
                    'site' => $site,
                    'releasePath' => $current->path(),
                ]),
                'release',
                $site->id
            );
        } catch (Throwable) {
        }

        $current->activate();
    }

    private function broadcastDeploymentUpdate(): void
    {
        $this->deployment->refresh()->load(['site.server', 'log', 'user', 'deploymentScript']);

        SocketEvent::dispatch(new SocketEventDTO(
            projectId: $this->deployment->site->server->project_id,
            type: 'deployment.updated',
            data: new DeploymentResource($this->deployment),
        ));
    }

    private function handleClassicDeployment(Site $site, ?ServerLog $log): void
    {
        if ($site->isSelf()) {
            app(Git::class)->prepareSelf($site);
            $this->abortIfCancelled();
        }

        $site->server->os()->runScript(
            path: $site->path,
            script: $site->deploymentScript->content,
            serverLog: $log,
            user: $site->user,
            variables: array_merge(
                $site->environmentVariables($this->deployment),
                $site->type()->deploymentEnvironment(),
            ),
            aliases: $site->environmentAliases(),
            stepGroup: 'deploy',
            pidFile: $this->deployment->pidFile(),
        );

        $this->abortIfCancelled();

        if (! $this->deployment->commit_id && $site->repository && ($lastCommit = app(Git::class)->lastCommit($site))) {
            $this->deployment->fill($lastCommit)->save();
        }

        if ($site->deploymentScriptFor(false)?->shouldRestartWorkers()) {
            $this->abortIfCancelled();
            app(RestartSiteWorkers::class)->restart($site, $log);
        }
    }

    private function handleModernDeployment(Site $site, ?ServerLog $log): void
    {
        app(Git::class)->clone($site, $this->deployment->path());
        $this->abortIfCancelled();

        $site->server->os()->runScript(
            path: $this->deployment->path(),
            script: $site->buildScript->content ?? '',
            serverLog: $log,
            user: $site->user,
            variables: array_merge(
                $site->environmentVariables($this->deployment),
                $site->type()->deploymentEnvironment(),
            ),
            aliases: $site->environmentAliases(),
            stepGroup: 'build',
            pidFile: $this->deployment->pidFile(),
        );

        $this->abortIfCancelled();

        $site->server->ssh($site->user)
            ->variables($site->environmentVariables($this->deployment))
            ->exec(
                view('ssh.modern-deployment.link-resources', [
                    'site' => $site,
                    'releasePath' => $this->deployment->path(),
                ]),
                'link-resources',
                $site->id
            );

        $this->abortIfCancelled();

        $site->server->os()->runScript(
            path: $this->deployment->path(),
            script: $site->preFlightScript->content ?? '',
            serverLog: $log,
            user: $site->user,
            variables: array_merge(
                $site->environmentVariables($this->deployment),
                $site->type()->deploymentEnvironment(),
            ),
            aliases: $site->environmentAliases(),
            stepGroup: 'pre-flight',
            pidFile: $this->deployment->pidFile(),
        );

        $this->abortIfCancelled();

        $this->released = true;

        $site->server->ssh($site->user)->exec(
            view('ssh.modern-deployment.release', [
                'site' => $site,
                'releasePath' => $this->deployment->path(),
            ]),
            'release',
            $site->id
        );

        $this->abortIfCancelled();

        if ($site->deploymentScriptFor(true)?->shouldRestartWorkers()) {
            app(RestartSiteWorkers::class)->restart($site, $log);
        }
    }
}
