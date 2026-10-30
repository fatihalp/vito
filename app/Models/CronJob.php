<?php

namespace App\Models;

use App\Enums\CronjobStatus;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class CronJob extends AbstractModel
{
    
    use HasFactory;

    public static function boot(): void
    {
        parent::boot();

        static::deleting(function (CronJob $cronJob): void {
            $cronJob->executions()->delete();
        });
    }

    protected $fillable = [
        'server_id',
        'site_id',
        'command',
        'user',
        'frequency',
        'status',
        'name',
    ];

    protected $casts = [
        'server_id' => 'integer',
        'site_id' => 'integer',
        'hidden' => 'boolean',
        'status' => CronjobStatus::class,
    ];

    
    public function server(): BelongsTo
    {
        return $this->belongsTo(Server::class);
    }

    
    public function site(): BelongsTo
    {
        return $this->belongsTo(Site::class);
    }

    public function executions(): HasMany
    {
        return $this->hasMany(CommandExecution::class);
    }

    public function lastExecution(): HasOne
    {
        return $this->hasOne(CommandExecution::class)->latestOfMany();
    }

    public function getServerIdAttribute(?int $value): ?int
    {
        if ($value === 0 && $this->site) {
            $value = $this->site->server_id;
            $this->fill(['server_id' => $this->site->server_id]);
            $this->save();
        }

        return $value;
    }

    public static function crontab(Server $server, string $user): string
    {
        return $server->cronJobs()
            ->where('user', $user)
            ->whereIn('status', [
                CronjobStatus::READY,
                CronjobStatus::CREATING,
                CronjobStatus::UPDATING,
                CronjobStatus::ENABLING,
            ])
            ->get()
            ->map(fn (self $cronJob) => $cronJob->frequency . ' ' . ($user === 'root' ? $cronJob->command : self::wrapCommand($cronJob->command)))
            ->implode("\n");
    }

    public static function wrapCommand(string $command): string
    {
        return 'bash -lc '.escapeshellarg($command);
    }

    public static function unwrapCommand(string $command): ?string
    {
        $prefix = 'bash -lc ';
        if (! str_starts_with($command, $prefix)) {
            return null;
        }

        $argument = trim(substr($command, strlen($prefix)));
        if (strlen($argument) < 2 || ! str_starts_with($argument, "'") || ! str_ends_with($argument, "'")) {
            return null;
        }

        return str_replace("'\\''", "'", substr($argument, 1, -1));
    }

    public function isEnabled(): bool
    {
        return $this->status === CronjobStatus::READY;
    }

    public function isDisabled(): bool
    {
        return $this->status === CronjobStatus::DISABLED;
    }
}
