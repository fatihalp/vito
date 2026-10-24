<?php

namespace App\Actions\Site;

use App\Jobs\Site\CleanupSiteStatsJob;
use App\Jobs\Site\WriteSiteStatsConfJob;
use App\Models\Site;
use Illuminate\Support\Facades\Validator;

class UpdateSiteStats
{
    /**
     * Validates the toggle input and returns the new state.
     */
    public function toggle(Site $site, array $input): bool
    {
        $validated = Validator::make($input, ['enabled' => ['required', 'boolean']])->validate();

        $validated['enabled'] ? $this->enable($site) : $this->disable($site);

        return (bool) $validated['enabled'];
    }

    public function disable(Site $site): void
    {
        $site->jsonUpdate('type_data', 'stats_disabled', true);

        if ($site->server->service('log_analysis')) {
            dispatch(new CleanupSiteStatsJob($site->server, $site->id));
        }
    }

    public function enable(Site $site): void
    {
        $site->jsonForget('type_data', 'stats_disabled');

        if ($site->server->service('log_analysis')) {
            dispatch(new WriteSiteStatsConfJob($site));
        }
    }
}
