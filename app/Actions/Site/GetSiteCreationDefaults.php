<?php

namespace App\Actions\Site;

use App\Models\Server;

class GetSiteCreationDefaults
{
    
    public function get(Server $server): array
    {
        $phpVersions = $server->installedPHPVersions();

        $lastSourceControlId = $server->sites()
            ->whereNotNull('source_control_id')
            ->latest('id')
            ->value('source_control_id');

        return [
            'php_version' => count($phpVersions) === 1 ? $phpVersions[0] : null,
            'source_control_id' => $lastSourceControlId,
        ];
    }
}
