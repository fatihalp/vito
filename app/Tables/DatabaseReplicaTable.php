<?php

namespace App\Tables;

use App\Http\Resources\DatabaseReplicaResource;
use App\Models\DatabaseReplica;
use App\Tables\AbstractTable as Table;
use Forjed\InertiaTable\Column;
use Forjed\InertiaTable\Columns\ActionsColumn;
use Forjed\InertiaTable\Columns\BadgeColumn;
use Forjed\InertiaTable\Columns\DateTimeColumn;
use Illuminate\Support\Number;

class DatabaseReplicaTable extends Table
{
    protected array $tableSettings = ['realtime' => 'database-replica'];

    protected function query(): void
    {
        $this->perPage = config('web.pagination_size');
        $this->query->with(['cluster.primary', 'replica', 'latestMetric'])->latest();
    }

    protected function columns(): array
    {
        return [
            Column::make('cluster.primary.name', 'Primary')
                ->link('servers.show', ['server' => ':primary_server_id']),
            Column::make('replica.name', 'Replica')
                ->link('servers.show', ['server' => ':replica_server_id']),
            BadgeColumn::make('status', 'Status')
                ->value(fn (DatabaseReplica $replica) => $replica->status->getText())
                ->colorField('status_color'),
            BadgeColumn::make('health', 'Health')
                ->value(fn (DatabaseReplica $replica) => $replica->health->getText())
                ->colorField('health_color'),
            Column::make('lag', 'Lag')
                ->value(fn (DatabaseReplica $replica) => $replica->latestMetric?->lag_bytes !== null ? Number::fileSize($replica->latestMetric->lag_bytes) : null)
                ->fallback('-'),
            Column::make('replay_lag', 'Replay latency')
                ->value(fn (DatabaseReplica $replica) => $replica->latestMetric?->replay_lag_ms !== null ? round($replica->latestMetric->replay_lag_ms).' ms' : null)
                ->fallback('-'),
            DateTimeColumn::make('last_checked_at', 'Last checked'),
            Column::data('status_color', fn (DatabaseReplica $replica) => $replica->status->getColor()),
            Column::data('health_color', fn (DatabaseReplica $replica) => $replica->health->getColor()),
            Column::data('id'),
            Column::data('primary_server_id', fn (DatabaseReplica $replica) => $replica->cluster->primary_server_id),
            Column::data('replica_server_id'),
            Column::data('resource', fn (DatabaseReplica $replica) => DatabaseReplicaResource::make($replica)),
            ActionsColumn::make(),
        ];
    }
}
