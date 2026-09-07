<?php

namespace App\WorkflowActions\Worker;

use App\Models\Server;
use App\Models\Site;
use App\Models\Worker;
use App\WorkflowActions\AbstractWorkflowAction;
use Illuminate\Support\Facades\Validator;

class CreateWorker extends AbstractWorkflowAction
{
    public function inputs(): array
    {
        return [
            'server_id' => 'The ID of the server to create the worker on',
            'site_id' => 'The ID of the site (optional)',
            'name' => 'The name of the worker (e.g. Horizon)',
            'command' => 'The command to run (e.g. php8.4 artisan horizon)',
            'user' => 'The system user to run the worker as',
            'auto_start' => true,
            'auto_restart' => true,
            'numprocs' => 1,
            'directory' => 'Working directory (optional)',
        ];
    }

    public function outputs(): array
    {
        return [
            'server_id' => 'The ID of the server',
            'worker_id' => 'The ID of the created worker',
            'worker_name' => 'The name of the created worker',
            'worker_status' => 'The status of the created worker',
        ];
    }

    public function run(array $input): array
    {
        Validator::make($input, [
            'server_id' => ['required', 'integer', 'exists:servers,id'],
            'site_id' => ['nullable', 'integer', 'exists:sites,id'],
            'name' => ['required', 'string', 'max:255'],
            'command' => ['required', 'string'],
            'user' => ['required', 'string'],
            'auto_start' => ['nullable', 'boolean'],
            'auto_restart' => ['nullable', 'boolean'],
            'numprocs' => ['nullable', 'integer', 'min:1'],
        ])->validate();

        $server = Server::query()->findOrFail($input['server_id']);
        $site = ! empty($input['site_id']) ? Site::query()->find($input['site_id']) : null;

        $this->authorize('create', [Worker::class, $server]);

        $worker = app(\App\Actions\Worker\CreateWorker::class)->create(
            $server,
            [
                'name' => $input['name'],
                'command' => $input['command'],
                'user' => $input['user'],
                'auto_start' => (bool) ($input['auto_start'] ?? true),
                'auto_restart' => (bool) ($input['auto_restart'] ?? true),
                'numprocs' => (int) ($input['numprocs'] ?? 1),
                'directory' => $input['directory'] ?? ($site ? $site->path : null),
                'site_id' => $site?->id,
            ],
            $site,
        );

        return [
            'server_id' => $server->id,
            'worker_id' => $worker->id,
            'worker_name' => $worker->name,
            'worker_status' => $worker->status->value,
        ];
    }
}
