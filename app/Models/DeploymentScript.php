<?php

namespace App\Models;

use Database\Factories\DeploymentScriptFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DeploymentScript extends AbstractModel
{
    
    use HasFactory;

    protected static function boot(): void
    {
        parent::boot();

        static::saving(function ($deploymentScript): void {
            $deploymentScript->content = str_replace("\r\n", "\n", $deploymentScript->content);
        });
    }

    protected $fillable = [
        'site_id',
        'name',
        'content',
        'configs',
    ];

    protected $casts = [
        'site_id' => 'integer',
        'configs' => 'array',
    ];

    
    public function site(): BelongsTo
    {
        return $this->belongsTo(Site::class);
    }

    public function shouldRestartWorkers(): bool
    {
        return (bool) ($this->configs['restart_workers'] ?? false);
    }
}
