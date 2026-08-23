<?php

namespace App\Models;

use App\Enums\HostedDomainStatus;
use App\Enums\HostedDomainType;
use App\Enums\SslMethod;
use Database\Factories\HostedDomainFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Validation\ValidationException;

class HostedDomain extends AbstractModel
{
    
    use HasFactory;

    protected $fillable = [
        'site_id',
        'domain',
        'type',
        'status',
        'ssl_method',
        'ssl_id',
        'error',
    ];

    protected $casts = [
        'site_id' => 'integer',
        'ssl_id' => 'integer',
        'type' => HostedDomainType::class,
        'status' => HostedDomainStatus::class,
        'ssl_method' => SslMethod::class,
    ];

    
    public function ensureModifiable(string $action): void
    {
        if ($this->type === HostedDomainType::PRIMARY) {
            throw ValidationException::withMessages([
                'domain' => ["Cannot {$action} the primary domain."],
            ]);
        }

        if ($this->status->isProcessing()) {
            throw ValidationException::withMessages([
                'domain' => ["Cannot {$action} a domain while it is {$this->status->value}."],
            ]);
        }
    }

    
    public function site(): BelongsTo
    {
        return $this->belongsTo(Site::class);
    }

    
    public function ssl(): BelongsTo
    {
        return $this->belongsTo(Ssl::class);
    }
}
