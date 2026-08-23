<?php

namespace App\Tables;

use App\Models\Metric;
use App\Models\Server;
use Forjed\InertiaTable\Column;
use Forjed\InertiaTable\Columns\ActionsColumn;
use Forjed\InertiaTable\Columns\DateTimeColumn;
use Forjed\InertiaTable\Columns\EnumColumn;
use Forjed\InertiaTable\Columns\LinkColumn;
use Forjed\InertiaTable\Columns\TextColumn;
use Forjed\InertiaTable\Table;
use Illuminate\Database\Eloquent\Builder;

class ServerTable extends Table
{
    protected string $defaultSort = '-performance_sort_score';

    protected array $tableSettings = ['realtime' => 'server'];

    protected function query(): void
    {
        $this->perPage = config('web.pagination_size');
        $sortSubquery = $this->performanceSubquery(prioritizeStale: true);
        $this->query
            ->select('servers.*')
            ->selectSub($this->performanceSubquery(), 'performance_score')
            ->selectRaw("COALESCE(({$sortSubquery->toSql()}), 1001) AS performance_sort_score", $sortSubquery->getBindings())
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
            Column::make('performance_score', 'Performance')
                ->value(fn (Server $server) => $server->latestMetric ? (float) $server->getAttribute('performance_score') : null)
                ->accessor('performance_sort_score')
                ->sortable(),
            Column::make('warnings', 'Warnings')
                ->value(fn (Server $server) => $server->getWarnings()),
            Column::data('updates'),
            Column::data('cpu_usage_percent', fn (Server $server) => $server->latestMetric?->cpu_usage_percent),
            Column::data('memory_used_percent', fn (Server $server) => $server->latestMetric?->memory_total > 0
                ? round(($server->latestMetric->memory_used / $server->latestMetric->memory_total) * 100, 1)
                : null),
            Column::data('disk_used_percent', fn (Server $server) => $server->latestMetric?->disk_total > 0
                ? round(($server->latestMetric->disk_used / $server->latestMetric->disk_total) * 100, 1)
                : null),
            Column::data('performance', fn (Server $server) => $this->performance($server)),
            Column::data('role_value', fn (Server $server) => $server->role->value),
            ActionsColumn::make(),
        ];
    }

    protected function searchable(): array
    {
        return ['name', 'ip'];
    }

    private function performanceSubquery(bool $prioritizeStale = false): Builder
    {
        $score = '(
            (COALESCE(cpu_usage_percent, 0) * 0.45) +
            (CASE WHEN memory_total > 0 THEN (memory_used * 100.0 / memory_total) ELSE 0 END * 0.30) +
            (CASE WHEN disk_total > 0 THEN (disk_used * 100.0 / disk_total) ELSE 0 END * 0.10) +
            (CASE
                WHEN cpu_cores > 0 AND (load * 100.0 / cpu_cores) > 100 THEN 100
                WHEN cpu_cores > 0 THEN (load * 100.0 / cpu_cores)
                ELSE 0
            END * 0.15)
        )';
        $bindings = [];

        if ($prioritizeStale) {
            $score = "CASE WHEN created_at < ? THEN 1000 ELSE {$score} END";
            $bindings[] = now()->subMinutes(5);
        }

        return Metric::query()
            ->selectRaw("ROUND({$score}, 1)", $bindings)
            ->whereColumn('metrics.server_id', 'servers.id')
            ->latest('metrics.created_at')
            ->limit(1);
    }

    
    private function performance(Server $server): array
    {
        if (! $server->latestMetric) {
            return ['label' => 'No data', 'color' => 'gray', 'stale' => false];
        }

        if ($server->latestMetric->created_at->lt(now()->subMinutes(5))) {
            return ['label' => 'Stale metrics', 'color' => 'warning', 'stale' => true];
        }

        $score = (float) $server->getAttribute('performance_score');

        return match (true) {
            $score >= 85 => ['label' => 'Critical', 'color' => 'danger', 'stale' => false],
            $score >= 70 => ['label' => 'Poor', 'color' => 'warning', 'stale' => false],
            $score >= 45 => ['label' => 'Moderate', 'color' => 'info', 'stale' => false],
            default => ['label' => 'Healthy', 'color' => 'success', 'stale' => false],
        };
    }
}
