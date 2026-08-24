<?php

namespace App\Actions\Site;

use App\Models\Server;
use App\Models\SourceControl;
use App\Models\User;

class GetSiteCreationDefaults
{
    
    public function get(Server $server, User $user): array
    {
        $phpVersions = $server->installedPHPVersions();

        $lastSourceControlId = $server->sites()
            ->whereNotNull('source_control_id')
            ->latest('id')
            ->value('source_control_id');

        $isAdmin = method_exists($user, 'isAdmin') && $user->isAdmin();
        $serversQuery = $isAdmin ? Server::query() : ($server->project?->servers() ?? Server::query());
        $dbServers = $serversQuery
            ->where(function ($q) use ($server) {
                $q->where('role', \App\Enums\ServerRole::DATABASE->value)
                  ->orWhere('id', $server->id);
            })
            ->whereIn('status', ['ready', 'updating'])
            ->get(['id', 'name', 'ip', 'role'])
            ->filter(fn ($s) => $s->database() !== null || $s->role === \App\Enums\ServerRole::DATABASE)
            ->map(fn ($s) => [
                'id' => $s->id,
                'name' => $s->name,
                'ip' => $s->ip,
                'role' => $s->role->value,
                'is_current' => $s->id === $server->id,
            ])
            ->values()
            ->toArray();

        return [
            'php_version' => count($phpVersions) === 1 ? $phpVersions[0] : null,
            'source_control_id' => $lastSourceControlId ?? $this->soleSourceControlId($server, $user),
            'has_database' => $server->database() !== null,
            'database_servers' => $dbServers,
        ];
    }

    
    private function soleSourceControlId(Server $server, User $user): ?int
    {
        if ($server->project_id === null) {
            return null;
        }

        $sourceControls = SourceControl::getByProjectId($server->project_id, $user)->get(['id']);

        return $sourceControls->count() === 1 ? $sourceControls->first()->id : null;
    }
}
