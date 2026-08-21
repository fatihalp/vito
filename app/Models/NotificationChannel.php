<?php

namespace App\Models;

use App\Notifications\NotificationInterface;
use Database\Factories\NotificationChannelFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Notifications\Notifiable;


class NotificationChannel extends AbstractModel
{
    
    use HasFactory;

    use Notifiable;

    protected $fillable = [
        'provider',
        'label',
        'data',
        'connected',
        'is_default',
        'project_id',
        'user_id',
    ];

    protected $casts = [
        'project_id' => 'integer',
        'data' => 'array',
        'connected' => 'boolean',
        'is_default' => 'boolean',
        'user_id' => 'integer',
    ];

    public function provider(): \App\NotificationChannels\NotificationChannel
    {
        $class = config('notification-channel.providers.'.$this->provider.'.handler');

        
        $provider = new $class($this);

        return $provider;
    }

    public static function notifyAll(NotificationInterface $notification): void
    {
        $channels = self::all();
        foreach ($channels as $channel) {
            $channel->notify($notification);
        }
    }

    
    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    
    public static function getByProjectId(int $projectId, User $user): Builder
    {
        
        $query = static::query();

        return $query
            ->where('user_id', $user->id)
            ->where(function (Builder $query) use ($projectId): void {
                $query->where('project_id', $projectId)->orWhereNull('project_id');
            });
    }
}
