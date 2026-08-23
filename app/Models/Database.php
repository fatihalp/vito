<?php

namespace App\Models;

use App\Enums\DatabaseStatus;
use Carbon\Carbon;
use Database\Factories\DatabaseFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Database extends AbstractModel
{
    
    use HasFactory;

    use SoftDeletes;

    protected $fillable = [
        'server_id',
        'name',
        'collation',
        'charset',
        'status',
    ];

    protected $casts = [
        'server_id' => 'integer',
        'status' => DatabaseStatus::class,
    ];

    public static function boot(): void
    {
        parent::boot();

        static::deleting(function (Database $database): void {
            $database->server->databaseUsers()->each(function ($user) use ($database): void {
                
                $databases = $user->databases;
                if ($databases && in_array($database->name, $databases)) {
                    unset($databases[array_search($database->name, $databases)]);
                    $user->databases = array_values($databases);
                    $user->save();
                }
            });
        });
    }

    
    public function server(): BelongsTo
    {
        return $this->belongsTo(Server::class);
    }

    
    public function backups(): HasMany
    {
        return $this->hasMany(Backup::class)->where('type', 'database');
    }
}
