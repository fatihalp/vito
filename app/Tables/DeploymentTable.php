<?php

namespace App\Tables;

use App\Http\Resources\ServerLogResource;
use App\Models\Deployment;
use Forjed\InertiaTable\Column;
use Forjed\InertiaTable\Columns\ActionsColumn;
use Forjed\InertiaTable\Columns\DateTimeColumn;
use Forjed\InertiaTable\Columns\EnumColumn;
use Forjed\InertiaTable\Columns\TextColumn;
use Forjed\InertiaTable\Table;

class DeploymentTable extends Table
{
    protected array $tableSettings = ['realtime' => 'deployment'];

    protected string $defaultSort = '-created_at';

    private bool $overview = false;

    /**
     * @return array<string, mixed>
     */
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
        $this->query->with('log', 'site');

        if ($this->overview) {
            $this->query->latest();
        }
    }

    protected function columns(): array
    {
        return [
            TextColumn::make('id', 'ID')
                ->sortable(! $this->overview)
                ->link('application.deployments.show', [
                    'server' => ':server_id',
                    'site' => ':site_id',
                    'deployment' => ':id',
                ]),
            Column::make('commit', 'Commit'),
            DateTimeColumn::make('created_at', 'Deployed At')->sortable(! $this->overview)->toLocal(),
            EnumColumn::make('status', 'Status')->sortable(! $this->overview),
            Column::make('release', 'Release'),
            Column::data('site_id'),
            Column::data('server_id', fn (Deployment $deployment) => $deployment->site->server_id),
            Column::data('active'),
            Column::data('commit_data'),
            Column::data('log', fn (Deployment $deployment) => $deployment->log ? ServerLogResource::make($deployment->log) : null),
            ActionsColumn::make(),
        ];
    }
}
