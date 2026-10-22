<?php

namespace App\Tables;

use App\Actions\Server\CheckPhpVersions;
use App\Enums\ServerStatus;
use App\Models\Metric;
use App\Models\Server;
use App\Models\Service;
use Forjed\InertiaTable\Column;
use Forjed\InertiaTable\Columns\EnumColumn;
use Forjed\InertiaTable\Columns\LinkColumn;
use Forjed\InertiaTable\Columns\TextColumn;
use App\Tables\AbstractTable as Table;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ServerTable extends Table
{
    protected int $perPage = 50;

    protected string $defaultSort = '-cpu_usage_percent';

    protected array $tableSettings = ['realtime' => 'server'];

    protected string $groupBy = 'none';

    protected string $scope = 'all';

    public function withGrouping(string $groupBy): static
    {
        $this->groupBy = $groupBy;

        return $this;
    }

    public function withScope(string $scope): static
    {
        $this->scope = $scope;

        return $this;
    }

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
            ->selectSub($this->phpVersionSubquery(), 'php_version_order')
            ->with(['latestMetric', 'project', 'services' => fn (HasMany $query) => $query->where('type', 'php')->select('id', 'server_id')]);

        if ($this->groupBy === 'project' && ! request()->filled($this->getSortParam())) {
            $this->query
                ->orderBy(
                    \App\Models\Project::select('projects.name')
                        ->whereColumn('projects.id', 'servers.project_id')
                        ->limit(1)
                )
                ->orderBy('servers.name');
        }
    }

    protected function columns(): array
    {
        $columns = [];

        if ($this->scope === 'all') {
            $columns[] = Column::make('project.name', 'Project');
        }

        return [
            ...$columns,
            Column::data('id'),
            LinkColumn::make('name', 'Name')->sortable()->route('servers.show', ['server' => ':id']),
            EnumColumn::make('role', 'Type')->sortable(),
            TextColumn::make('stage', 'Stage')->sortable(),
            TextColumn::make('ip', 'IP')->sortable(),
            Column::make('php_versions', 'PHP')
                ->accessor('php_version_order')->sortable()
                ->value(fn (Server $server): array => $server->services->isEmpty()
                    ? ['status' => 'no_php', 'versions' => [], 'checking' => false, 'checked_at' => null]
                    : app(CheckPhpVersions::class)->cached($server->id)),
            TextColumn::make('cpu_usage_percent', 'CPU')->sortable(),
            TextColumn::make('memory_used_percent', 'RAM')->sortable(),
            TextColumn::make('disk_used_percent', 'Disk')->sortable(),
            Column::make('warnings', 'Warnings')
                ->value(fn (Server $server) => $server->getWarnings()),
            Column::data('updates'),
            Column::data('role_value', fn (Server $server) => $server->role->value),
            Column::data('project_id', fn (Server $server) => $server->project_id),
            Column::data('project_name', fn (Server $server) => $server->project?->name),
            Column::data('status', fn (Server $server) => $server->status->value),
            Column::data('status_color', fn (Server $server) => $server->status->getColor()),
            Column::data('status_text', fn (Server $server) => $server->status->getText()),
            Column::data('is_disconnected', fn (Server $server) => $server->status === ServerStatus::DISCONNECTED),
            Column::data('is_ready', fn (Server $server) => $server->isReady()),
            Column::data('is_self', fn (Server $server) => (bool) $server->is_self),
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
            ->whereIn('servers.status', [ServerStatus::READY->value, ServerStatus::UPDATING->value])
            ->latest('metrics.created_at')
            ->limit(1);
    }

    private function phpVersionSubquery(): Builder
    {
        $version = "COALESCE(NULLIF(installed_version, ''), version)";
        $driver = $this->query->getConnection()->getDriverName();
        $parts = [];

        foreach ([1, 2, 3] as $part) {
            $parts[] = match ($driver) {
                'pgsql' => "NULLIF(SPLIT_PART($version, '.', $part), '')",
                'sqlite' => match ($part) {
                    1 => "SUBSTR($version, 1, INSTR($version, '.') - 1)",
                    2 => "SUBSTR($version, INSTR($version, '.') + 1)",
                    3 => "CASE WHEN INSTR(SUBSTR($version, INSTR($version, '.') + 1), '.') > 0 THEN SUBSTR(SUBSTR($version, INSTR($version, '.') + 1), INSTR(SUBSTR($version, INSTR($version, '.') + 1), '.') + 1) ELSE '0' END",
                },
                default => "SUBSTRING_INDEX(SUBSTRING_INDEX(CONCAT($version, '.0'), '.', $part), '.', -1)",
            };
        }

        $cast = $driver === 'sqlite' ? 'INTEGER' : 'DECIMAL(10, 0)';
        $number = fn (string $part): string => "COALESCE(CAST($part AS $cast), 0)";

        return Service::query()->selectRaw('MAX('.$number($parts[0]).' * 1000000 + '.$number($parts[1]).' * 1000 + '.$number($parts[2]).')')
            ->whereColumn('services.server_id', 'servers.id')->where('type', 'php');
    }
}
