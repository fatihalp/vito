<?php

namespace App\Models;

use App\Enums\WorkerStatus;
use App\Helpers\SiteShellEnvironment;
use App\Services\ProcessManager\ProcessManager;
use Database\Factories\WorkerFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Log;
use Throwable;

class Worker extends AbstractModel
{
    
    use HasFactory;

    protected $fillable = [
        'server_id',
        'site_id',
        'name',
        'command',
        'directory',
        'user',
        'auto_start',
        'auto_restart',
        'numprocs',
        'environment',
        'redirect_stderr',
        'stdout_logfile',
        'status',
    ];

    protected $casts = [
        'server_id' => 'integer',
        'site_id' => 'integer',
        'auto_start' => 'boolean',
        'auto_restart' => 'boolean',
        'numprocs' => 'integer',
        'environment' => 'encrypted:array',
        'redirect_stderr' => 'boolean',
        'status' => WorkerStatus::class,
    ];

    public static function boot(): void
    {
        parent::boot();

        static::deleting(function (Worker $worker): void {
            try {
                
                $service = $worker->server->processManager();
                
                $handler = $service->handler();

                $handler->delete($worker->id, $worker->site_id);
            } catch (Throwable $e) {
                Log::error($e);
            }
        });
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

    
    public function server(): BelongsTo
    {
        return $this->belongsTo(Server::class);
    }

    
    public function site(): BelongsTo
    {
        return $this->belongsTo(Site::class);
    }

    public function getLogDirectory(): string
    {
        if ($this->user === 'root') {
            return '/root/.logs/workers';
        }

        return '/home/'.$this->user.'/.logs/workers';
    }

    public function getLogFile(): string
    {
        return $this->getLogDirectory().'/'.$this->id.'.log';
    }

    
    public function environmentMap(): array
    {
        $map = [];

        foreach ($this->environment ?? [] as $variable) {
            $map[$variable['key']] = $variable['value'];
        }

        return $map;
    }

    
    public function effectiveEnvironment(): array
    {
        $base = $this->environmentMap();

        if ($this->site_id && $this->site) {
            return array_merge($base, SiteShellEnvironment::collect($this->site));
        }

        return $base;
    }

    public function isSiteBootstrap(): bool
    {
        if (! $this->site_id || ! $this->site) {
            return false;
        }

        return $this->site->bootstrapWorkerId() === $this->id;
    }

    public function workingDirectory(): ?string
    {
        if (! empty($this->directory)) {
            if ($this->site && ! str_starts_with($this->directory, '/')) {
                return rtrim($this->site->path, '/').'/'.ltrim($this->directory, '/');
            }

            return $this->directory;
        }

        return $this->site?->path;
    }
}
