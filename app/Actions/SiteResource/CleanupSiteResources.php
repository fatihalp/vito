<?php

namespace App\Actions\SiteResource;

use App\Models\Site;
use App\Models\SiteResource;

class CleanupSiteResources
{
    /**
     * Unlinks the site's resources without dropping provisioned databases and database users,
     * so deleting a site never destroys its data.
     */
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
