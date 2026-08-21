<?php

namespace App\Models;

use App\Actions\Server\BroadcastServerUpdate;
use Carbon\Carbon;
use Database\Factories\MetricFactory;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;


class Metric extends Model
{
    
    use HasFactory;

    protected $fillable = [
        'server_id',
        'load',
        'memory_total',
        'memory_used',
        'memory_free',
        'disk_total',
        'disk_used',
        'disk_free',
        'cpu_cores',
        'cpu_physical_cores',
        'cpu_usage_percent',
        'cpu_per_core_usage_percent',
        'cpu_steal_percent',
        'swap_total',
        'swap_used',
        'swap_free',
        'swap_used_percent',
        'oom_kill_count',
        'uptime_seconds',
        'reboot_required',
    ];

    protected $casts = [
        'server_id' => 'integer',
        'load' => 'float',
        'memory_total' => 'float',
        'memory_used' => 'float',
        'memory_free' => 'float',
        'disk_total' => 'float',
        'disk_used' => 'float',
        'disk_free' => 'float',
        'cpu_cores' => 'integer',
        'cpu_physical_cores' => 'integer',
        'cpu_usage_percent' => 'float',
        'cpu_steal_percent' => 'float',
        'swap_total' => 'float',
        'swap_used' => 'float',
        'swap_free' => 'float',
        'swap_used_percent' => 'float',
        'oom_kill_count' => 'integer',
        'uptime_seconds' => 'float',
        'reboot_required' => 'boolean',
    ];

    protected static function booted(): void
    {
        static::created(function (Metric $metric): void {
            if ($metric->reboot_required === null) {
                return;
            }

            $previous = static::query()
                ->where('server_id', $metric->server_id)
                ->where('id', '<', $metric->id)
                ->latest('id')
                ->value('reboot_required');

            if ((bool) $previous === (bool) $metric->reboot_required) {
                return;
            }

            app(BroadcastServerUpdate::class)->broadcast($metric->server);
        });
    }

    
    public function server(): BelongsTo
    {
        return $this->belongsTo(Server::class);
    }

    protected function cpuUsagePercent(): Attribute
    {
        return Attribute::set(fn ($value) => $value === null ? null : round((float) $value, 2));
    }

    protected function cpuStealPercent(): Attribute
    {
        return Attribute::set(fn ($value) => $value === null ? null : round((float) $value, 2));
    }

    protected function swapUsedPercent(): Attribute
    {
        return Attribute::set(fn ($value) => $value === null ? null : round((float) $value, 2));
    }

    protected function cpuPerCoreUsagePercent(): Attribute
    {
        return Attribute::make(
            get: fn ($value) => $value === null ? null : json_decode($value, true),
            set: fn ($value) => $value === null
                ? null
                : json_encode(array_map(fn ($v) => round((float) $v, 2), (array) $value)),
        );
    }

    public function getMemoryTotalInBytesAttribute(): float|int
    {
        return ($this->memory_total ?? 0) * 1024;
    }

    public function getMemoryUsedInBytesAttribute(): float|int
    {
        return ($this->memory_used ?? 0) * 1024;
    }

    public function getMemoryFreeInBytesAttribute(): float|int
    {
        return ($this->memory_free ?? 0) * 1024;
    }

    public function getDiskTotalInBytesAttribute(): float|int
    {
        return ($this->disk_total ?? 0) * (1024 * 1024);
    }

    public function getDiskUsedInBytesAttribute(): float|int
    {
        return ($this->disk_used ?? 0) * (1024 * 1024);
    }

    public function getDiskFreeInBytesAttribute(): float|int
    {
        return ($this->disk_free ?? 0) * (1024 * 1024);
    }

    public function getSwapTotalInBytesAttribute(): float|int
    {
        return ($this->swap_total ?? 0) * 1024;
    }

    public function getSwapUsedInBytesAttribute(): float|int
    {
        return ($this->swap_used ?? 0) * 1024;
    }

    public function getSwapFreeInBytesAttribute(): float|int
    {
        return ($this->swap_free ?? 0) * 1024;
    }
}
