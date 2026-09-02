<?php

namespace App\Actions\Site;

use App\Events\SiteDeletedEvent;
use App\Exceptions\SSHError;
use App\Models\Service;
use App\Models\Site;
use App\Services\PHP\PHP;
use Illuminate\Contracts\Cache\LockTimeoutException;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Throwable;

class DeleteSite
{
    
    public function delete(Site $site, array $input): void
    {
        $this->validate($site, $input);

        $force = (bool) ($input['force'] ?? false);

        if ($site->sourceControl && isset($site->type_data['deploy_key_id'])) {
            $this->step($site, $force, 'delete-deploy-key', fn () => $site->sourceControl->provider()->deleteDeployKey(
                $site->type_data['deploy_key_id'],
                $site->repository,
            ));
        }

        if (! $site->isIsolated()) {
            $this->step($site, $force, 'delete-vhost', fn () => $site->webserver()->deleteSite($site));
            $this->deleteRow($site);

            return;
        }

        $iuser = $site->isolatedUser;
        $lock = $iuser->lock();

        try {
            $lock->block(30);
        } catch (LockTimeoutException) {
            throw ValidationException::withMessages([
                'domain' => "Another operation on isolated user '{$site->user}' is in progress, please retry.",
            ]);
        }

        try {
            $this->step($site, $force, 'delete-vhost', fn () => $site->webserver()->deleteSite($site));

            if ($site->type()->language() === 'php' && ! $site->fpmPoolSharedWithSiblings()) {
                
                $phpService = $site->server->php();
                
                $php = $phpService->handler();
                $this->step($site, $force, 'remove-fpm-pool', fn () => $php->removeFpmPool($site->user, $site->php_version, $site->id));
            }

            $isLastSibling = ! $site->userSharedWithSiblings();

            if ($isLastSibling) {
                $this->step($site, $force, 'delete-isolated-user', fn () => $site->server->os()->deleteIsolatedUser($site->user));
            }

            $this->deleteRow($site);

            if ($isLastSibling) {
                $iuser?->delete();
            }
        } finally {
            $lock->release();
        }
    }

    /**
     * Runs a teardown step, swallowing failures when the site is force deleted.
     */
    private function step(Site $site, bool $force, string $name, callable $callback): void
    {
        try {
            $callback();
        } catch (Throwable $e) {
            if (! $force) {
                throw $e;
            }

            Log::warning('Site teardown step failed, continuing with force delete', [
                'site_id' => $site->id,
                'server_id' => $site->server_id,
                'step' => $name,
                'exception' => $e->getMessage(),
            ]);
        }
    }

    
    private function deleteRow(Site $site): void
    {
        $server = $site->server;
        $siteId = $site->id;
        $domain = $site->domain;

        try {
            $site->delete();
        } catch (Throwable $e) {
            Log::error('Site row deletion failed after isolated teardown', [
                'site_id' => $site->id,
                'server_id' => $site->server_id,
                'user' => $site->user,
                'exception' => $e->getMessage(),
            ]);

            throw $e;
        }

        SiteDeletedEvent::dispatch($server, $siteId, $domain);
    }

    
    private function validate(Site $site, array $input): void
    {
        Validator::make($input, [
            'domain' => [
                'required',
                Rule::in($site->domain),
            ],
            'force' => [
                'nullable',
                'boolean',
            ],
        ])->validate();
    }
}
