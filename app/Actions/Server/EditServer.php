<?php

namespace App\Actions\Server;

use App\Actions\Network\ResyncServerEndpoint;
use App\Actions\SiteResource\RefreshServerResourceConnections;
use App\Enums\ServerRole;
use App\Models\Server;
use App\ValidationRules\RestrictedIPAddressesRule;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class EditServer
{
    public function __construct(
        private ResyncServerEndpoint $resync,
        private RefreshServerResourceConnections $resources,
    ) {}

    /**
     * @param  array<string, mixed>  $input
     * @return Server $server
     *
     * @throws ValidationException
     */
    public function edit(Server $server, array $input): Server
    {
        $this->validate($server, $input);

        $checkConnection = false;
        $ipChanged = false;
        $endpointChanged = false;
        if (isset($input['name'])) {
            $server->name = $input['name'];
        }
        if (isset($input['role'])) {
            $this->guardRoleChange($server, ServerRole::from($input['role']));
            $server->role = ServerRole::from($input['role']);
        }
        if (isset($input['ip'])) {
            if ($server->ip !== $input['ip']) {
                $checkConnection = true;
                $ipChanged = true;
                $endpointChanged = true;
            }
            $server->ip = $input['ip'];
        }
        if (isset($input['local_ip'])) {
            $endpointChanged = $endpointChanged || $server->local_ip !== $input['local_ip'];
            $server->local_ip = $input['local_ip'];
        }
        if (isset($input['port'])) {
            if ($server->port !== $input['port']) {
                $checkConnection = true;
            }
            $server->port = $input['port'];
        }
        if (isset($input['stage'])) {
            $server->stage = $input['stage'];
        }
        $server->save();

        if ($ipChanged) {
            $this->resync->handle($server);
        }

        if ($endpointChanged || array_key_exists('ip', $input) || array_key_exists('local_ip', $input)) {
            $this->resources->refresh($server);
        }

        if ($checkConnection) {
            return $server->checkConnection();
        }

        return $server;
    }

    private function validate(Server $server, array $input): void
    {
        $rules = [
            'name' => [
                'sometimes',
                'required',
                'max:255',
                Rule::unique('servers')->where('project_id', $server->project_id)->ignore($server->id),
            ],
            'role' => [
                'sometimes',
                'required',
                Rule::enum(ServerRole::class),
            ],
            'stage' => [
                'sometimes',
                'required',
                Rule::in(['prod', 'beta', 'alfa']),
            ],
            'ip' => [
                'string',
                'ip',
                new RestrictedIPAddressesRule,
                Rule::unique('servers')->where('project_id', $server->project_id)->ignore($server->id),
            ],
            'local_ip' => [
                'nullable',
                'string',
                'ip',
                Rule::unique('servers')->where('project_id', $server->project_id)->ignore($server->id),
            ],
            'port' => [
                'integer',
                'min:1',
                'max:65535',
            ],
        ];

        Validator::make($input, $rules)->validate();
    }

    private function guardRoleChange(Server $server, ServerRole $role): void
    {
        if ($server->role === $role) {
            return;
        }

        if ($server->siteResources()->exists()) {
            throw ValidationException::withMessages([
                'role' => __('Disconnect this server from all sites before changing its type.'),
            ]);
        }

        if ($role !== ServerRole::APP && $server->sites()->exists()) {
            throw ValidationException::withMessages([
                'role' => __('Move or delete this server\'s sites before changing it to a dedicated resource server.'),
            ]);
        }

        $requiredServices = match ($role) {
            ServerRole::APP => ['webserver'],
            ServerRole::QUEUE => ['php', 'process_manager'],
            ServerRole::DATABASE => ['database'],
            ServerRole::CACHE => ['memory_database'],
        };

        foreach ($requiredServices as $requiredService) {
            if (! $server->services()->where('type', $requiredService)->exists()) {
                throw ValidationException::withMessages([
                    'role' => __('Install the required services before selecting this server type.'),
                ]);
            }
        }
    }
}
