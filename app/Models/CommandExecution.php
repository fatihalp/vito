<?php

namespace App\Models;

use App\Enums\CommandExecutionStatus;
use Carbon\Carbon;
use Database\Factories\CommandExecutionFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CommandExecution extends AbstractModel
{
    
    use HasFactory;

    protected $fillable = [
        'command_id',
        'server_id',
        'user_id',
        'server_log_id',
        'variables',
        'status',
    ];

    protected $casts = [
        'command_id' => 'integer',
        'server_id' => 'integer',
        'user_id' => 'integer',
        'server_log_id' => 'integer',
        'variables' => 'array',
        'status' => CommandExecutionStatus::class,
    ];

    
    public function command(): BelongsTo
    {
        return $this->belongsTo(Command::class);
    }

    public function getContent(): string
    {
        $content = $this->command->command;
        foreach ($this->variables as $variable => $value) {
            if (is_string($value) && ($value !== '' && $value !== '0')) {
                $content = str_replace('${'.$variable.'}', $value, $content);
            }
        }

        return $content;
    }

    
    public function serverLog(): BelongsTo
    {
        return $this->belongsTo(ServerLog::class);
    }

    
    public function server(): BelongsTo
    {
        return $this->belongsTo(Server::class);
    }

    
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
