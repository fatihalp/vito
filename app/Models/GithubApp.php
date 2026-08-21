<?php

namespace App\Models;

use Database\Factories\GithubAppFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;


class GithubApp extends AbstractModel
{
    
    use HasFactory;

    protected $table = 'github_app';

    protected $fillable = [
        'app_id',
        'app_slug',
        'name',
        'client_id',
        'client_secret',
        'webhook_secret',
        'private_key',
        'html_url',
    ];

    protected $casts = [
        'app_id' => 'integer',
        'client_secret' => 'encrypted',
        'webhook_secret' => 'encrypted',
        'private_key' => 'encrypted',
    ];

    public static function current(): ?self
    {
        return self::query()->first();
    }
}
