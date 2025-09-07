<?php

namespace App\Actions\Redirect;

use App\Contracts\Actions\Redirect\DeleteRedirect as DeleteRedirectContract;
use App\Enums\RedirectStatus;
use App\Models\Redirect;
use App\Models\Service;
use App\Models\Site;
use App\Services\Webserver\Webserver;

class DeleteRedirect implements DeleteRedirectContract
{
    public function delete(Site $site, Redirect $redirect): void
    {
        $redirect->status = RedirectStatus::DELETING;
        $redirect->save();

        dispatch(function () use ($site, $redirect): void {
            /** @var Service $service */
            $service = $site->server->webserver();
            /** @var Webserver $webserver */
            $webserver = $service->handler();
            $webserver->updateVHost($site, regenerate: [
                'redirects',
            ]);
            $redirect->delete();
        })->catch(function () use ($redirect): void {
            $redirect->status = RedirectStatus::FAILED;
            $redirect->save();
        })->onQueue('ssh-unique');
    }
}
