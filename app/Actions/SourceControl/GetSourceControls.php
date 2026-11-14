<?php

namespace App\Actions\SourceControl;

use App\Helpers\QueryBuilder;
use App\Actions\Projects\GetProjectScope;
use App\Models\SourceControl;
use App\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\Validator;

class GetSourceControls
{
    public function get(User $user, array $input): LengthAwarePaginator
    {
        $input = Validator::make($input, [
            'search' => ['nullable', 'string', 'max:255'],
            'provider' => ['nullable', 'string', 'max:100'],
            'project_id' => ['nullable', 'regex:/^(all|global|[0-9]+)$/'],
            'user_id' => ['nullable', 'regex:/^(all|[0-9]+)$/'],
        ])->validate();

        $query = SourceControl::query()
            ->where(fn ($query) => $query->whereIn('project_id', app(GetProjectScope::class)->ids($user))->orWhereNull('project_id'))
            ->when(! $user->isAdmin(), fn ($query) => $query->where('user_id', $user->id))
            ->with(['user', 'project' => fn ($query) => $query->forResource($user)]);

        $provider = $input['provider'] ?? null;
        if ($provider && $provider !== 'all') {
            $query->where('provider', $provider);
        }

        if ($projectId = $input['project_id'] ?? null) {
            if ($projectId === 'global') {
                $query->whereNull('project_id');
            } elseif ($projectId !== 'all') {
                $query->where('project_id', (int) $projectId);
            }
        }

        $userId = $input['user_id'] ?? null;
        if ($userId && $userId !== 'all') {
            $query->where('user_id', (int) $userId);
        }

        if ($search = $input['search'] ?? null) {
            $query->where(function ($q) use ($search) {
                $q->where('profile', 'like', "%{$search}%")
                    ->orWhere('provider', 'like', "%{$search}%")
                    ->orWhere('external_identifier', 'like', "%{$search}%")
                    ->orWhereHas('user', fn ($u) => $u->where('name', 'like', "%{$search}%")->orWhere('email', 'like', "%{$search}%"))
                    ->orWhereHas('project', fn ($p) => $p->where('name', 'like', "%{$search}%"));
            });
        }

        return QueryBuilder::for($query)
            ->sortable('created_at', 'desc', [
                'name' => 'profile',
                'global' => 'project_id',
            ])
            ->paginate(pageName: 'sourceControlsPage');
    }
}
