<?php

namespace App\Actions\Server;

use App\Models\NetworkServer;
use App\Models\Project;
use App\Models\Server;
use App\Models\User;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class TransferServer
{
    
    public function transfer(User $user, Server $server, array $input): Server
    {
        $this->validate($user, $server, $input);

        $project = Project::query()->findOrFail($input['project_id']);
        Gate::forUser($user)->authorize('create', [Server::class, $project]);

        if ($server->project_id !== $project->id
            && NetworkServer::query()->where('server_id', $server->id)->exists()) {
            throw ValidationException::withMessages([
                'project_id' => 'Remove the server from its networks and wait for removal to complete before transferring it.',
            ]);
        }

        $server->project_id = $project->id;
        $server->save();

        return $server;
    }

    private function validate(User $user, Server $server, array $input): void
    {
        $rules = [
            'project_id' => [
                'required',
                Rule::in($user->allProjects()->pluck('id')->toArray()),
            ],
        ];

        Validator::make($input, $rules)->after(function ($validator) use ($server): void {
            if ($server->siteResources()->exists() || $server->sites()->whereHas('resources')->exists()) {
                $validator->errors()->add('project_id', __('Disconnect all site resources before transferring this server.'));
            }
        })->validate();
    }
}
