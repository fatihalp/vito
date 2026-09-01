<?php

namespace App\Tables;

use Forjed\InertiaTable\Table as BaseTable;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Contracts\Pagination\Paginator;

abstract class AbstractTable extends BaseTable
{
    protected string $paginationMethod = 'full';

    public function getPerPageParam(): string
    {
        return $this->identifier ? "{$this->identifier}PerPage" : 'per_page';
    }

    public function resolvePerPage(): int
    {
        $param = $this->getPerPageParam();
        $requested = (int) (request()->input($param) ?? request()->input('per_page') ?? request()->input('perPage'));

        if (in_array($requested, [10, 25, 50], true)) {
            return $requested;
        }

        return $this->perPage ?? (int) config('web.pagination_size', 25);
    }

    protected function paginateQuery(): Paginator|LengthAwarePaginator
    {
        $this->perPage = $this->resolvePerPage();

        return parent::paginateQuery();
    }
}
