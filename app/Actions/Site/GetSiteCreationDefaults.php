<?php

namespace App\Actions\Site;

use App\Models\Server;
use App\Models\SourceControl;
use App\Models\User;

class GetSiteCreationDefaults
{
    
    /**
     * @return array{
     * php_version: string|null,
     * source_control_id: int|null
     * }
     */
    public function get(Server $server, ?User $user = null): array
    {
        $phpVersions = $server->installedPHPVersions();

        $lastSourceControlId = $server->sites()
            ->whereNotNull('source_control_id')
            ->whereIn('source_control_id', SourceControl::usableForServer($server, $user)->select('id'))
            ->latest('id')
            ->value('source_control_id');

        return [
            'php_version' => count($phpVersions) === 1 ? $phpVersions[0] : null,
            'source_control_id' => $lastSourceControlId ?? $this->soleSourceControlId($server, $user),
        ];
    }

    
    private function soleSourceControlId(Server $server, ?User $user = null): ?int
    {
        $ids = SourceControl::usableForServer($server, $user)->limit(2)->pluck('id');

        return $ids->count() === 1 ? $ids->first() : null;
    }
}
