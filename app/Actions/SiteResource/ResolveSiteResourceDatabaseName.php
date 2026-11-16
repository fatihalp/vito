<?php

namespace App\Actions\SiteResource;

use App\Models\SiteResource;

class ResolveSiteResourceDatabaseName
{
    public function resolve(SiteResource $resource): string
    {
        return $resource->configuration['database_name']
            ?? $resource->environment['DB_DATABASE']
            ?? 'Database';
    }
}
