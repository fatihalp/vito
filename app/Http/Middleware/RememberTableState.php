<?php

namespace App\Http\Middleware;

use App\Actions\Tables\RememberTableState as TableState;
use Closure;
use Illuminate\Contracts\View\View;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response as HttpResponse;
use Symfony\Component\HttpFoundation\Response;

class RememberTableState
{
    public function __construct(private TableState $tableState) {}

    public function handle(Request $request, Closure $next): Response
    {
        if (! $request->isMethod('GET') || ! $request->user()) {
            return $next($request);
        }

        if ($url = $this->tableState->restoreUrl($request)) {
            return redirect()->to($url);
        }

        $response = $next($request);

        if (! $response->isSuccessful()) {
            return $response;
        }

        $props = [];
        if ($response instanceof JsonResponse && $response->headers->has('X-Inertia')) {
            $props = $response->getData(true)['props'] ?? [];
        } elseif ($response instanceof HttpResponse && $response->getOriginalContent() instanceof View) {
            $props = $response->getOriginalContent()->getData()['page']['props'] ?? [];
        }

        $this->tableState->remember($request, $props);

        if ($url = $this->tableState->lastPageUrl($props)) {
            return redirect()->to($url);
        }

        return $response;
    }
}
