<?php

namespace App\Models;

use App\Enums\UserRole;
use App\Traits\HasTimezoneTimestamps;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasManyThrough;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Collection;
use Laravel\Fortify\TwoFactorAuthenticatable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens;
    use HasFactory;
    use HasTimezoneTimestamps;
    use Notifiable;
    use TwoFactorAuthenticatable;

    protected $fillable = [
        'name',
        'email',
        'password',
        'timezone',
        'current_project_id',
        'is_admin',
        'role',
    ];

    protected $hidden = [
        'password',
        'remember_token',
        'two_factor_recovery_codes',
        'two_factor_secret',
    ];

    protected $casts = [
        'role' => UserRole::class,
        'is_admin' => 'boolean',
    ];

    protected $appends = [];

    
    public function servers(): HasMany
    {
        return $this->hasMany(Server::class);
    }

    
    public function sshKeys(): HasMany
    {
        return $this->hasMany(SshKey::class);
    }

    
    public function sourceControls(): HasMany
    {
        return $this->hasMany(SourceControl::class);
    }

    
    public function serverProviders(): HasMany
    {
        return $this->hasMany(ServerProvider::class);
    }

    
    public function sourceControl(string $provider): HasOne
    {
        return $this->hasOne(SourceControl::class)->where('provider', $provider);
    }

    
    public function storageProviders(): HasMany
    {
        return $this->hasMany(StorageProvider::class);
    }

    
    public function storageProvider(string $provider): HasOne
    {
        return $this->hasOne(StorageProvider::class)->where('provider', $provider);
    }

    public function dnsProviders(): HasMany
    {
        return $this->hasMany(DNSProvider::class);
    }

    public function domains(): HasMany
    {
        return $this->hasMany(Domain::class);
    }

    public function allProjects(): Builder
    {
        return Project::query()
            ->whereHas('users', fn (Builder $q) => $q->where('user_id', $this->id));
    }

    public function projects(): HasManyThrough
    {
        return $this->hasManyThrough(Project::class, UserProject::class, 'user_id', 'id', 'id', 'project_id');
    }

    
    public function currentProject(): HasOne
    {
        return $this->HasOne(Project::class, 'id', 'current_project_id');
    }

    public function ensureHasDefaultProject(): Project
    {
        
        $project = $this->projects()->first();

        if (! $project) {
            $project = new Project;
            $project->name = 'default';
            $project->save();

            $project->users()->create([
                'user_id' => $this->id,
                'role' => UserRole::OWNER,
            ]);
        }

        $this->current_project_id = $project->id;
        $this->save();

        return $project;
    }

    public function hasRolesInProject(Project $project, array $roles): bool
    {
        return $project->users()
            ->where('user_id', $this->id)
            ->whereIn('role', $roles)
            ->exists();
    }

    public function isAdmin(): bool
    {
        return $this->is_admin;
    }

    
    public function scripts(): HasMany
    {
        return $this->hasMany(Script::class);
    }

    
    public function allServers(): Builder
    {
        
        $query = Server::query();

        return $query->whereHas('project', function (Builder $query): void {
            $query->whereHas('users', function ($query): void {
                $query->where('user_id', $this->id);
            });
        });
    }

    
    public function serverTemplates(): HasMany
    {
        return $this->hasMany(ServerTemplate::class);
    }
}
