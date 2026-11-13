<?php

namespace App\Models;

use App\Enums\DeploymentStatus;
use App\Enums\DeploymentTrigger;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Deployment extends AbstractModel
{
    use HasFactory;

    protected $fillable = [
        'site_id',
        'deployment_script_id',
        'log_id',
        'commit_id',
        'commit_data',
        'status',
        'release',
        'active',
        'user_id',
        'trigger',
        'finished_at',
    ];

    protected $casts = [
        'site_id' => 'integer',
        'deployment_script_id' => 'integer',
        'log_id' => 'integer',
        'commit_data' => 'json',
        'active' => 'boolean',
        'status' => DeploymentStatus::class,
        'user_id' => 'integer',
        'trigger' => DeploymentTrigger::class,
        'finished_at' => 'datetime',
    ];

    protected static function booted(): void
    {
        static::saving(function (Deployment $deployment): void {
            if ($deployment->finished_at === null && $deployment->isDirty('status') && $deployment->status !== DeploymentStatus::DEPLOYING) {
                $deployment->finished_at = now();
            }
        });

        static::created(function (Deployment $deployment): void {
            $site = $deployment->site;
            $keep = $site->type_data['modern_deployment_history'] ?? 10;
            if ($site->deployments()->whereNotNull('release')->count() > $keep) {
                $lastDeploymentToKeep = $site->deployments()->whereNotNull('release')->orderByDesc('id')->skip($keep)->first();
                if ($lastDeploymentToKeep) {
                    $deployments = $site->deployments()
                        ->whereNotNull('release')
                        ->where('active', false)
                        ->where('id', '<=', $lastDeploymentToKeep->id)
                        ->get();

                    foreach ($deployments as $oldDeployment) {
                        $oldDeployment->removeRelease();
                    }
                }
            }
        });
    }

    public function site(): BelongsTo
    {
        return $this->belongsTo(Site::class);
    }

    public function deploymentScript(): BelongsTo
    {
        return $this->belongsTo(DeploymentScript::class);
    }

    public function log(): BelongsTo
    {
        return $this->belongsTo(ServerLog::class, 'log_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function getCommitIdShortAttribute(): ?string
    {
        return $this->commit_id ? substr($this->commit_id, 0, 7) : null;
    }

    public function isDuplicate(): bool
    {
        if (empty($this->commit_id)) {
            return false;
        }

        return static::query()
            ->where('site_id', $this->site_id)
            ->where('commit_id', $this->commit_id)
            ->where('id', '<', $this->id)
            ->exists();
    }

    public function path(): string
    {
        return $this->site->basePath().($this->release ? '/releases/'.$this->release : '');
    }

    public function removeRelease(): void
    {
        if ($this->release !== null && $this->release !== '') {
            $site = $this->site;
            $site->server->ssh($site->user)->exec('rm -rf '.escapeshellarg($this->path()));
            $this->release = null;
        }

        $this->save();
    }

    public function activate(): void
    {
        $this->site->deployments()->update(['active' => false]);
        $this->active = true;
        $this->save();
    }

    public function duration(): ?int
    {
        if (! $this->finished_at) {
            return null;
        }

        return (int) abs($this->finished_at->diffInSeconds($this->created_at));
    }

    public function formattedDuration(): ?string
    {
        $duration = $this->duration();
        if ($duration === null) {
            return null;
        }

        $minutes = intdiv($duration, 60);
        $seconds = $duration % 60;

        return $minutes > 0 ? sprintf('%dm %02ds', $minutes, $seconds) : sprintf('%ds', $seconds);
    }
}
