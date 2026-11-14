<?php

declare(strict_types=1);

namespace App\Actions\CronJob;

use App\Enums\CronjobStatus;
use App\Models\CronJob;
use App\Models\Server;
use App\Models\Site;
use Illuminate\Support\Facades\Validator;

class EditCronJob
{
    public function edit(Server $server, CronJob $cronJob, array $input, ?Site $site = null): CronJob
    {
        Validator::make($input, CreateCronJob::rules($input, $server, $site))->validate();

        $originalUser = $cronJob->user;
        $attributes = CreateCronJob::attributes($input, $site);

        if (! $site && ! array_key_exists('site_id', $input)) {
            $attributes['site_id'] = $cronJob->site_id;
        }

        app(SyncCronJobs::class)->sync($server, [$originalUser, $attributes['user']]);

        $cronJob->update([...$attributes, 'status' => CronjobStatus::UPDATING]);

        if ($originalUser !== $cronJob->user) {
            app(SyncCronJobs::class)->write($server, $originalUser);
        }

        app(SyncCronJobs::class)->write($server, $cronJob->user);
        $cronJob->update(['status' => CronjobStatus::READY]);

        return $cronJob;
    }
}
