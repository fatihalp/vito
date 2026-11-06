<?php

namespace App\Actions\RuntimeProcess;

use App\Models\RuntimeProcess;
use App\Models\Server;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

class RegisterRuntimeProcess
{
    public function register(Server $server, array $input): RuntimeProcess
    {
        $data = Validator::make($input, [
            'label' => ['required', 'string', 'max:160'],
            'driver' => ['required', Rule::in(['systemd', 'docker', 'supervisor'])],
            'runtime_name' => ['required', 'string', 'max:128', 'regex:/^[A-Za-z0-9][A-Za-z0-9_.@:-]*$/', Rule::notIn(($input['driver'] ?? '') === 'supervisor' ? ['all'] : [])],
            'kind' => ['required', Rule::in(['worker', 'scheduler', 'service'])],
            'site_ids' => ['sometimes', 'array', 'max:100'],
            'site_ids.*' => ['integer', 'distinct', Rule::exists('sites', 'id')->where('server_id', $server->id)],
        ])->validate();

        return DB::transaction(function () use ($server, $data): RuntimeProcess {
            $process = RuntimeProcess::query()->updateOrCreate(
                ['server_id' => $server->id, 'driver' => $data['driver'], 'runtime_name' => $data['runtime_name']],
                ['label' => $data['label'], 'kind' => $data['kind']],
            );
            $process->sites()->sync($data['site_ids'] ?? []);

            return $process;
        });
    }
}
