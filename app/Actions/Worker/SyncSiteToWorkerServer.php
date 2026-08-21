<?php

namespace App\Actions\Worker;

use App\Exceptions\SSHCommandError;
use App\Models\IsolatedUser;
use App\Models\Server;
use App\Models\Site;
use App\SSH\OS\Composer;
use App\SSH\OS\Git;
use Illuminate\Support\Str;

class SyncSiteToWorkerServer
{
    public function sync(Site $site, Server $server): void
    {
        $this->ensureIsolatedUser($site, $server);
        $this->ensureDeployKey($site, $server);

        if ($this->repositoryCloned($site, $server)) {
            app(Git::class)->fetchOrigin($site, $server);
            app(Git::class)->checkout($site, $server);
        } else {
            app(Git::class)->clone($site, null, $server);
        }

        $override = $site->type_data['composer_install_command'] ?? null;
        app(Composer::class)->installDependencies($site, is_string($override) ? $override : null, $server);

        $this->syncEnvironmentFile($site, $server);
    }

    private function ensureIsolatedUser(Site $site, Server $server): void
    {
        $exists = IsolatedUser::query()
            ->where('server_id', $server->id)
            ->where('username', $site->user)
            ->exists();

        if (! $exists) {
            $server->os()->createIsolatedUser($site->user, Str::random(15), $site->id);
        }

        IsolatedUser::query()->firstOrCreate([
            'server_id' => $server->id,
            'username' => $site->user,
        ]);
    }

    private function ensureDeployKey(Site $site, Server $server): void
    {
        if (! $site->sourceControl || $site->sourceControl->isGithubApp()) {
            return;
        }

        $keyName = $site->getSshKeyName();

        try {
            $server->os()->readSSHKey($keyName, $site);

            return;
        } catch (SSHCommandError) {
        }

        $server->os()->generateSSHKey($keyName, $site);
        $publicKey = $server->os()->readSSHKey($keyName, $site);

        $site->sourceControl->provider()?->deployKey(
            $site->getDeployKeyName().'-worker-'.$server->id,
            $site->repository,
            $publicKey
        );
    }

    private function repositoryCloned(Site $site, Server $server): bool
    {
        try {
            $server->ssh($site->user)->exec(view('ssh.site.check-repository-cloned', [
                'path' => $site->path,
            ]));

            return true;
        } catch (SSHCommandError) {
            return false;
        }
    }

    private function syncEnvironmentFile(Site $site, Server $server): void
    {
        $path = $site->resolveEnvPath();
        $content = $site->server->os()->readFile($path);
        $server->os()->write($path, $content, $site->user);
    }
}
