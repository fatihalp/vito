<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class SetLocale
{
    public function handle(Request $request, Closure $next): Response
    {
        $locale = $request->cookie('vito_locale', config('app.locale'));
        app()->setLocale(in_array($locale, ['en', 'tr'], true) ? $locale : 'en');

        return $next($request);
    }
}
