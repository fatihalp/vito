<?php

namespace App\Tables;

use Forjed\InertiaTable\Column;
use Forjed\InertiaTable\Columns\DateTimeColumn;
use Forjed\InertiaTable\Columns\EnumColumn;
use App\Tables\AbstractTable as Table;

class WorkflowRunTable extends Table
{
    protected array $tableSettings = ['realtime' => 'workflow-run'];

    protected function query(): void
    {
        $this->perPage = config('web.pagination_size');
        $this->query->latest();
    }

    protected function columns(): array
    {
        return [
            DateTimeColumn::make('created_at', 'Created at')->sortable()->toLocal(),
            EnumColumn::make('status', 'Status')->sortable(),
            Column::make('id', 'ID')->sortable(),
            Column::data('workflow_id'),
        ];
    }
}
