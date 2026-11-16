<?php

namespace App\Actions\RuntimeProcess;

use App\Http\Resources\RuntimeProcessResource;
use App\Models\RuntimeProcess;
use App\Models\Server;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Validator;

class ListRuntimeProcesses
{
    public function list(Server $server, array $input): array
    {
        $filters = Validator::make($input, [
            'site_id' => ['nullable', 'integer'],
            'kind' => ['nullable', 'in:worker,scheduler,service'],
        ])->validate();

        $processes = RuntimeProcess::query()
            ->where('server_id', $server->id)
            ->with('sites:id,domain')
            ->when(
                ! empty($filters['site_id']),
                fn ($query) => $query->whereHas('sites', fn ($sites) => $sites->where('sites.id', $filters['site_id'])),
            )
            ->when(! empty($filters['kind']), fn ($query) => $query->where('kind', $filters['kind']))
            ->orderBy('kind')
            ->orderBy('label')
            ->limit(500)
            ->get();
        $canManage = Gate::allows('create', [RuntimeProcess::class, $server]);

        return [
            'processes' => RuntimeProcessResource::collection($processes),
            'sites' => $server->sites()->orderBy('domain')->get(['id', 'domain']),
            'can_manage' => $canManage,
            'isolated_users' => $canManage ? $server->isolatedUsers()->orderBy('username')->pluck('username') : [],
        ];
    }
}
