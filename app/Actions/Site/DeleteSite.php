<?php

namespace App\Actions\Site;

use App\Actions\CronJob\SyncCronJobs;
use App\Enums\CronjobStatus;
use App\Events\SiteDeletedEvent;
use App\Models\CronJob;
use App\Models\Site;
use App\Models\Worker;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Throwable;

class DeleteSite
{
    public function delete(Site $site, array $input): void
    {
        if ($site->isSelf()) {
            throw ValidationException::withMessages([
                'domain' => __('The Vito application site cannot be deleted.'),
            ]);
        }

        $this->validate($site, $input);
        $this->ensureSafeBasePath($site);

        if ($site->sourceControl && isset($site->type_data['deploy_key_id'])) {
            try {
                $site->sourceControl->provider()->deleteDeployKey(
                    $site->type_data['deploy_key_id'],
                    $site->repository,
                );
            } catch (Throwable $e) {
                Log::warning('Failed to delete deploy key from source control', [
                    'site_id' => $site->id,
                    'exception' => $e->getMessage(),
                ]);
            }
        }

        $site->webserver()->deleteSite($site);
        $this->deleteWorkersFromServer($site);
        $this->deleteCronJobsFromServer($site);

        $lastIsolatedUser = $site->userSharedWithSiblings() ? null : $site->isolatedUser;

        if ($lastIsolatedUser && ! in_array($lastIsolatedUser->username, [$site->server->getSshUser(), 'root'], true)) {
            $this->deleteIsolatedUserFromServer($site);
        }

        $this->deleteRow($site);

        $lastIsolatedUser?->delete();
    }

    private function deleteWorkersFromServer(Site $site): void
    {
        $site->workers()->with('server')->each(
            fn (Worker $worker) => $worker->server->processManager()?->handler()->delete($worker->id, $site->id)
        );
    }

    private function deleteCronJobsFromServer(Site $site): void
    {
        $users = $site->cronJobs()->distinct()->pluck('user')->all();

        if ($users === []) {
            return;
        }

        app(SyncCronJobs::class)->sync($site->server, $users);

        $site->cronJobs()->update(['status' => CronjobStatus::DELETING]);

        foreach ($users as $user) {
            $site->server->cron()->update($user, CronJob::crontab($site->server, $user));
        }
    }

    private function deleteIsolatedUserFromServer(Site $site): void
    {
        if ($site->type()->language() === 'php') {
            $site->server->php($site->php_version)?->handler()->removeFpmPool($site->user, $site->php_version, $site->id);
        }

        $site->server->os()->deleteIsolatedUser($site->user);
    }

    private function deleteRow(Site $site): void
    {
        $server = $site->server;
        $siteId = $site->id;
        $domain = $site->domain;

        $site->delete();

        SiteDeletedEvent::dispatch($server, $siteId, $domain);
    }

    private function ensureSafeBasePath(Site $site): void
    {
        if (! preg_match('#^/home/[A-Za-z0-9_][A-Za-z0-9_.-]*/'.preg_quote($site->domain, '#').'$#', $site->basePath())) {
            throw ValidationException::withMessages([
                'domain' => __('The site path does not match its expected location, so its files were not deleted.'),
            ]);
        }
    }

    private function validate(Site $site, array $input): void
    {
        Validator::make($input, [
            'domain' => [
                'required',
                Rule::in($site->domain),
            ],
        ])->validate();
    }
}
