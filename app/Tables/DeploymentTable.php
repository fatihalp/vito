<?php

namespace App\Tables;

use App\Http\Resources\ServerLogResource;
use App\Models\Deployment;
use Forjed\InertiaTable\Column;
use Forjed\InertiaTable\Columns\ActionsColumn;
use Forjed\InertiaTable\Columns\DateTimeColumn;
use Forjed\InertiaTable\Columns\EnumColumn;
use Forjed\InertiaTable\Columns\TextColumn;
use App\Tables\AbstractTable as Table;

class DeploymentTable extends Table
{
    protected array $tableSettings = ['realtime' => 'deployment'];

    protected string $defaultSort = '-created_at';

    private bool $overview = false;

    
    public function overview(): array
    {
        $this->overview = true;
        $columns = $this->columns();
        $data = $this->toCollection(3)->all();

        return [
            'columns' => array_map(fn (Column $column) => $column->toArray(), $columns),
            'data' => $data,
            'links' => ['first' => null, 'last' => null, 'prev' => null, 'next' => null],
            'meta' => [
                'current_page' => 1,
                'current_page_url' => request()->url(),
                'from' => $data === [] ? null : 1,
                'path' => request()->url(),
                'per_page' => 3,
                'to' => $data === [] ? null : count($data),
            ],
            'searchable' => false,
            'searchDebounce' => config('inertia-table.search_debounce', 300),
            'identifier' => null,
            'tableSettings' => $this->tableSettings,
        ];
    }

    protected function query(): void
    {
        $this->perPage = config('web.pagination_size');
        $this->query->with('log', 'site', 'user', 'rolledBackBy');

        if ($this->overview) {
            $this->query->latest();
        }
    }

    protected function columns(): array
    {
        return [
            Column::make('commit', 'Commit'),
            Column::make('deployed_by', 'Deployed By')
                ->value(fn (Deployment $deployment): ?string => $deployment->user?->name),
            DateTimeColumn::make('created_at', 'Deployed At')->sortable(! $this->overview)->toLocal(),
            EnumColumn::make('status', 'Status')->sortable(! $this->overview),
            Column::make('release', 'Release'),
            TextColumn::make('id', 'ID')
                ->sortable(! $this->overview)
                ->link('application.deployments.show', [
                    'server' => ':server_id',
                    'site' => ':site_id',
                    'deployment' => ':id',
                ]),
            Column::data('site_id'),
            Column::data('server_id', fn (Deployment $deployment) => $deployment->site->server_id),
            Column::data('active'),
            Column::data('trigger', fn (Deployment $deployment): ?string => $deployment->trigger?->getText()),
            Column::data('trigger_color', fn (Deployment $deployment): ?string => $deployment->trigger?->getColor()),
            Column::data('rolled_back_by', fn (Deployment $deployment): ?string => $deployment->rolledBackBy?->name),
            Column::data('rolled_back_at', fn (Deployment $deployment) => $deployment->rolled_back_at),
            Column::data('commit_data'),
            Column::data('log', fn (Deployment $deployment) => $deployment->log ? ServerLogResource::make($deployment->log) : null),
            ActionsColumn::make(),
        ];
    }
}
