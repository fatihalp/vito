<?php

namespace App\Services;

use App\DTOs\ServiceLog;

interface HasLogs
{
    
    public function logs(): array;
}
