<?php

namespace App\Actions\RuntimeProcess;

use App\Models\RuntimeProcess;
use App\Models\Server;
use App\Services\RuntimeProcess\RuntimeCommand;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

class RegisterRuntimeProcess
{
    public function register(Server $server, array $input): RuntimeProcess
    {
        $data = Validator::make($input, [
            'label' => ['required', 'string', 'max:160'],
            'driver' => ['required', Rule::in(RuntimeCommand::DRIVERS)],
            'unix_user' => ['nullable', 'string', 'max:32'],
            'runtime_name' => ['required', 'string', 'max:128', 'regex:/^[A-Za-z0-9][A-Za-z0-9_.@:-]*$/', Rule::notIn(($input['driver'] ?? '') === 'supervisor' ? ['all'] : [])],
            'kind' => ['required', Rule::in(['worker', 'scheduler', 'service'])],
            'site_ids' => ['sometimes', 'array', 'max:100'],
            'site_ids.*' => ['integer', 'distinct', Rule::exists('sites', 'id')->where('server_id', $server->id)],
        ])->validate();

        $data['unix_user'] = $data['unix_user'] ?? '';
        $commands = app(RuntimeCommand::class);
        $commands->validateContext($server, $data['driver'], $data['unix_user']);
        $commands->validateName($data['driver'], $data['runtime_name']);
        if (RuntimeCommand::usesUser($data['driver'])) {
            $commands->prefix($server, $data['driver'], $data['unix_user']);
        }

        return DB::transaction(function () use ($server, $data): RuntimeProcess {
            $process = RuntimeProcess::query()->updateOrCreate(
                ['server_id' => $server->id, 'driver' => $data['driver'], 'runtime_name' => $data['runtime_name'], 'unix_user' => $data['unix_user']],
                ['label' => $data['label'], 'kind' => $data['kind']],
            );
            $process->sites()->sync($data['site_ids'] ?? []);

            return $process;
        });
    }
}
