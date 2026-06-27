<?php

namespace App\WorkflowActions\Worker;

use App\Models\Server;
use App\Models\Site;
use App\Models\Worker;
use App\WorkflowActions\AbstractWorkflowAction;

class CreateWorker extends AbstractWorkflowAction
{
    public function inputs(): array
    {
        return [
            'server_id' => 'The ID of the server to create the worker on',
            'site_id' => 'The ID of the site to associate the worker with (optional)',
            'name' => 'The name of the worker process',
            'command' => 'The command to run',
            'user' => 'The system user to run the worker as',
            'auto_start' => 'Whether to automatically start the worker (true/false)',
            'auto_restart' => 'Whether to automatically restart the worker (true/false)',
            'numprocs' => 'Number of processes to run',
        ];
    }

    public function outputs(): array
    {
        return [
            'server_id' => 'The ID of the server where the worker was created',
            'worker_id' => 'The ID of the created worker',
            'worker_name' => 'The name of the created worker',
            'worker_status' => 'The status of the created worker',
        ];
    }

    public function run(array $input): array
    {
        /** @var Server $server */
        $server = Server::query()->findOrFail($input['server_id']);

        $input['auto_start'] = filter_var($input['auto_start'] ?? true, FILTER_VALIDATE_BOOLEAN);
        $input['auto_restart'] = filter_var($input['auto_restart'] ?? true, FILTER_VALIDATE_BOOLEAN);
        $input['numprocs'] = (int) ($input['numprocs'] ?? 1);

        $site = null;
        if (isset($input['site_id']) && ! empty($input['site_id'])) {
            $site = Site::query()->findOrFail($input['site_id']);
        }

        $this->authorize('create', [Worker::class, $server, $site]);

        $worker = app(\App\Actions\Worker\CreateWorker::class)->create($server, $input, $site);

        return [
            'server_id' => $server->id,
            'worker_id' => $worker->id,
            'worker_name' => $worker->name,
            'worker_status' => $worker->status->value,
        ];
    }
}
