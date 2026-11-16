<?php

namespace App\Actions\Ci;

use App\Models\CiRunner;
use App\Models\Server;
use App\Models\Site;
use App\Models\User;
use Illuminate\Support\Collection;

class GetCiRunnerOverview
{
    public function get(User $user, Server $server, Site $site): array
    {
        $canConfigure = $user->can('configure', [CiRunner::class, $site, $server]);
        $runner = CiRunner::query()->where('site_id', $site->id)->with('server:id,name')->first();

        return [
            'runner' => $runner ? [
                'server_id' => $runner->server_id,
                'server_name' => $runner->server->name,
                'repository' => $runner->repository,
                'enabled' => $runner->enabled,
                ...($canConfigure ? ['user' => $runner->user, 'executable' => $runner->executable] : []),
            ] : null,
            'canConfigure' => $canConfigure,
            'canRun' => $user->can('run', [CiRunner::class, $site, $server]),
            'runnerServers' => $canConfigure ? $this->runnerServers($user) : [],
        ];
    }

    private function runnerServers(User $user): Collection
    {
        return Server::query()
            ->with('project')
            ->where('is_self', false)
            ->where('status', 'ready')
            ->orderBy('name')
            ->get(['id', 'name', 'project_id', 'is_self', 'status'])
            ->filter(fn (Server $candidate): bool => $user->can('update', $candidate))
            ->map->only(['id', 'name'])
            ->values();
    }
}
