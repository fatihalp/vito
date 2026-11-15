<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Validation\ValidationException;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureRouteResourceOwnership
{
    public function handle(Request $request, Closure $next): Response
    {
        $resources = array_filter($request->route()->parameters(), fn (mixed $value): bool => $value instanceof Model);

        $parents = [];

        foreach ($resources as $name => $resource) {
            foreach (array_reverse($parents) as $parent) {
                $foreignKey = $parent->getForeignKey();

                if ($resource === $parent || ! array_key_exists($foreignKey, $resource->getAttributes())) {
                    continue;
                }

                if ((string) $resource->getAttribute($foreignKey) !== (string) $parent->getKey()) {
                    throw ValidationException::withMessages([
                        $name => 'The selected resource does not belong to the requested parent. No action was performed.',
                    ]);
                }

                break;
            }

            $parents[] = $resource;
        }

        return $next($request);
    }
}
