<?php

namespace App\Actions\Database;

use App\Enums\SiteResourceType;
use App\Models\Server;
use App\Models\SiteResource;
use App\Models\User;
use Illuminate\Support\Facades\Gate;

class ListRegisteredContainerDatabases
{
    public function get(Server $server, User $user): array
    {
        $resources = SiteResource::query()->where('server_id', $server->id)
            ->where('type', SiteResourceType::DATABASE)
            ->whereHas('site.server', fn ($query) => $query->when(! $user->isAdmin(), fn ($query) => $query->where('project_id', $server->project_id)))
            ->with('site.server.project')->get();
        $databases = [];

        foreach ($resources as $resource) {
            $configuration = $resource->configuration;
            if (($configuration['runtime']['driver'] ?? null) !== 'docker') {
                continue;
            }
            $name = $configuration['database_name'] ?? '';
            $container = $configuration['runtime']['container'] ?? '';
            $key = $container.'|'.$name;
            $databases[$key] ??= ['name' => $name, 'container' => $container, 'applications' => []];
            $databases[$key]['applications'][] = [
                'domain' => $resource->site->domain,
                'browse_url' => url("/servers/{$resource->site->server_id}/sites/{$resource->site_id}/resources/{$resource->id}/browse"),
                'resources_url' => url("/servers/{$resource->site->server_id}/sites/{$resource->site_id}/resources"),
                'can_browse' => Gate::forUser($user)->allows('revealCredentials', [$resource, $resource->site, $resource->site->server]),
            ];
        }

        return array_values($databases);
    }
}
