<?php

namespace App\Actions\User;

use App\Models\User;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\Validator;

class SearchUsers
{
    public function search(array $input, int $limit = 10): Collection
    {
        $validated = Validator::make($input, [
            'query' => ['nullable', 'string', 'max:255'],
        ])->validate();

        $search = trim($validated['query'] ?? '');

        return User::query()
            ->when($search !== '', fn ($query) => $query->where(fn ($q) => $q
                ->where('name', 'like', "%{$search}%")
                ->orWhere('email', 'like', "%{$search}%")))
            ->with(['projects' => fn ($query) => $query->withCount(['servers', 'sites'])])
            ->take($limit)
            ->get();
    }
}
