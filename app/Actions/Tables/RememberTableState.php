<?php

namespace App\Actions\Tables;

use App\Http\Middleware\ResolveCurrentProject;
use Illuminate\Http\Request;

class RememberTableState
{
    public function restoreUrl(Request $request): ?string
    {
        if ($request->hasHeader('X-Vito-Table-Navigation') || array_diff(array_keys($request->query()), ['project']) !== []) {
            return null;
        }

        $query = $request->session()->get($this->sessionKey($request), []);

        return $query === [] ? null : $request->fullUrlWithQuery($query);
    }

    public function remember(Request $request, array $props): void
    {
        foreach ($props as $prop) {
            if (is_array($prop) && isset($prop['data'], $prop['meta']['current_page'])) {
                $query = array_filter($request->query(), fn (string $key): bool => $this->isTableParameter($key), ARRAY_FILTER_USE_KEY);

                $request->session()->put($this->sessionKey($request), $query);

                return;
            }
        }
    }

    public function lastPageUrl(array $props): ?string
    {
        foreach ($props as $prop) {
            if (is_array($prop) && isset($prop['meta']['current_page'], $prop['meta']['last_page'])
                && $prop['meta']['current_page'] > $prop['meta']['last_page']) {
                return $prop['links']['last'] ?? null;
            }
        }

        return null;
    }

    private function sessionKey(Request $request): string
    {
        $identity = implode(':', [
            $request->user()->getAuthIdentifier(),
            $request->attributes->get(ResolveCurrentProject::SCOPE_ATTRIBUTE),
            $request->path(),
        ]);

        return 'table_state.'.hash('sha256', $identity);
    }

    private function isTableParameter(string $key): bool
    {
        return in_array($key, [
            'search', 'sort', 'sort_by', 'sort_dir', 'page', 'per_page', 'perPage',
            'provider', 'project_id', 'user_id', 'group_by', 'php_status', 'git_status',
        ], true) || preg_match('/^[a-zA-Z][a-zA-Z0-9_]*(Search|Sort|Page|PerPage)$/D', $key) === 1;
    }
}
