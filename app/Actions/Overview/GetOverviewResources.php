<?php

namespace App\Actions\Overview;

use App\Http\Resources\ProjectOverviewServerResource;
use App\Http\Resources\ProjectOverviewSiteResource;
use App\Models\Backup;
use App\Models\DNSProvider;
use App\Models\Domain;
use App\Models\Project;
use App\Models\Server;
use App\Models\ServerProvider;
use App\Models\Site;
use App\Models\SourceControl;
use App\Models\StorageProvider;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;

class GetOverviewResources
{
    private const int LIMIT = 3;

    private User $user;

    private bool $isAdmin;

    private array $projectIds = [];

    public function handle(User $user, array $serverIds, array $siteIds, ?int $fallbackServerId = null): array
    {
        $this->user = $user;
        $this->isAdmin = $user->isAdmin();

        if (! $this->isAdmin) {
            $this->projectIds = $user->allProjects()->pluck('projects.id')->all();
        }

        $servers = $this->recent($this->scopeToProjects(Server::query())->with('latestMetric'), $serverIds);
        $sites = $this->recent($this->siteQuery(), $siteIds, $fallbackServerId);

        return [
            'servers' => ProjectOverviewServerResource::collection($servers)->resolve(),
            'sites' => ProjectOverviewSiteResource::collection($sites)->resolve(),
            'projects' => $this->latestOf(
                ($this->isAdmin ? Project::query() : $this->user->allProjects())->withCount('users'),
                fn (Project $project): array => [
                    'id' => $project->id,
                    'name' => $project->name,
                    'users_count' => $project->users_count,
                    'is_current' => $project->id === $this->user->current_project_id,
                ],
            ),
            'server_providers' => $this->latestOf(
                $this->scopeToUserOrProjects(ServerProvider::query()),
                fn (ServerProvider $provider): array => [
                    'id' => $provider->id,
                    'provider' => $provider->provider,
                    'profile' => $provider->profile ?? $provider->provider,
                    'connected' => (bool) $provider->connected,
                ],
            ),
            'source_controls' => $this->latestOf(
                $this->scopeToUserOrProjects(SourceControl::query()),
                fn (SourceControl $sourceControl): array => [
                    'id' => $sourceControl->id,
                    'provider' => $sourceControl->provider,
                    'profile' => $sourceControl->profile ?? $sourceControl->provider,
                ],
            ),
            'storage_providers' => $this->latestOf(
                $this->scopeToUserOrProjects(StorageProvider::query()),
                fn (StorageProvider $provider): array => [
                    'id' => $provider->id,
                    'provider' => $provider->provider,
                    'profile' => $provider->profile ?? $provider->provider,
                ],
            ),
            'dns_providers' => $this->latestOf(
                $this->scopeToUserOrProjects(DNSProvider::query()),
                fn (DNSProvider $provider): array => [
                    'id' => $provider->id,
                    'provider' => $provider->provider,
                    'profile' => $provider->name ?? $provider->provider,
                    'connected' => (bool) $provider->connected,
                ],
            ),
            'backups' => $this->latestOf(
                $this->scopeToServerProjects(Backup::query())->with(['server', 'database']),
                fn (Backup $backup): array => [
                    'id' => $backup->id,
                    'name' => $backup->database->name ?? $backup->type->getText(),
                    'server_name' => $backup->server?->name,
                    'interval' => $backup->interval,
                ],
            ),
            'domains' => $this->latestOf(
                $this->scopeToUserOrProjects(Domain::query())->with('dnsProvider'),
                fn (Domain $domain): array => [
                    'id' => $domain->id,
                    'domain' => $domain->domain,
                    'provider_name' => $domain->dnsProvider->name ?? $domain->dnsProvider->provider,
                ],
            ),
        ];
    }

    private function recent(Builder $query, array $ids, ?int $fallbackServerId = null): Collection
    {
        $items = (clone $query)->whereKey($ids)->get();

        if ($items->count() < self::LIMIT) {
            $topUp = (clone $query)->whereNotIn('id', $items->modelKeys());

            if ($fallbackServerId !== null) {
                $topUp->where('server_id', $fallbackServerId);
            }

            $items = $items->merge($topUp->latest('id')->limit(self::LIMIT - $items->count())->get());
        }

        return $items;
    }

    private function latestOf(Builder $query, callable $map): array
    {
        return $query->latest('id')->take(self::LIMIT)->get()->map($map)->all();
    }

    private function scopeToProjects(Builder $query): Builder
    {
        return $query->when(! $this->isAdmin, fn ($query) => $query->whereIn('project_id', $this->projectIds));
    }

    private function scopeToUserOrProjects(Builder $query): Builder
    {
        return $query->when(! $this->isAdmin, fn ($query) => $query->where(
            fn (Builder $query) => $query->whereIn('project_id', $this->projectIds)->orWhere('user_id', $this->user->id),
        ));
    }

    private function scopeToServerProjects(Builder $query): Builder
    {
        return $query->when(! $this->isAdmin, fn ($query) => $query->whereHas(
            'server',
            fn (Builder $query) => $query->whereIn('project_id', $this->projectIds),
        ));
    }

    private function siteQuery(): Builder
    {
        return $this->scopeToServerProjects(Site::query())->with('server');
    }
}
