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
        $this->query->with('log', 'site', 'user');
    }

    protected function columns(): array
    {
        $baseData = [
            Column::data('site_id'),
            Column::data('server_id', fn (Deployment $deployment): int => $deployment->site->server_id),
            Column::data('active'),
            Column::data('release'),
            Column::data('trigger', fn (Deployment $deployment): ?string => $deployment->trigger?->getText()),
            Column::data('trigger_color', fn (Deployment $deployment): ?string => $deployment->trigger?->getColor()),
            Column::data('commit_id'),
            Column::data('commit_id_short', fn (Deployment $deployment): ?string => $deployment->commit_id_short),
            Column::data('commit_data'),
            Column::data('finished_at', fn (Deployment $deployment) => $deployment->finished_at),
            Column::data('duration', fn (Deployment $deployment): ?int => $deployment->duration()),
            Column::data('formatted_duration', fn (Deployment $deployment): ?string => $deployment->formattedDuration()),
            Column::data('log', fn (Deployment $deployment) => $deployment->log ? ServerLogResource::make($deployment->log) : null),
            ActionsColumn::make(),
        ];

        if ($this->overview) {
            return [
                Column::make('commit', 'Commit'),
                EnumColumn::make('status', 'Status'),
                Column::make('duration', 'Duration')
                    ->value(fn (Deployment $deployment): ?string => $deployment->formattedDuration()),
                DateTimeColumn::make('created_at', 'Deployed At')->toLocal(),
                Column::data('id'),
                Column::data('deployed_by', fn (Deployment $deployment): ?string => $deployment->user?->name),
                ...$baseData,
            ];
        }

        return [
            Column::make('commit', 'Commit'),
            Column::make('deployed_by', 'Deployed By')
                ->value(fn (Deployment $deployment): ?string => $deployment->user?->name),
            EnumColumn::make('status', 'Status')->sortable(),
            Column::make('duration', 'Duration')
                ->value(fn (Deployment $deployment): ?string => $deployment->formattedDuration()),
            DateTimeColumn::make('created_at', 'Deployed At')->sortable()->toLocal(),
            TextColumn::make('id', 'ID')
                ->sortable()
                ->link('application.deployments.show', [
                    'server' => ':site.server_id',
                    'site' => ':site_id',
                    'deployment' => ':id',
                ]),
            ...$baseData,
        ];
    }
}
