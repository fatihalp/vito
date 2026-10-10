<?php

namespace App\Http\Middleware;

use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class TrackUserActivity
{
    private const int THROTTLE_SECONDS = 60;

    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        $user = $request->user();

        if (
            $user instanceof User
            && ! $request->isMethodSafe()
            && (! $user->last_activity_at || $user->last_activity_at->diffInSeconds(now(), true) >= self::THROTTLE_SECONDS)
        ) {
            User::query()->whereKey($user->getKey())->toBase()->update(['last_activity_at' => now()]);
        }

        return $response;
    }
}
