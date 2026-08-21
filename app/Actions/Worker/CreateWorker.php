<?php

namespace App\Actions\Worker;

use App\Enums\ServerRole;
use App\Enums\WorkerStatus;
use App\Jobs\Worker\CreateJob;
use App\Jobs\Worker\SyncSiteBeforeCreateJob;
use App\Models\Server;
use App\Models\Site;
use App\Models\Worker;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class CreateWorker
{
    public function create(Server $server, array $input, ?Site $site = null): Worker
    {
        $targetServer = $this->resolveTargetServer($server, $site, $input);

        $this->validate($server, $targetServer, $input, $site);

        $siteId = $site?->id;
        if (! $site && isset($input['site_id']) && ! empty($input['site_id'])) {
            $siteId = (int) $input['site_id'];
        }

        $worker = new Worker([
            'server_id' => $targetServer->id,
            'site_id' => $siteId,
            'name' => $input['name'],
            'command' => $input['command'],
            'user' => $input['user'],
            'auto_start' => $input['auto_start'] ? 1 : 0,
            'auto_restart' => $input['auto_restart'] ? 1 : 0,
            'numprocs' => $input['numprocs'],
            'environment' => isset($input['environment'])
                ? UpdateWorkerEnvironment::processVariables($input['environment'], null)
                : null,
            'status' => WorkerStatus::CREATING,
        ]);
        $worker->save();

        if ($site && $targetServer->id !== $site->server_id) {
            Bus::chain([
                new SyncSiteBeforeCreateJob($worker),
                new CreateJob($worker),
            ])->onQueue('ssh')->dispatch();
        } else {
            dispatch(new CreateJob($worker))->onQueue('ssh');
        }

        return $worker;
    }

    private function resolveTargetServer(Server $server, ?Site $site, array $input): Server
    {
        if (! $site || empty($input['target_server_id'])) {
            return $server;
        }

        return Server::query()
            ->where('project_id', $server->project_id)
            ->where(function ($query) use ($site): void {
                $query->where('role', ServerRole::QUEUE->value)->orWhere('id', $site->server_id);
            })
            ->whereIn('status', ['ready', 'updating'])
            ->findOrFail((int) $input['target_server_id']);
    }

    private function validate(Server $server, Server $targetServer, array $input, ?Site $site = null): void
    {
        $isExternalSiteWorker = $site && $targetServer->id !== $site->server_id;

        $rules = [
            'name' => [
                'required',
                'string',
                'max:255',
                Rule::unique('workers')->where(function ($query) use ($targetServer, $site) {
                    return $query->where('server_id', $targetServer->id)
                        ->where(function ($query) use ($site) {
                            if ($site) {
                                $query->where('site_id', $site->id);
                            }
                        });
                }),
            ],
            'command' => [
                'required',
            ],
            'user' => [
                'required',
                $isExternalSiteWorker
                    ? Rule::in([$site->user])
                    : Rule::in($site?->getSshUsers() ?? $targetServer->getSshUsers()),
            ],
            'auto_start' => [
                'required',
                'boolean',
            ],
            'auto_restart' => [
                'required',
                'boolean',
            ],
            'numprocs' => [
                'required',
                'numeric',
                'min:1',
            ],
            'environment' => [
                'sometimes',
                'nullable',
                'array',
                'max:100',
            ],
            ...UpdateWorkerEnvironment::nestedRules('environment'),
        ];

        if (isset($input['site_id']) && ! empty($input['site_id'])) {
            $rules['site_id'] = [
                'required',
                'integer',
                Rule::exists('sites', 'id')->where('server_id', $server->id),
            ];
        }

        Validator::make($input, $rules)->validate();
    }
}
