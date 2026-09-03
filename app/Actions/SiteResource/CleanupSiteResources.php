<?php

namespace App\Actions\SiteResource;

use App\Models\Site;
use App\Models\SiteResource;

class CleanupSiteResources
{
    public function cleanup(Site $site): void
    {
        $site->resources()->get()->each(function (SiteResource $resource): void {
            app(DisconnectSiteResource::class)->disconnect(
                $resource,
                restoreEnvironment: false,
                removeProvisioned: false,
            );
        });
    }
}
