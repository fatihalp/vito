<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class HasProjectMiddleware
{
    public function handle(Request $request, Closure $next): mixed
    {
        
        $user = $request->user();
        if (! $user) {
            return $next($request);
        }

        if (! $user->currentProject) {
            $hasProjects = $user->relationLoaded('projects')
                ? $user->projects->isNotEmpty()
                : $user->projects()->exists();

            if ($hasProjects) {
                $user->ensureHasDefaultProject();
                $user->refresh();

                return redirect()->route('overview');
            }

            abort(403, 'You must have a project to access the panel.');
        }

        return $next($request);
    }
}
