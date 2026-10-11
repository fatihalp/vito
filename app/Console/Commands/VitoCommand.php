<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;

class VitoCommand extends Command
{
    protected $signature = 'vito';

    protected $description = 'Run Vito database migrations';

    public function handle(): int
    {
        return $this->call('migrate');
    }
}
