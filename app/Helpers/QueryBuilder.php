<?php

namespace App\Helpers;

use Illuminate\Contracts\Database\Eloquent\Builder;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Contracts\Pagination\Paginator;
use Illuminate\Database\Eloquent\Relations\Relation;

class QueryBuilder
{
    protected array $searchableFields = [];

    protected ?string $sortBy = null;

    protected ?string $sortDir = null;

    protected array $columnMap = [];

    public function __construct(public Builder|Relation $query) {}

    public static function for(Builder|Relation $query): self
    {
        return new self($query);
    }

    public function searchableFields(array $fields): self
    {
        $this->searchableFields = $fields;

        return $this;
    }

    public function sortable(?string $defaultSortBy = null, ?string $defaultSortDir = null, array $columnMap = []): self
    {
        $this->columnMap = $columnMap;

        if (request()->has('sort_by') && request()->has('sort_dir')) {
            $sortBy = (string) request('sort_by');
            $sortDir = (string) request('sort_dir');

            $dir = strtolower($sortDir) === 'asc' ? 'asc' : 'desc';

            $this->sortBy = $this->columnMap[$sortBy] ?? $sortBy;
            $this->sortDir = $dir;
        } elseif ($defaultSortBy && $defaultSortDir) {
            $this->sortBy = $this->columnMap[$defaultSortBy] ?? $defaultSortBy;
            $this->sortDir = strtolower($defaultSortDir) === 'asc' ? 'asc' : 'desc';
        }

        return $this;
    }

    public function resolvePerPage(?string $pageName = null, int $default = 10): int
    {
        $pageParam = $pageName ? "{$pageName}PerPage" : 'per_page';
        $requested = (int) (request()->input($pageParam) ?? request()->input('per_page') ?? request()->input('perPage'));

        if (in_array($requested, [10, 25, 50], true)) {
            return $requested;
        }

        return (int) config('web.pagination_size', $default);
    }

    public function simplePaginate(int|null $perPage = null, ?string $pageName = 'page'): Paginator
    {
        $resolvedPerPage = $perPage ?? $this->resolvePerPage($pageName);

        return $this->query()->simplePaginate($resolvedPerPage, pageName: $pageName)->appends(request()->query());
    }

    public function paginate(int|null $perPage = null, ?string $pageName = 'page'): LengthAwarePaginator
    {
        $resolvedPerPage = $perPage ?? $this->resolvePerPage($pageName);

        return $this->query()->paginate($resolvedPerPage, pageName: $pageName)->appends(request()->query());
    }

    public function query(): Builder|Relation
    {
        $this->query->where(function ($query) {
            if (request()->has('search') && ! empty(request('search'))) {
                $search = request('search');
                $query->where(function ($q) use ($search) {
                    foreach ($this->searchableFields as $field) {
                        $q->orWhere($field, 'like', '%'.$search.'%');
                    }
                });
            }
        });

        if ($this->sortBy && $this->sortDir) {
            $this->query->orderBy($this->sortBy, $this->sortDir);
        }

        return $this->query;
    }
}
