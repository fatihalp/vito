<?php

namespace App\WorkflowActions\CronJob;

use App\Models\CronJob;
use App\Models\Server;
use App\Models\Site;
use App\WorkflowActions\AbstractWorkflowAction;
use Illuminate\Support\Facades\Validator;

class CreateCronJob extends AbstractWorkflowAction
{
    public function inputs(): array
    {
        return [
            'server_id' => 'The ID of the server to create the cron job on',
            'site_id' => 'The ID of the site (optional)',
            'name' => 'The name of the cron job (optional)',
            'command' => 'The command to run (e.g. php artisan schedule:run)',
            'user' => 'The system user to run the cron job as',
            'frequency' => 'The cron frequency (e.g. * * * * * or minutely, hourly)',
        ];
    }

    public function outputs(): array
    {
        return [
            'server_id' => 'The ID of the server',
            'cronjob_id' => 'The ID of the created cron job',
            'cronjob_name' => 'The name of the created cron job',
            'cronjob_status' => 'The status of the created cron job',
        ];
    }

    public function run(array $input): array
    {
        Validator::make($input, [
            'server_id' => ['required', 'integer', 'exists:servers,id'],
            'site_id' => ['nullable', 'integer', 'exists:sites,id'],
            'command' => ['required', 'string'],
            'user' => ['required', 'string'],
            'frequency' => ['required', 'string'],
            'name' => ['nullable', 'string', 'max:255'],
        ])->validate();

        $server = Server::query()->findOrFail($input['server_id']);
        $site = ! empty($input['site_id']) ? Site::query()->find($input['site_id']) : null;

        $this->authorize('create', [CronJob::class, $server]);

        $cronJob = app(\App\Actions\CronJob\CreateCronJob::class)->create(
            $server,
            [
                'name' => $input['name'] ?? null,
                'command' => $input['command'],
                'user' => $input['user'],
                'frequency' => $input['frequency'],
                'site_id' => $site?->id,
            ],
            $site,
        );

        return [
            'server_id' => $server->id,
            'cronjob_id' => $cronJob->id,
            'cronjob_name' => $cronJob->name,
            'cronjob_status' => $cronJob->status->value,
        ];
    }
}
