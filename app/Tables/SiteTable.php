<?php

namespace App\Tables;

use App\Enums\DeploymentStatus;
use App\Models\Server;
use App\Models\Site;
use Forjed\InertiaTable\Column;
use Forjed\InertiaTable\Columns\BadgeColumn;
use Forjed\InertiaTable\Columns\DateTimeColumn;
use Forjed\InertiaTable\Columns\EnumColumn;
use Forjed\InertiaTable\Columns\LinkColumn;
use App\Tables\AbstractTable as Table;
use Illuminate\Database\Eloquent\Builder;

class SiteTable extends Table
{
    protected array $tableSettings = ['realtime' => 'site'];

    protected ?Server $server = null;

    protected string $groupBy = 'none';

    protected array $commitsBehind = [];

    public function forServer(Server $server): static
    {
        $this->server = $server;

        return $this;
    }

    public function withCommitsBehind(array $commitsBehind): static
    {
        $this->commitsBehind = $commitsBehind;

        return $this;
    }

    public function withGrouping(string $groupBy): static
    {
        $this->groupBy = $groupBy;

        return $this;
    }

    protected function query(): void
    {
        $this->perPage = config('web.pagination_size');
        $this->query
            ->with(['server.project', 'isolatedUser', 'hostedDomains.ssl', 'workers'])
            ->withExists([
                'deployments as has_finished_deployment' => fn (Builder $query) => $query->where('status', DeploymentStatus::FINISHED),
            ])
            ->withMax([
                'deployments as last_deployed_at' => fn (Builder $query) => $query->where('status', DeploymentStatus::FINISHED),
            ], 'created_at');

        if ($this->groupBy === 'project' && ! request()->filled($this->getSortParam())) {
            $this->query
                ->orderBy(
                    \App\Models\Project::select('projects.name')
                        ->join('servers', 'servers.project_id', '=', 'projects.id')
                        ->whereColumn('servers.id', 'sites.server_id')
                        ->limit(1)
                )
                ->orderBy('domain');
        } elseif ($this->groupBy === 'server' && ! request()->filled($this->getSortParam())) {
            $this->query
                ->orderBy(
                    \App\Models\Server::select('servers.name')
                        ->whereColumn('servers.id', 'sites.server_id')
                        ->limit(1)
                )
                ->orderBy('domain');
        } else {
            $this->query->latest();
        }
    }

    protected function columns(): array
    {
        $columns = [];

        if (! $this->server) {
            $columns[] = Column::make('server.project.name', 'Project');
        }

        return [
            ...$columns,
            LinkColumn::make('domain', $this->server ? 'Domain' : 'Site')
                ->sortable()
                ->route('application', ['server' => ':server_id', 'site' => ':id']),
            BadgeColumn::make('user', 'User')->variant('outline')->sortable(),
            BadgeColumn::make('type', 'Type')->variant('outline')->sortable(),
            Column::make('branch', 'Git')->sortable(),
            DateTimeColumn::make('last_deployed_at', 'Last deployed')->sortable(),
            DateTimeColumn::make('created_at', 'Created at')->sortable(),
            EnumColumn::make('status', 'Status')->sortable(),
            Column::make('id', 'ID')->sortable(),
            Column::data('server_id'),
            Column::data('server_name', fn (Site $site) => $site->server->name),
            Column::data('project_id', fn (Site $site) => $site->server->project_id),
            Column::data('project_name', fn (Site $site) => $site->server->project?->name),
            Column::data('warnings', fn (Site $site) => $site->getWarnings()),
        ];
    }

    protected function applySorting(array $columns): void
    {
        $sort = (string) request()->input($this->getSortParam());

        if (ltrim($sort, '-') !== 'branch') {
            parent::applySorting($columns);

            return;
        }

        $known = array_keys($this->commitsBehind) ?: [0];
        $cases = collect($this->commitsBehind)->map(fn (int $behind, int $id): string => "WHEN {$id} THEN {$behind}")->implode(' ');

        $this->query->reorder()
            ->orderByRaw('CASE WHEN sites.id IN ('.implode(',', $known).') THEN 0 ELSE 1 END')
            ->orderByRaw($cases === '' ? 'sites.id' : "CASE sites.id {$cases} END ".(str_starts_with($sort, '-') ? 'DESC' : 'ASC'))
            ->orderBy('domain');
    }

    protected function searchable(): array
    {
        return ['domain', 'user'];
    }

    protected function applySearch(): void
    {
        $search = request()->input($this->getSearchParam());

        if (! is_string($search) || $search === '') {
            return;
        }

        $this->query->where(function (Builder $sites) use ($search): void {
            $sites->where('domain', 'LIKE', "%{$search}%");

            if ($this->server) {
                $sites->orWhere('user', 'LIKE', "%{$search}%");

                return;
            }

            $sites->orWhereHas('server', function (Builder $servers) use ($search): void {
                $servers->where('name', 'LIKE', "%{$search}%");
            });
        });

        if (request()->filled($this->getSortParam())) {
            return;
        }

        $base = $this->query->getQuery();
        $orders = $base->orders ?? [];
        $base->orders = $this->groupBy === 'none' ? [] : array_splice($orders, 0, 1);
        $this->query->orderByRaw('CASE WHEN domain = ? THEN 0 WHEN domain LIKE ? THEN 1 WHEN domain LIKE ? THEN 2 ELSE 3 END', [$search, $search.'%', '%'.$search.'%']);
        $base->orders = [...$base->orders, ...$orders];
    }
}
