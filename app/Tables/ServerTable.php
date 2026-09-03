<?php

namespace App\Tables;

use App\Models\Metric;
use App\Models\Server;
use Forjed\InertiaTable\Column;
use Forjed\InertiaTable\Columns\EnumColumn;
use Forjed\InertiaTable\Columns\LinkColumn;
use Forjed\InertiaTable\Columns\TextColumn;
use App\Tables\AbstractTable as Table;
use Illuminate\Database\Eloquent\Builder;

class ServerTable extends Table
{
    protected string $defaultSort = '-cpu_usage_percent';

    protected array $tableSettings = ['realtime' => 'server'];

    protected function query(): void
    {
        $cpuSubquery = $this->metricSubquery('cpu_usage_percent');
        $memorySubquery = $this->metricSubquery(
            'CASE WHEN memory_total > 0 THEN ROUND(memory_used * 100.0 / memory_total, 1) ELSE NULL END'
        );
        $diskSubquery = $this->metricSubquery(
            'CASE WHEN disk_total > 0 THEN ROUND(disk_used * 100.0 / disk_total, 1) ELSE NULL END'
        );

        $this->query
            ->select('servers.*')
            ->selectSub($cpuSubquery, 'cpu_usage_percent')
            ->selectSub($memorySubquery, 'memory_used_percent')
            ->selectSub($diskSubquery, 'disk_used_percent')
            ->with('latestMetric');
    }

    protected function columns(): array
    {
        return [
            Column::data('id'),
            LinkColumn::make('name', 'Name')->sortable()->route('servers.show', ['server' => ':id']),
            EnumColumn::make('role', 'Type')->sortable(),
            TextColumn::make('stage', 'Stage')->sortable(),
            TextColumn::make('ip', 'IP')->sortable(),
            TextColumn::make('cpu_usage_percent', 'CPU')->sortable(),
            TextColumn::make('memory_used_percent', 'RAM')->sortable(),
            TextColumn::make('disk_used_percent', 'Disk')->sortable(),
            Column::make('warnings', 'Warnings')
                ->value(fn (Server $server) => $server->getWarnings()),
            Column::data('updates'),
            Column::data('role_value', fn (Server $server) => $server->role->value),
        ];
    }

    protected function searchable(): array
    {
        return ['name', 'ip'];
    }

    private function metricSubquery(string $selectExpression): Builder
    {
        return Metric::query()
            ->selectRaw($selectExpression)
            ->whereColumn('metrics.server_id', 'servers.id')
            ->latest('metrics.created_at')
            ->limit(1);
    }
}
