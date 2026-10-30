<?php

namespace App\Actions\Worker;

use App\Enums\WorkerLogType;
use App\Enums\WorkerStatus;
use App\Jobs\Worker\RestartAllJob;
use App\Models\Server;
use App\Models\Site;
use App\Models\User;
use App\Models\Worker;

class RestartAllWorkers
{
    public function restart(Server $server, ?Site $site = null, ?User $user = null): void
    {
        $user = $user ?? user();

        $server->workers()
            ->when($site, fn ($query) => $query->where('site_id', $site->id))
            ->whereNotIn('status', [WorkerStatus::CREATING, WorkerStatus::DELETING])
            ->get()
            ->each(function (Worker $worker) use ($user): void {
                $worker->status = WorkerStatus::RESTARTING;
                $worker->error = null;
                $worker->save();

                $worker->recordLog(
                    WorkerLogType::RESTARTED,
                    $user ? "Worker restarted manually (all workers) by {$user->name}" : 'Worker restarted manually (all workers)',
                    $user?->id
                );
            });

        dispatch(new RestartAllJob($server, $site))->onQueue('ssh');
    }
}
