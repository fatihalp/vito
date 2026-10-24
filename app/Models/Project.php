<?php

namespace App\Models;

use App\Enums\UserRole;
use Carbon\Carbon;
use Database\Factories\ProjectFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasManyThrough;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Project extends AbstractModel
{
    
    use HasFactory;


    protected $fillable = [
        'name',
    ];

    
    /**
     * Loads what ProjectResource reads for the given viewer: their membership row (for role) and server/site counts.
     */
    public function scopeForResource(Builder $query, User $viewer): Builder
    {
        return $query
            ->withCount(['servers', 'sites'])
            ->with(['users' => fn ($users) => $users->where('user_id', $viewer->id)]);
    }

    public function servers(): HasMany
    {
        return $this->hasMany(Server::class);
    }

    
    public function sites(): HasManyThrough
    {
        return $this->hasManyThrough(Site::class, Server::class);
    }

    
    public function backups(): HasManyThrough
    {
        return $this->hasManyThrough(Backup::class, Server::class);
    }

    
    public function notificationChannels(): HasMany
    {
        return $this->hasMany(NotificationChannel::class);
    }

    public function users(): HasMany
    {
        return $this->hasMany(UserProject::class, 'project_id');
    }

    
    public function sourceControls(): HasMany
    {
        return $this->hasMany(SourceControl::class);
    }

    public function registeredUsers(): HasManyThrough
    {
        return $this->hasManyThrough(User::class, UserProject::class, 'project_id', 'id', 'id', 'user_id');
    }

    public function hasRoles(User $user, array $roles): bool
    {
        return $this->users()
            ->where('user_id', $user->id)
            ->whereIn('role', $roles)
            ->exists();
    }

    public function role(User $user): ?UserRole
    {
        
        $userProject = $this->relationLoaded('users')
            ? $this->users->firstWhere('user_id', $user->id)
            : $this->users()->where('user_id', $user->id)->first();

        return $userProject?->role;
    }

    public function domains(): HasMany
    {
        return $this->hasMany(Domain::class);
    }


    public function networks(): HasMany
    {
        return $this->hasMany(Network::class);
    }

    public function storageMigrations(): HasMany
    {
        return $this->hasMany(StorageMigration::class);
    }
}
