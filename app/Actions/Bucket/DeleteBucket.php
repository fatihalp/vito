<?php

namespace App\Actions\Bucket;

use App\Actions\SiteResource\DisconnectSiteResource;
use App\Models\Bucket;
use App\Models\SiteResource;

class DeleteBucket
{
    public function delete(Bucket $bucket): void
    {
        $bucket->siteResources()->with('site.server')->get()->each(function (SiteResource $resource): void {
            app(DisconnectSiteResource::class)->disconnect($resource);
        });

        $bucket->delete();
    }
}
