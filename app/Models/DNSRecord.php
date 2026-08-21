<?php

namespace App\Models;

use Database\Factories\DNSRecordFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;


class DNSRecord extends AbstractModel
{
    
    use HasFactory;

    protected $table = 'dns_records';

    protected $fillable = [
        'domain_id',
        'type',
        'name',
        'content',
        'ttl',
        'proxied',
        'priority',
        'provider_record_id',
        'metadata',
    ];

    protected $casts = [
        'domain_id' => 'integer',
        'ttl' => 'integer',
        'proxied' => 'boolean',
        'priority' => 'integer',
        'metadata' => 'array',
    ];

    
    public function domain(): BelongsTo
    {
        return $this->belongsTo(Domain::class);
    }

    
    public function getFormattedNameAttribute(): string
    {
        return $this->name === $this->domain->domain ? '@' : $this->name;
    }
}
