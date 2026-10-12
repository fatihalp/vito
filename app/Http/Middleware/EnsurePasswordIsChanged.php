<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsurePasswordIsChanged
{
    private const ALLOWED_ROUTES = [
        'profile',
        'profile.password',
        'user-password.update',
        'logout',
    ];

    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user && $user->must_change_password && ! in_array($request->route()?->getName(), self::ALLOWED_ROUTES, true)) {
            if ($request->expectsJson()) {
                return response()->json(['message' => 'You must change your password before continuing.'], 403);
            }

            return redirect()->route('profile')->with('warning', 'You must change your password before continuing.');
        }

        return $next($request);
    }
}
