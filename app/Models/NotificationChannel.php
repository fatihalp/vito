<?php

namespace App\Models;

use App\Traits\HasProjectScopedQueries;

use App\Notifications\NotificationInterface;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Notifications\Notifiable;

class NotificationChannel extends AbstractModel
{
    use HasProjectScopedQueries;
    
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
        'data' => 'encrypted:array',
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

    /**
     * Sends to the channels of the project the notifiable belongs to plus global channels; a notifiable without a
     * project (or null) reaches global channels only.
     */
    public static function notifyAll(NotificationInterface $notification, ?object $notifiable = null): void
    {
        $projectId = self::projectIdOf($notifiable);

        self::query()
            ->where(fn ($query) => $query->whereNull('project_id')->when($projectId !== null, fn ($q) => $q->orWhere('project_id', $projectId)))
            ->get()
            ->each(fn (NotificationChannel $channel) => $channel->notify($notification));
    }

    private static function projectIdOf(?object $notifiable): ?int
    {
        return match (true) {
            $notifiable instanceof Project => $notifiable->id,
            $notifiable instanceof Server => $notifiable->project_id,
            $notifiable instanceof Site => $notifiable->server?->project_id,
            $notifiable !== null && isset($notifiable->project_id) => (int) $notifiable->project_id,
            $notifiable !== null && isset($notifiable->server) => $notifiable->server?->project_id,
            default => null,
        };
    }

    
    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
