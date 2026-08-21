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

        return [
            'php_version' => count($phpVersions) === 1 ? $phpVersions[0] : null,
            'source_control_id' => $lastSourceControlId ?? $this->soleSourceControlId($server, $user),
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
