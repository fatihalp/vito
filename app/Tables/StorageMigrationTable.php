<?php

namespace App\Tables;

use App\Http\Resources\StorageMigrationResource;
use App\Models\StorageMigration;
use Forjed\InertiaTable\Column;
use Forjed\InertiaTable\Columns\ActionsColumn;
use Forjed\InertiaTable\Columns\BadgeColumn;
use Forjed\InertiaTable\Columns\ComponentColumn;
use Forjed\InertiaTable\Columns\DateTimeColumn;
use App\Tables\AbstractTable as Table;

class StorageMigrationTable extends Table
{
    protected array $tableSettings = ['realtime' => 'storage-migration'];

    protected function query(): void
    {
        $this->perPage = config('web.pagination_size');
        $this->query->with(['source', 'target'])->latest();
    }

    protected function columns(): array
    {
        return [
            Column::make('name', 'Name')
                ->link('storage-migrations.show', ['storageMigration' => ':id']),
            Column::make('source.profile', 'Source'),
            Column::make('target.profile', 'Target'),
            ComponentColumn::create('progress', 'Progress', 'StorageMigrationProgress')
                ->value(fn (StorageMigration $storageMigration) => $storageMigration->progress()),
            BadgeColumn::make('sync', 'Sync')
                ->value(fn (StorageMigration $storageMigration) => $storageMigration->isSyncing() ? 'syncing' : 'not syncing')
                ->colorField('sync_color'),
            BadgeColumn::make('status', 'Status')
                ->value(fn (StorageMigration $storageMigration) => $storageMigration->status->getText())
                ->colorField('status_color'),
            DateTimeColumn::make('created_at', 'Started')->sortable(),
            Column::data('status_color', fn (StorageMigration $storageMigration) => $storageMigration->status->getColor()),
            Column::data('sync_color', fn (StorageMigration $storageMigration) => $storageMigration->isSyncing() ? 'success' : 'gray'),
            Column::data('id'),
            Column::data('resource', fn (StorageMigration $storageMigration) => StorageMigrationResource::make($storageMigration)),
            ActionsColumn::make(),
        ];
    }
}
