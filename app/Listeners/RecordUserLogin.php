<?php

namespace App\Listeners;

use App\Helpers\Agent;
use App\Models\User;
use Illuminate\Auth\Events\Login;

class RecordUserLogin
{
    public function handle(Login $event): void
    {
        if (! $event->user instanceof User) {
            return;
        }

        $request = request();
        $agent = new Agent;
        $agent->setUserAgent($request->userAgent() ?? '');

        User::query()->whereKey($event->user->getKey())->toBase()->update([
            'last_login_at' => now(),
            'last_activity_at' => now(),
            'last_login_browser' => $agent->browser(),
            'last_login_language' => substr(str_replace('_', '-', $request->getLanguages()[0] ?? ''), 0, 100) ?: null,
            'last_login_user_agent' => mb_substr($request->userAgent() ?? '', 0, 2048) ?: null,
        ]);
    }
}
