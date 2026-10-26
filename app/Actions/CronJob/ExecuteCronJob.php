<?php

namespace App\Actions\CronJob;

use App\Enums\CommandExecutionStatus;
use App\Jobs\CronJob\ExecuteCronJobJob;
use App\Models\CommandExecution;
use App\Models\CronJob;
use App\Models\Server;
use App\Models\ServerLog;
use App\Models\User;

class ExecuteCronJob
{
    public function execute(Server $server, CronJob $cronJob, User $user): CommandExecution
    {
        $execution = new CommandExecution([
            'cron_job_id' => $cronJob->id,
            'server_id' => $server->id,
            'user_id' => $user->id,
            'variables' => [],
            'status' => CommandExecutionStatus::EXECUTING,
        ]);
        $execution->save();

        $log = ServerLog::newLog($server, 'cronjob-'.$cronJob->id.'-'.strtotime('now'));
        if ($cronJob->site_id) {
            $log->forSite($cronJob->site_id);
        }
        $log->save();

        $execution->server_log_id = $log->id;
        $execution->save();

        dispatch(new ExecuteCronJobJob($execution, $cronJob, $log));

        return $execution;
    }
}
